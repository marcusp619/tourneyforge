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

  test("zero catches returns empty leaderboard", () => {
    const result = calculateStandings({ catches: [], format: "weight" });

    expect(result.leaderboard).toHaveLength(0);
    expect(result.totalCatches).toBe(0);
    expect(result.speciesBreakdown).toEqual({});
  });

  test("all catches below minimum size returns empty leaderboard", () => {
    const input: ScoringInput = {
      catches: [
        { id: "1", teamId: "team-a", speciesId: "bass", weight: 48, length: 8, timestamp: new Date() },
        { id: "2", teamId: "team-b", speciesId: "bass", weight: 60, length: 9, timestamp: new Date() },
      ],
      format: "weight",
      options: { minimumSize: 100 },
    };

    const result = calculateStandings(input);

    expect(result.leaderboard).toHaveLength(0);
    expect(result.totalCatches).toBe(0);
  });

  test("tied teams share rank and next rank skips", () => {
    const input: ScoringInput = {
      catches: [
        { id: "1", teamId: "team-a", speciesId: "bass", weight: 100, length: 15, timestamp: new Date() },
        { id: "2", teamId: "team-b", speciesId: "bass", weight: 100, length: 15, timestamp: new Date() },
        { id: "3", teamId: "team-c", speciesId: "bass", weight: 80, length: 13, timestamp: new Date() },
      ],
      format: "weight",
    };

    const result = calculateStandings(input);

    expect(result.leaderboard).toHaveLength(3);
    const teamA = result.leaderboard.find((e) => e.teamId === "team-a")!;
    const teamB = result.leaderboard.find((e) => e.teamId === "team-b")!;
    const teamC = result.leaderboard.find((e) => e.teamId === "team-c")!;
    expect(teamA.rank).toBe(1);
    expect(teamB.rank).toBe(1);
    expect(teamC.rank).toBe(3); // rank 2 is skipped
  });

  test("dead fish penalty reduces score", () => {
    const input: ScoringInput = {
      catches: [
        { id: "1", teamId: "team-a", speciesId: "bass", weight: 128, length: 15, timestamp: new Date() },
        { id: "2", teamId: "team-a", speciesId: "bass", weight: 96, length: 14, timestamp: new Date(), deadFish: true },
        { id: "3", teamId: "team-b", speciesId: "bass", weight: 112, length: 14.5, timestamp: new Date() },
      ],
      format: "weight",
      options: { deadFishPenalty: 16 }, // 1 lb penalty per dead fish
    };

    const result = calculateStandings(input);

    // team-a: 128 + (96 - 16) = 208
    expect(result.leaderboard[0].teamId).toBe("team-a");
    expect(result.leaderboard[0].score).toBe(208);
    // team-b: 112 (no penalty)
    expect(result.leaderboard[1].teamId).toBe("team-b");
    expect(result.leaderboard[1].score).toBe(112);
  });

  test("dead fish flag ignored when no penalty configured", () => {
    const input: ScoringInput = {
      catches: [
        { id: "1", teamId: "team-a", speciesId: "bass", weight: 100, length: 15, timestamp: new Date(), deadFish: true },
      ],
      format: "weight",
    };

    const result = calculateStandings(input);

    expect(result.leaderboard[0].score).toBe(100); // no penalty applied
  });

  test("dead fish penalty applies in length and count formats", () => {
    const lengthInput: ScoringInput = {
      catches: [
        { id: "1", teamId: "team-a", speciesId: "bass", weight: 100, length: 20, timestamp: new Date(), deadFish: true },
        { id: "2", teamId: "team-b", speciesId: "bass", weight: 100, length: 20, timestamp: new Date() },
      ],
      format: "length",
      options: { deadFishPenalty: 2 }, // 2-inch penalty
    };

    const lengthResult = calculateStandings(lengthInput);
    expect(lengthResult.leaderboard[0].teamId).toBe("team-b");
    expect(lengthResult.leaderboard[0].score).toBe(20);
    expect(lengthResult.leaderboard[1].teamId).toBe("team-a");
    expect(lengthResult.leaderboard[1].score).toBe(18); // 20 - 2

    const countInput: ScoringInput = {
      catches: [
        { id: "1", teamId: "team-a", speciesId: "bass", weight: 100, length: 15, timestamp: new Date(), deadFish: true },
        { id: "2", teamId: "team-a", speciesId: "bass", weight: 100, length: 15, timestamp: new Date() },
        { id: "3", teamId: "team-b", speciesId: "bass", weight: 100, length: 15, timestamp: new Date() },
        { id: "4", teamId: "team-b", speciesId: "bass", weight: 100, length: 15, timestamp: new Date() },
      ],
      format: "count",
      options: { deadFishPenalty: 0.5 }, // half-point penalty per dead fish
    };

    const countResult = calculateStandings(countInput);
    const teamA = countResult.leaderboard.find((e) => e.teamId === "team-a")!;
    const teamB = countResult.leaderboard.find((e) => e.teamId === "team-b")!;
    expect(teamA.score).toBe(1.5); // (1 - 0.5) + 1
    expect(teamB.score).toBe(2);
  });
});
