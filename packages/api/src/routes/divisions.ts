import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db, tournamentDivisions, tournaments } from "@tourneyforge/db";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

export const divisionRouter = new Hono();

const createDivisionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

// Get all divisions for a tournament
divisionRouter.get("/:tournamentId/divisions", async (c) => {
  const tenantId = c.req.header("x-tenant-id");
  if (!tenantId) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Missing x-tenant-id header" } }, 400);
  }

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
        eq(tournamentDivisions.tenantId, tenantId)
      )
    );

  return c.json({ data: divisions });
});

// Create a division
divisionRouter.post(
  "/:tournamentId/divisions",
  zValidator("json", createDivisionSchema),
  async (c) => {
    const tenantId = c.req.header("x-tenant-id");
    if (!tenantId) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: "Missing x-tenant-id header" } },
        400
      );
    }

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
  const tenantId = c.req.header("x-tenant-id");
  if (!tenantId) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Missing x-tenant-id header" } }, 400);
  }

  const divisionId = c.req.param("divisionId");

  const [deleted] = await db
    .delete(tournamentDivisions)
    .where(
      and(eq(tournamentDivisions.id, divisionId), eq(tournamentDivisions.tenantId, tenantId))
    )
    .returning();

  if (!deleted) {
    return c.json({ error: { code: "NOT_FOUND", message: "Division not found" } }, 404);
  }

  return c.json({ data: deleted });
});
