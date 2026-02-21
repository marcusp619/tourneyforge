import { auth } from "@clerk/nextjs/server";
import { db, users, tenantMembers, tenants } from "@tourneyforge/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { Tenant } from "@tourneyforge/types";

export interface TenantContext {
  tenant: Tenant;
  role: string;
  userId: string;
}

/**
 * Resolve the current authenticated user's tenant context.
 * Redirects to /sign-in if unauthenticated.
 * Returns null if the user has no tenant membership yet.
 */
export async function getCurrentTenant(): Promise<TenantContext | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  // Look up internal user by Clerk ID
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  if (!user) return null;

  // Get first tenant membership (directors typically belong to one tenant)
  const [membership] = await db
    .select({
      tenantId: tenantMembers.tenantId,
      role: tenantMembers.role,
    })
    .from(tenantMembers)
    .where(eq(tenantMembers.userId, user.id))
    .limit(1);

  if (!membership) return null;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, membership.tenantId))
    .limit(1);

  if (!tenant) return null;

  return {
    tenant: tenant as Tenant,
    role: membership.role,
    userId: user.id,
  };
}

/**
 * Like getCurrentTenant but redirects to /dashboard/onboarding if no tenant.
 */
export async function requireTenant(): Promise<TenantContext> {
  const ctx = await getCurrentTenant();
  if (!ctx) redirect("/dashboard/onboarding");
  return ctx;
}
