import type { LeaderboardEntry } from "@tourneyforge/types";

/**
 * Pure scoring engine for fishing tournaments
 * Zero side effects, zero DB calls - fully deterministic
 */

export interface Catch {
  id: string;
  teamId: string;
  speciesId: string;
  weight: number; // in ounces
  length: number; // in inches
  timestamp: Date;
}

export interface ScoringInput {
  catches: Catch[];
  format: "weight" | "length" | "count";
  options?: {
    maxCatches?: number; // For count-based scoring, only count top N
    speciesMultiplier?: Record<string, number>; // Species-specific multipliers
    minimumSize?: number; // Minimum size (weight or length) to qualify
  };
}

export interface ScoringResult {
  leaderboard: LeaderboardEntry[];
  totalCatches: number;
  speciesBreakdown: Record<string, number>;
}

/**
 * Calculate tournament standings
 *
 * @param input - The catches and scoring format
 * @returns Calculated leaderboard and statistics
 */
export function calculateStandings(input: ScoringInput): ScoringResult {
  const { catches, format, options = {} } = input;

  // Filter catches by minimum size if specified
  let qualifiedCatches = catches;
  if (options.minimumSize !== undefined) {
    qualifiedCatches = catches.filter((c) => {
      if (format === "weight") return c.weight >= options.minimumSize!;
      if (format === "length") return c.length >= options.minimumSize!;
      return true;
    });
  }

  // Group catches by team
  const teamCatches = new Map<string, Catch[]>();
  for (const c of qualifiedCatches) {
    const existing = teamCatches.get(c.teamId) ?? [];
    teamCatches.set(c.teamId, [...existing, c]);
  }

  // Calculate scores per team
  const teamScores = new Map<string, number>();
  const teamDetails = new Map<string, Record<string, number>>();

  for (const [teamId, teamCatchList] of teamCatches.entries()) {
    let score = 0;
    const details: Record<string, number> = {};

    // Apply max catches limit if specified
    let sortedCatches = teamCatchList;
    if (options.maxCatches && teamCatchList.length > options.maxCatches) {
      if (format === "weight") {
        sortedCatches = teamCatchList
          .sort((a, b) => b.weight - a.weight)
          .slice(0, options.maxCatches);
      } else if (format === "length") {
        sortedCatches = teamCatchList
          .sort((a, b) => b.length - a.length)
          .slice(0, options.maxCatches);
      } else {
        // count format - no sorting needed, just limit
        sortedCatches = teamCatchList.slice(0, options.maxCatches);
      }
    }

    for (const c of sortedCatches) {
      let catchScore = 0;
      const multiplier = options.speciesMultiplier?.[c.speciesId] ?? 1;

      if (format === "weight") {
        catchScore = c.weight * multiplier;
      } else if (format === "length") {
        catchScore = c.length * multiplier;
      } else if (format === "count") {
        catchScore = 1 * multiplier;
      }

      score += catchScore;

      // Track by species
      const currentSpeciesScore = details[c.speciesId] ?? 0;
      details[c.speciesId] = currentSpeciesScore + catchScore;
    }

    teamScores.set(teamId, score);
    teamDetails.set(teamId, details);
  }

  // Build leaderboard (sorted by score descending)
  const leaderboard: LeaderboardEntry[] = Array.from(teamScores.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([teamId, score], index) => ({
      rank: index + 1,
      teamId,
      teamName: teamId, // Will be resolved by caller
      score,
      details: teamDetails.get(teamId) ?? {},
    }));

  // Calculate species breakdown
  const speciesBreakdown: Record<string, number> = {};
  for (const c of qualifiedCatches) {
    const currentCount = speciesBreakdown[c.speciesId] ?? 0;
    speciesBreakdown[c.speciesId] = currentCount + 1;
  }

  return {
    leaderboard,
    totalCatches: qualifiedCatches.length,
    speciesBreakdown,
  };
}
