import { describe, expect, test } from "bun:test";
import { calculateStandings, type ScoringInput } from "../src";

describe("scoring engine", () => {
  test("calculates weight-based standings", () => {
    const input: ScoringInput = {
      catches: [
        { id: "1", teamId: "team-a", speciesId: "bass", weight: 128, length: 15, timestamp: new Date() },
        { id: "2", teamId: "team-a", speciesId: "bass", weight: 96, length: 14, timestamp: new Date() },
        { id: "3", teamId: "team-b", speciesId: "bass", weight: 112, length: 14.5, timestamp: new Date() },
      ],
      format: "weight",
    };

    const result = calculateStandings(input);

    expect(result.leaderboard).toHaveLength(2);
    expect(result.leaderboard[0].teamId).toBe("team-a");
    expect(result.leaderboard[0].score).toBe(224); // 128 + 96
    expect(result.leaderboard[1].teamId).toBe("team-b");
    expect(result.leaderboard[1].score).toBe(112);
  });

  test("calculates count-based standings with max catches limit", () => {
    const input: ScoringInput = {
      catches: [
        { id: "1", teamId: "team-a", speciesId: "bass", weight: 128, length: 15, timestamp: new Date() },
        { id: "2", teamId: "team-a", speciesId: "bass", weight: 96, length: 14, timestamp: new Date() },
        { id: "3", teamId: "team-a", speciesId: "bass", weight: 64, length: 12, timestamp: new Date() },
        { id: "4", teamId: "team-b", speciesId: "bass", weight: 112, length: 14.5, timestamp: new Date() },
        { id: "5", teamId: "team-b", speciesId: "bass", weight: 80, length: 13, timestamp: new Date() },
      ],
      format: "count",
      options: { maxCatches: 2 },
    };

    const result = calculateStandings(input);

    expect(result.leaderboard[0].teamId).toBe("team-a");
    expect(result.leaderboard[0].score).toBe(2); // limited to max 2
    expect(result.leaderboard[1].teamId).toBe("team-b");
    expect(result.leaderboard[1].score).toBe(2);
  });

  test("filters by minimum size", () => {
    const input: ScoringInput = {
      catches: [
        { id: "1", teamId: "team-a", speciesId: "bass", weight: 128, length: 15, timestamp: new Date() },
        { id: "2", teamId: "team-a", speciesId: "bass", weight: 48, length: 8, timestamp: new Date() }, // too small
        { id: "3", teamId: "team-b", speciesId: "bass", weight: 112, length: 14.5, timestamp: new Date() },
      ],
      format: "weight",
      options: { minimumSize: 100 }, // minimum 100 oz
    };

    const result = calculateStandings(input);

    expect(result.totalCatches).toBe(2);
    expect(result.leaderboard[0].score).toBe(128);
  });

  test("applies species multipliers", () => {
    const input: ScoringInput = {
      catches: [
        { id: "1", teamId: "team-a", speciesId: "bass", weight: 100, length: 15, timestamp: new Date() },
        { id: "2", teamId: "team-a", speciesId: "trout", weight: 100, length: 15, timestamp: new Date() },
        { id: "3", teamId: "team-b", speciesId: "bass", weight: 100, length: 15, timestamp: new Date() },
      ],
      format: "weight",
      options: { speciesMultiplier: { trout: 1.5 } },
    };

    const result = calculateStandings(input);

    expect(result.leaderboard[0].teamId).toBe("team-a");
    expect(result.leaderboard[0].score).toBe(250); // 100 + (100 * 1.5)
    expect(result.leaderboard[1].teamId).toBe("team-b");
    expect(result.leaderboard[1].score).toBe(100);
  });
});
