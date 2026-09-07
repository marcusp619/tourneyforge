import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@tourneyforge/db";
import { sponsors } from "@tourneyforge/db";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireTenant, requireUser, type TenantEnv } from "../middleware/tenant";

export const sponsorRouter = new Hono<TenantEnv>();

// Every route below is tenant-scoped. The tenant comes from the caller's
// membership, never from the request — see middleware/tenant.ts.
sponsorRouter.use("*", requireUser, requireTenant);

// `tenantId` is deliberately absent: it used to arrive in the request body, which let
// any caller create a sponsor under any club. It is taken from the caller now.
const createSponsorSchema = z.object({
  tournamentId: z.string().uuid().nullish(),
  name: z.string().min(1).max(100),
  logoUrl: z.string().url().nullish(),
  website: z.string().url().nullish(),
  tier: z.enum(["title", "gold", "silver", "bronze"]).default("bronze"),
  displayOrder: z.number().int().default(0),
});

const updateSponsorSchema = createSponsorSchema.partial();

// GET /api/sponsors?tournamentId=
sponsorRouter.get("/", async (c) => {
  const tenantId = c.get("tenantId");
  const tournamentId = c.req.query("tournamentId");

  const rows = await db
    .select()
    .from(sponsors)
    .where(
      tournamentId
        ? and(eq(sponsors.tenantId, tenantId), eq(sponsors.tournamentId, tournamentId), isNull(sponsors.deletedAt))
        : and(eq(sponsors.tenantId, tenantId), isNull(sponsors.deletedAt))
    )
    .orderBy(sponsors.displayOrder, sponsors.createdAt);

  return c.json({ data: rows });
});

// POST /api/sponsors
sponsorRouter.post("/", zValidator("json", createSponsorSchema), async (c) => {
  const body = c.req.valid("json");
  const [created] = await db.insert(sponsors).values({
    ...body,
    tenantId: c.get("tenantId"),
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

  // This update was previously scoped by id alone — any caller could rewrite any
  // club's sponsor. The tenant predicate is the fix.
  const [updated] = await db
    .update(sponsors)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(sponsors.id, id), eq(sponsors.tenantId, c.get("tenantId")), isNull(sponsors.deletedAt)))
    .returning();

  if (!updated) {
    return c.json({ error: { code: "NOT_FOUND", message: "Sponsor not found" } }, 404);
  }

  return c.json({ data: updated });
});

// DELETE /api/sponsors/:id (soft delete)
sponsorRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const [deleted] = await db
    .update(sponsors)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(sponsors.id, id), eq(sponsors.tenantId, c.get("tenantId")), isNull(sponsors.deletedAt)))
    .returning({ id: sponsors.id });

  if (!deleted) {
    return c.json({ error: { code: "NOT_FOUND", message: "Sponsor not found" } }, 404);
  }

  return c.json({ data: { success: true } });
});
