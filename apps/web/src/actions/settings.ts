"use server";

import { requireTenant } from "@/lib/tenant";
import { db, tenants } from "@tourneyforge/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Redis } from "@upstash/redis";
import { SUBSCRIPTION_LIMITS } from "@tourneyforge/types";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

/**
 * Generate a presigned R2 URL for logo upload.
 * Returns the upload URL (PUT to this) + the final public URL.
 */
export async function getLogoUploadUrl(
  contentType: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml"
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const { tenant } = await requireTenant();

  const r2AccountId = process.env.R2_ACCOUNT_ID;
  const r2Bucket = process.env.R2_BUCKET_NAME;
  const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
  const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!r2AccountId || !r2Bucket || !r2AccessKeyId || !r2SecretAccessKey) {
    throw new Error("Storage not configured — add R2 env vars to enable logo upload.");
  }

  const ext = contentType.split("/")[1]!.replace("svg+xml", "svg");
  const key = `logos/${tenant.slug}-${Date.now()}.${ext}`;

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: r2AccessKeyId, secretAccessKey: r2SecretAccessKey },
  });

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: r2Bucket, Key: key, ContentType: contentType }),
    { expiresIn: 300 }
  );

  const publicUrl = `https://${r2Bucket}.${r2AccountId}.r2.cloudflarestorage.com/${key}`;
  return { uploadUrl, publicUrl };
}

/**
 * Persist a new logo URL after a successful R2 upload.
 */
export async function saveLogoUrl(logoUrl: string) {
  const { tenant } = await requireTenant();

  await db
    .update(tenants)
    .set({ logoUrl, updatedAt: new Date() })
    .where(eq(tenants.id, tenant.id));

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}

/**
 * Save theme preset + color overrides + tagline.
 */
export async function saveThemeSettings(settings: {
  themePreset: string;
  primaryColor: string | null;
  accentColor: string | null;
  tagline: string | null;
}) {
  const { tenant } = await requireTenant();

  await db
    .update(tenants)
    .set({
      themePreset: settings.themePreset,
      primaryColor: settings.primaryColor || null,
      accentColor: settings.accentColor || null,
      tagline: settings.tagline || null,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenant.id));

  revalidatePath("/dashboard/settings");
}
