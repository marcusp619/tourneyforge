import { Hono } from "hono";
import { db } from "@tourneyforge/db";
import { catches, tournaments, scoringFormats } from "@tourneyforge/db";
import { calculateStandings, type ScoringInput } from "@tourneyforge/scoring";
import { eq } from "drizzle-orm";

export const leaderboardRouter = new Hono();

// Get leaderboard for a tournament
leaderboardRouter.get("/:tournamentId", async (c) => {
  const tournamentId = c.req.param("tournamentId");

  // Get tournament
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!tournament) {
    return c.json({ error: { code: "NOT_FOUND", message: "Tournament not found" } }, 404);
  }

  // Look up scoring format if set
  let scoringFormat: "weight" | "length" | "count" = "weight";
  let scoringOptions: ScoringInput["options"] = {};

  if (tournament.scoringFormatId) {
    const [format] = await db
      .select()
      .from(scoringFormats)
      .where(eq(scoringFormats.id, tournament.scoringFormatId))
      .limit(1);

    if (format) {
      // Map DB type to scoring engine format
      if (format.type === "weight" || format.type === "length" || format.type === "count") {
        scoringFormat = format.type;
      }

      // Parse rules JSON for options
      try {
        const rules = JSON.parse(format.rules) as Record<string, unknown>;
        const opts: ScoringInput["options"] = {};
        if (typeof rules["fishLimit"] === "number") opts.maxCatches = rules["fishLimit"];
        if (typeof rules["minimumSize"] === "number") opts.minimumSize = rules["minimumSize"];
        scoringOptions = opts;
      } catch {
        // Ignore parse errors — use defaults
      }
    }
  }

  // Get all catches for this tournament
  const tournamentCatches = await db
    .select()
    .from(catches)
    .where(eq(catches.tournamentId, tournamentId));

  const input: ScoringInput = {
    catches: tournamentCatches.map((c) => ({
      id: c.id,
      teamId: c.teamId,
      speciesId: c.speciesId,
      weight: Number(c.weight),
      length: Number(c.length),
      timestamp: c.timestamp,
    })),
    format: scoringFormat,
    ...(scoringOptions !== undefined ? { options: scoringOptions } : {}),
  };

  const result = calculateStandings(input);

  return c.json({
    data: {
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        scoringFormat,
      },
      leaderboard: result.leaderboard,
      totalCatches: result.totalCatches,
      speciesBreakdown: result.speciesBreakdown,
    },
  });
});
