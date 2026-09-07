import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db, tournamentDivisions, tournaments } from "@tourneyforge/db";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireTenant, requireUser, type TenantEnv } from "../middleware/tenant";

export const divisionRouter = new Hono<TenantEnv>();

// Every route below is tenant-scoped. The tenant comes from the caller's
// membership, never from the request — see middleware/tenant.ts.
divisionRouter.use("*", requireUser, requireTenant);

const createDivisionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

// Get all divisions for a tournament
divisionRouter.get("/:tournamentId/divisions", async (c) => {
  const tenantId = c.get("tenantId");

  const tournamentId = c.req.param("tournamentId");

  // Verify tournament belongs to tenant
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(and(eq(tournaments.id, tournamentId), eq(tournaments.tenantId, tenantId)))
    .limit(1);

  if (!tournament) {
    return c.json({ error: { code: "NOT_FOUND", message: "Tournament not found" } }, 404);
  }

  const divisions = await db
    .select()
    .from(tournamentDivisions)
    .where(
      and(
        eq(tournamentDivisions.tournamentId, tournamentId),
        eq(tournamentDivisions.tenantId, tenantId),
        isNull(tournamentDivisions.deletedAt)
      )
    );

  return c.json({ data: divisions });
});

// Create a division
divisionRouter.post(
  "/:tournamentId/divisions",
  zValidator("json", createDivisionSchema),
  async (c) => {
    const tenantId = c.get("tenantId");

    const tournamentId = c.req.param("tournamentId");

    // Verify tournament belongs to tenant
    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(and(eq(tournaments.id, tournamentId), eq(tournaments.tenantId, tenantId)))
      .limit(1);

    if (!tournament) {
      return c.json({ error: { code: "NOT_FOUND", message: "Tournament not found" } }, 404);
    }

    const body = c.req.valid("json");
    const [division] = await db
      .insert(tournamentDivisions)
      .values({
        tournamentId,
        tenantId,
        name: body.name,
        description: body.description,
      })
      .returning();

    return c.json({ data: division }, 201);
  }
);

// Delete a division
divisionRouter.delete("/:tournamentId/divisions/:divisionId", async (c) => {
  const tenantId = c.get("tenantId");

  const divisionId = c.req.param("divisionId");

  const [deleted] = await db
    .update(tournamentDivisions)
    .set({ deletedAt: new Date() })
    .where(
      and(eq(tournamentDivisions.id, divisionId), eq(tournamentDivisions.tenantId, tenantId), isNull(tournamentDivisions.deletedAt))
    )
    .returning();

  if (!deleted) {
    return c.json({ error: { code: "NOT_FOUND", message: "Division not found" } }, 404);
  }

  return c.json({ data: deleted });
});
