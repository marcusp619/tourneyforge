import { Hono } from "hono";
import { db } from "@tourneyforge/db";
import { catches, tournaments, scoringFormats, teams } from "@tourneyforge/db";
import { calculateStandings, type ScoringInput } from "@tourneyforge/scoring";
import { eq } from "drizzle-orm";

export const leaderboardRouter = new Hono();

// GET /api/leaderboards/:tournamentId — compute and return live standings
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
      if (format.type === "weight" || format.type === "length" || format.type === "count") {
        scoringFormat = format.type;
      }
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

  // Fetch catches + team names together
  const [tournamentCatches, tournamentTeams] = await Promise.all([
    db.select().from(catches).where(eq(catches.tournamentId, tournamentId)),
    db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(eq(teams.tournamentId, tournamentId)),
  ]);

  const teamNames = new Map(tournamentTeams.map((t) => [t.id, t.name]));

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

  // Enrich leaderboard entries with real team names
  const leaderboard = result.leaderboard.map((entry) => ({
    ...entry,
    teamName: teamNames.get(entry.teamId) ?? entry.teamId,
  }));

  return c.json({
    data: {
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        scoringFormat,
      },
      leaderboard,
      totalCatches: result.totalCatches,
      speciesBreakdown: result.speciesBreakdown,
    },
  });
});
