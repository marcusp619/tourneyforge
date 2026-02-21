import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db, scoringFormats } from "@tourneyforge/db";
import { createScoringFormatSchema } from "@tourneyforge/validators";
import { eq, and } from "drizzle-orm";

export const scoringFormatRouter = new Hono();

// Get all scoring formats for a tenant
scoringFormatRouter.get("/", async (c) => {
  const tenantId = c.req.header("x-tenant-id");
  if (!tenantId) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Missing x-tenant-id header" } }, 400);
  }

  const formats = await db
    .select()
    .from(scoringFormats)
    .where(eq(scoringFormats.tenantId, tenantId));

  return c.json({ data: formats });
});

// Get a single scoring format
scoringFormatRouter.get("/:id", async (c) => {
  const tenantId = c.req.header("x-tenant-id");
  if (!tenantId) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Missing x-tenant-id header" } }, 400);
  }

  const id = c.req.param("id");
  const [format] = await db
    .select()
    .from(scoringFormats)
    .where(and(eq(scoringFormats.id, id), eq(scoringFormats.tenantId, tenantId)))
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
    const tenantId = c.req.header("x-tenant-id");
    if (!tenantId) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: "Missing x-tenant-id header" } },
        400
      );
    }

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
  const tenantId = c.req.header("x-tenant-id");
  if (!tenantId) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Missing x-tenant-id header" } }, 400);
  }

  const id = c.req.param("id");
  const [deleted] = await db
    .delete(scoringFormats)
    .where(and(eq(scoringFormats.id, id), eq(scoringFormats.tenantId, tenantId)))
    .returning();

  if (!deleted) {
    return c.json({ error: { code: "NOT_FOUND", message: "Scoring format not found" } }, 404);
  }

  return c.json({ data: deleted });
});
