import { auth } from "@clerk/nextjs/server";
import { db, users, tenantMembers, tenants } from "@tourneyforge/db";
import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import type { Tenant } from "@tourneyforge/types";

const LOCAL_DEV = process.env.LOCAL_DEV === "true";

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
  if (LOCAL_DEV) {
    // This used to be `select().from(tenants).limit(1)` — an unordered LIMIT 1, so
    // *which club the dev director ran* was decided by Postgres heap order. It looked
    // stable until something updated a `tenants` row, which moves it, and then the
    // dashboard silently started administering a different club. The end-to-end money
    // path failed exactly that way.
    //
    // Resolve it the way the API does instead: a fixed identity, and the club from that
    // identity's membership. Same rule offline as online, and the two agree on who the
    // dev director is.
    const devUserId = process.env.LOCAL_DEV_USER_ID ?? "user-1";
    const [membership] = await db
      .select({ tenantId: tenantMembers.tenantId, role: tenantMembers.role })
      .from(tenantMembers)
      .where(eq(tenantMembers.userId, devUserId))
      .orderBy(asc(tenantMembers.createdAt))
      .limit(1);
    if (!membership) return null;

    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, membership.tenantId))
      .limit(1);
    if (!tenant) return null;

    return { tenant: tenant as Tenant, role: membership.role, userId: devUserId };
  }

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
