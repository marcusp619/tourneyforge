import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db, scoringFormats } from "@tourneyforge/db";
import { createScoringFormatSchema } from "@tourneyforge/validators";
import { eq, and, isNull } from "drizzle-orm";
import { requireTenant, requireUser, type TenantEnv } from "../middleware/tenant";

export const scoringFormatRouter = new Hono<TenantEnv>();

// Every route below is tenant-scoped. The tenant comes from the caller's
// membership, never from the request — see middleware/tenant.ts.
scoringFormatRouter.use("*", requireUser, requireTenant);

// Get all scoring formats for a tenant
scoringFormatRouter.get("/", async (c) => {
  const tenantId = c.get("tenantId");

  const formats = await db
    .select()
    .from(scoringFormats)
    .where(and(eq(scoringFormats.tenantId, tenantId), isNull(scoringFormats.deletedAt)));

  return c.json({ data: formats });
});

// Get a single scoring format
scoringFormatRouter.get("/:id", async (c) => {
  const tenantId = c.get("tenantId");

  const id = c.req.param("id");
  const [format] = await db
    .select()
    .from(scoringFormats)
    .where(and(eq(scoringFormats.id, id), eq(scoringFormats.tenantId, tenantId), isNull(scoringFormats.deletedAt)))
    .limit(1);

  if (!format) {
    return c.json({ error: { code: "NOT_FOUND", message: "Scoring format not found" } }, 404);
  }

  return c.json({ data: format });
});

// Create a scoring format
scoringFormatRouter.post(
  "/",
  zValidator("json", createScoringFormatSchema),
  async (c) => {
    const tenantId = c.get("tenantId");

    const body = c.req.valid("json");
    const [format] = await db
      .insert(scoringFormats)
      .values({
        tenantId,
        name: body.name,
        type: body.type,
        rules: JSON.stringify(body.rules),
      })
      .returning();

    return c.json({ data: format }, 201);
  }
);

// Delete a scoring format
scoringFormatRouter.delete("/:id", async (c) => {
  const tenantId = c.get("tenantId");

  const id = c.req.param("id");
  const [deleted] = await db
    .update(scoringFormats)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(scoringFormats.id, id), eq(scoringFormats.tenantId, tenantId), isNull(scoringFormats.deletedAt)))
    .returning();

  if (!deleted) {
    return c.json({ error: { code: "NOT_FOUND", message: "Scoring format not found" } }, 404);
  }

  return c.json({ data: deleted });
});
