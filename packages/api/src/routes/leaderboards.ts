import { Hono } from "hono";
import { db } from "@tourneyforge/db";
import { catches, tournaments } from "@tourneyforge/db";
import { calculateStandings, type ScoringInput } from "@tourneyforge/scoring";
import { eq } from "drizzle-orm";

export const leaderboardRouter = new Hono();

// Get leaderboard for a tournament
leaderboardRouter.get("/:tournamentId", async (c) => {
  const tournamentId = c.req.param("tournamentId");

  // Get tournament
  const tournamentResult = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId));

  if (!tournamentResult.length) {
    return c.json({ error: { code: "NOT_FOUND", message: "Tournament not found" } }, 404);
  }

  const tournament = tournamentResult[0]!; // Non-null assertion - we just checked length

  // Get all catches for this tournament
  const tournamentCatches = await db
    .select()
    .from(catches)
    .where(eq(catches.tournamentId, tournamentId));

  // TODO: Parse scoring format options from tournament.scoringFormatId
  // For now, default to weight-based scoring
  const input: ScoringInput = {
    catches: tournamentCatches.map((c) => ({
      id: c.id,
      teamId: c.teamId,
      speciesId: c.speciesId,
      weight: Number(c.weight),
      length: Number(c.length),
      timestamp: c.timestamp,
    })),
    format: "weight",
    options: {},
  };

  const result = calculateStandings(input);

  return c.json({
    data: {
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
      },
      leaderboard: result.leaderboard,
      totalCatches: result.totalCatches,
      speciesBreakdown: result.speciesBreakdown,
    },
  });
});
