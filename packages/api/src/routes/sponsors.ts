import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@tourneyforge/db";
import { sponsors } from "@tourneyforge/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

export const sponsorRouter = new Hono();

const createSponsorSchema = z.object({
  tenantId: z.string().uuid(),
  tournamentId: z.string().uuid().nullish(),
  name: z.string().min(1).max(100),
  logoUrl: z.string().url().nullish(),
  website: z.string().url().nullish(),
  tier: z.enum(["title", "gold", "silver", "bronze"]).default("bronze"),
  displayOrder: z.number().int().default(0),
});

const updateSponsorSchema = createSponsorSchema.partial().omit({ tenantId: true });

// GET /api/sponsors?tenantId=&tournamentId=
sponsorRouter.get("/", async (c) => {
  const tenantId = c.req.query("tenantId");
  const tournamentId = c.req.query("tournamentId");

  if (!tenantId) {
    return c.json({ error: { code: "BAD_REQUEST", message: "tenantId is required" } }, 400);
  }

  const rows = await db
    .select()
    .from(sponsors)
    .where(
      tournamentId
        ? and(eq(sponsors.tenantId, tenantId), eq(sponsors.tournamentId, tournamentId))
        : eq(sponsors.tenantId, tenantId)
    )
    .orderBy(sponsors.displayOrder, sponsors.createdAt);

  return c.json({ data: rows });
});

// POST /api/sponsors
sponsorRouter.post("/", zValidator("json", createSponsorSchema), async (c) => {
  const body = c.req.valid("json");
  const [created] = await db.insert(sponsors).values({
    ...body,
    tournamentId: body.tournamentId ?? null,
    logoUrl: body.logoUrl ?? null,
    website: body.website ?? null,
  }).returning();
  return c.json({ data: created }, 201);
});

// PATCH /api/sponsors/:id
sponsorRouter.patch("/:id", zValidator("json", updateSponsorSchema), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");

  const [updated] = await db
    .update(sponsors)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(sponsors.id, id))
    .returning();

  if (!updated) {
    return c.json({ error: { code: "NOT_FOUND", message: "Sponsor not found" } }, 404);
  }

  return c.json({ data: updated });
});

// DELETE /api/sponsors/:id
sponsorRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await db.delete(sponsors).where(eq(sponsors.id, id));
  return c.json({ data: { success: true } });
});
