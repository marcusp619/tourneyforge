"use server";

import { requireTenant } from "@/lib/tenant";
import { db, tenants } from "@tourneyforge/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Redis } from "@upstash/redis";
import { SUBSCRIPTION_LIMITS } from "@tourneyforge/types";

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/**
 * Save or clear the custom domain for the current tenant.
 * Syncs the mapping in Redis: `custom_domain:{domain}` → slug
 */
export async function updateCustomDomain(formData: FormData) {
  const { tenant } = await requireTenant();
  const raw = (formData.get("customDomain") as string | null) ?? "";
  const domain = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "") || null;

  // Remove the old Redis key if there was a previous domain
  const redis = getRedis();
  if (redis && tenant.customDomain && tenant.customDomain !== domain) {
    try {
      await redis.del(`custom_domain:${tenant.customDomain}`);
    } catch {
      // best-effort
    }
  }

  // Persist in DB
  await db
    .update(tenants)
    .set({ customDomain: domain, updatedAt: new Date() })
    .where(eq(tenants.id, tenant.id));

  // Write new Redis key
  if (redis && domain) {
    try {
      await redis.set(`custom_domain:${domain}`, tenant.slug);
    } catch {
      // best-effort
    }
  }

  revalidatePath("/dashboard/settings");
}

/**
 * Generate a new API key for the current tenant (Enterprise only).
 * A new random UUID is used as the key.
 */
export async function generateApiKey() {
  const { tenant } = await requireTenant();
  const limits = SUBSCRIPTION_LIMITS[tenant.plan];
  if (!limits.apiAccess) {
    throw new Error("API access requires the Enterprise plan");
  }

  const newKey = crypto.randomUUID();
  await db
    .update(tenants)
    .set({ apiKey: newKey, updatedAt: new Date() })
    .where(eq(tenants.id, tenant.id));

  revalidatePath("/dashboard/settings");
}

/**
 * Revoke (clear) the API key for the current tenant.
 */
export async function revokeApiKey() {
  const { tenant } = await requireTenant();

  await db
    .update(tenants)
    .set({ apiKey: null, updatedAt: new Date() })
    .where(eq(tenants.id, tenant.id));

  revalidatePath("/dashboard/settings");
}
