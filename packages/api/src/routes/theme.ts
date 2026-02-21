import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@tourneyforge/db";
import { tenants } from "@tourneyforge/db";
import { eq } from "drizzle-orm";
import { updateTenantThemeSchema, logoUploadRequestSchema } from "@tourneyforge/validators";
import { z } from "zod";

export const themeRouter = new Hono();

/**
 * PATCH /api/tenants/:id/theme
 * Update a tenant's theme preset + color overrides.
 * Requires tenant auth (enforced by caller middleware in Phase 2).
 */
themeRouter.patch("/:id/theme", zValidator("json", updateTenantThemeSchema), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");

  const updated = await db
    .update(tenants)
    .set({
      ...(body.themePreset !== undefined && { themePreset: body.themePreset }),
      ...(body.primaryColor !== undefined && { primaryColor: body.primaryColor }),
      ...(body.accentColor !== undefined && { accentColor: body.accentColor }),
      ...(body.fontFamily !== undefined && { fontFamily: body.fontFamily }),
      ...(body.tagline !== undefined && { tagline: body.tagline }),
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, id))
    .returning();

  if (!updated.length) {
    return c.json({ error: { code: "NOT_FOUND", message: "Tenant not found" } }, 404);
  }

  return c.json({ data: updated[0] });
});

/**
 * POST /api/tenants/:id/logo-upload-url
 * Returns a presigned R2 URL for direct browser upload.
 * After the upload completes, the client calls PATCH /api/tenants/:id to set logoUrl.
 */
themeRouter.post(
  "/:id/logo-upload-url",
  zValidator("json", logoUploadRequestSchema),
  async (c) => {
    const id = c.req.param("id");
    const { contentType } = c.req.valid("json");

    // Verify tenant exists
    const [tenant] = await db
      .select({ id: tenants.id, slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.id, id))
      .limit(1);

    if (!tenant) {
      return c.json({ error: { code: "NOT_FOUND", message: "Tenant not found" } }, 404);
    }

    const ext = contentType.split("/")[1]!.replace("svg+xml", "svg");
    const key = `logos/${tenant.slug}-${Date.now()}.${ext}`;

    // Build presigned URL using R2 S3-compatible API
    const r2AccountId = process.env.R2_ACCOUNT_ID;
    const r2Bucket = process.env.R2_BUCKET_NAME;
    const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
    const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!r2AccountId || !r2Bucket || !r2AccessKeyId || !r2SecretAccessKey) {
      return c.json(
        { error: { code: "MISCONFIGURED", message: "Storage not configured" } },
        503
      );
    }

    // Use AWS SDK v3 S3 client (R2 is S3-compatible)
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey,
      },
    });

    const command = new PutObjectCommand({
      Bucket: r2Bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min

    // Public URL after upload (assumes public bucket or CDN)
    const publicUrl = `https://${r2Bucket}.${r2AccountId}.r2.cloudflarestorage.com/${key}`;

    return c.json({ data: { uploadUrl, key, publicUrl } });
  }
);

/**
 * PATCH /api/tenants/:id/logo
 * Set the logoUrl after a successful R2 upload.
 */
themeRouter.patch(
  "/:id/logo",
  zValidator("json", z.object({ logoUrl: z.string().url() })),
  async (c) => {
    const id = c.req.param("id");
    const { logoUrl } = c.req.valid("json");

    const updated = await db
      .update(tenants)
      .set({ logoUrl, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();

    if (!updated.length) {
      return c.json({ error: { code: "NOT_FOUND", message: "Tenant not found" } }, 404);
    }

    return c.json({ data: updated[0] });
  }
);
