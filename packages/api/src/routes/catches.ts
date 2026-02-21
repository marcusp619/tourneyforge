import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, catches, tournaments, teams, species } from "@tourneyforge/db";
import { eq, and } from "drizzle-orm";
import { catchSubmitSchema } from "@tourneyforge/validators";

export const catchRouter = new Hono();

// GET /api/catches?tournamentId=<uuid> — list catches (with team + species name)
catchRouter.get(
  "/",
  zValidator("query", z.object({ tournamentId: z.string().uuid() })),
  async (c) => {
    const { tournamentId } = c.req.valid("query");

    const rows = await db
      .select({
        id: catches.id,
        tenantId: catches.tenantId,
        tournamentId: catches.tournamentId,
        teamId: catches.teamId,
        teamName: teams.name,
        speciesId: catches.speciesId,
        speciesName: species.commonName,
        weight: catches.weight,
        length: catches.length,
        photoUrl: catches.photoUrl,
        latitude: catches.latitude,
        longitude: catches.longitude,
        verified: catches.verified,
        verifiedAt: catches.verifiedAt,
        timestamp: catches.timestamp,
        createdAt: catches.createdAt,
      })
      .from(catches)
      .innerJoin(teams, eq(teams.id, catches.teamId))
      .innerJoin(species, eq(species.id, catches.speciesId))
      .where(eq(catches.tournamentId, tournamentId))
      .orderBy(catches.timestamp);

    return c.json({ data: rows });
  }
);

// POST /api/catches — submit a catch
catchRouter.post(
  "/",
  zValidator("json", catchSubmitSchema),
  async (c) => {
    const body = c.req.valid("json");

    // Verify tournament is active
    const [tournament] = await db
      .select({ status: tournaments.status, tenantId: tournaments.tenantId })
      .from(tournaments)
      .where(eq(tournaments.id, body.tournamentId))
      .limit(1);

    if (!tournament) {
      return c.json({ error: { code: "NOT_FOUND", message: "Tournament not found" } }, 404);
    }
    if (tournament.status !== "active") {
      return c.json(
        { error: { code: "TOURNAMENT_NOT_ACTIVE", message: "Tournament is not currently active" } },
        422
      );
    }

    // Verify team belongs to this tournament
    const [team] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.id, body.teamId), eq(teams.tournamentId, body.tournamentId)))
      .limit(1);

    if (!team) {
      return c.json(
        { error: { code: "INVALID_TEAM", message: "Team not found in this tournament" } },
        422
      );
    }

    const [newCatch] = await db
      .insert(catches)
      .values({
        tenantId: tournament.tenantId,
        tournamentId: body.tournamentId,
        teamId: body.teamId,
        speciesId: body.speciesId,
        weight: String(body.weight),
        length: String(body.length),
        photoUrl: body.photoUrl ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        timestamp: body.timestamp,
        verified: "false",
      })
      .returning();

    return c.json({ data: newCatch }, 201);
  }
);

// PATCH /api/catches/:id/verify — director verifies or un-verifies a catch
catchRouter.patch(
  "/:id/verify",
  zValidator("json", z.object({ verified: z.boolean() })),
  async (c) => {
    const id = c.req.param("id");
    const { verified } = c.req.valid("json");

    const [updated] = await db
      .update(catches)
      .set({
        verified: verified ? "true" : "false",
        verifiedAt: verified ? new Date() : null,
      })
      .where(eq(catches.id, id))
      .returning();

    if (!updated) {
      return c.json({ error: { code: "NOT_FOUND", message: "Catch not found" } }, 404);
    }

    return c.json({ data: updated });
  }
);

// DELETE /api/catches/:id — director removes a catch
catchRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const [deleted] = await db
    .delete(catches)
    .where(eq(catches.id, id))
    .returning({ id: catches.id });

  if (!deleted) {
    return c.json({ error: { code: "NOT_FOUND", message: "Catch not found" } }, 404);
  }

  return c.json({ data: { id: deleted.id } });
});
