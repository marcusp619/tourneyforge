import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, catches, tournaments, teams, species } from "@tourneyforge/db";
import { eq, and, isNull } from "drizzle-orm";
import { catchSubmitSchema } from "@tourneyforge/validators";
import {
  isTenantMember,
  requireTenant,
  requireUser,
  type TenantEnv,
} from "../middleware/tenant";

export const catchRouter = new Hono<TenantEnv>();

// GET /api/catches?tournamentId=<uuid> — list catches (with team + species name)
catchRouter.get(
  "/",
  requireUser,
  requireTenant,
  zValidator("query", z.object({ tournamentId: z.string().uuid() })),
  async (c) => {
    const { tournamentId } = c.req.valid("query");
    const tenantId = c.get("tenantId");

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
      .where(and(eq(catches.tournamentId, tournamentId), eq(catches.tenantId, tenantId), isNull(catches.deletedAt)))
      .orderBy(catches.timestamp);

    return c.json({ data: rows });
  }
);

/**
 * POST /api/catches — submit a catch.
 *
 * The one scoped write whose caller is *not* a club member: an angler fishing a
 * tournament belongs to a team, not to the club running it. So this route cannot use
 * `requireTenant`. The tenant is derived from the tournament being fished, and the
 * caller is authorised against the team instead — they must be its captain, or a
 * member of the club (a director entering a catch on someone's behalf).
 *
 * `teams.captainId` is the only user→team link the schema has; teams with more than one
 * angler are not modelled, so a non-captain teammate cannot submit today.
 */
catchRouter.post(
  "/",
  requireUser,
  zValidator("json", catchSubmitSchema),
  async (c) => {
    const body = c.req.valid("json");
    const userId = c.get("userId");

    // The tournament decides the tenant. Nothing the caller sent does.
    const [tournament] = await db
      .select({ status: tournaments.status, tenantId: tournaments.tenantId })
      .from(tournaments)
      .where(and(eq(tournaments.id, body.tournamentId), isNull(tournaments.deletedAt)))
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
      .select({ id: teams.id, captainId: teams.captainId })
      .from(teams)
      .where(and(eq(teams.id, body.teamId), eq(teams.tournamentId, body.tournamentId)))
      .limit(1);

    if (!team) {
      return c.json(
        { error: { code: "INVALID_TEAM", message: "Team not found in this tournament" } },
        422
      );
    }

    const maySubmit =
      team.captainId === userId || (await isTenantMember(userId, tournament.tenantId));
    if (!maySubmit) {
      return c.json(
        { error: { code: "FORBIDDEN", message: "Not permitted to submit for this team" } },
        403
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
  requireUser,
  requireTenant,
  zValidator("json", z.object({ verified: z.boolean() })),
  async (c) => {
    const id = c.req.param("id");
    const { verified } = c.req.valid("json");
    const tenantId = c.get("tenantId");

    const [updated] = await db
      .update(catches)
      .set({
        verified: verified ? "true" : "false",
        verifiedAt: verified ? new Date() : null,
      })
      .where(and(eq(catches.id, id), eq(catches.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return c.json({ error: { code: "NOT_FOUND", message: "Catch not found" } }, 404);
    }

    return c.json({ data: updated });
  }
);

// DELETE /api/catches/:id — director removes a catch (soft delete)
catchRouter.delete("/:id", requireUser, requireTenant, async (c) => {
  const id = c.req.param("id");
  const tenantId = c.get("tenantId");

  const [deleted] = await db
    .update(catches)
    .set({ deletedAt: new Date() })
    .where(and(eq(catches.id, id), eq(catches.tenantId, tenantId), isNull(catches.deletedAt)))
    .returning({ id: catches.id });

  if (!deleted) {
    return c.json({ error: { code: "NOT_FOUND", message: "Catch not found" } }, 404);
  }

  return c.json({ data: { id: deleted.id } });
});
