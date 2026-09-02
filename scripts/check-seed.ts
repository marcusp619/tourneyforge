#!/usr/bin/env bun
/**
 * Guard for R2 — "seed data must not expire".
 *
 * Asserts the *values* the seed will insert, not how they are spelled. A grep can
 * only see syntax: `scoringFormatId: null` contains the string `scoringFormatId`,
 * and a date literal can be written with single quotes, double quotes or a
 * backtick. This runs the real fixtures instead.
 *
 * Checks:
 *   1. every registrationDeadline is in the future relative to Date.now()
 *   2. at least one tournament is `open` and at least one is `active`
 *   3. every scoringFormatId is non-null AND names a scoring format the seed
 *      actually creates (a dangling uuid is as useless as a null one)
 *   4. the dates really are derived from the clock — advancing `now` by a year
 *      must move every date by a year
 *
 * Run from the repo root:  bun run scripts/check-seed.ts
 *
 * No database is contacted. `@tourneyforge/db` throws at import time when
 * DATABASE_URL is unset, and `postgres()` is lazy, so a syntactically valid but
 * unroutable URL is enough to load the module — the same trick
 * `packages/api/test/setup.ts` uses. Importing `seed.ts` does not seed: the
 * script gates its own execution on being the process entrypoint.
 */

process.env["DATABASE_URL"] ??= "postgresql://check:check@check.invalid/check";

const { seedTournaments, seedScoringFormats, buildSeedTournaments } = await import(
  "../packages/db/src/seed"
);

const failures: string[] = [];
const fail = (message: string): void => {
  failures.push(message);
};

const now = Date.now();
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------- fixtures
if (seedTournaments.length === 0) {
  fail("the seed defines no tournaments at all");
}
if (seedScoringFormats.length === 0) {
  fail("the seed defines no scoring formats at all");
}

const knownFormatIds = new Set(seedScoringFormats.map((format) => format.id));

// ------------------------------------------------- 1 & 3: per-tournament
for (const tournament of seedTournaments) {
  const label = tournament.name || "<unnamed tournament>";

  const deadline = tournament.registrationDeadline;
  if (!(deadline instanceof Date) || Number.isNaN(deadline.getTime())) {
    fail(`${label}: registrationDeadline is not a valid Date`);
  } else if (deadline.getTime() <= now) {
    fail(
      `${label}: registrationDeadline ${deadline.toISOString()} is not in the future — ` +
        "the registration page calls notFound() on this tournament"
    );
  }

  const formatId: unknown = tournament.scoringFormatId;
  if (typeof formatId !== "string" || formatId.length === 0) {
    fail(`${label}: scoringFormatId is null/empty — the leaderboard cannot rank it`);
  } else if (!knownFormatIds.has(formatId)) {
    fail(
      `${label}: scoringFormatId ${formatId} does not match any scoring format the ` +
        `seed creates (known: ${[...knownFormatIds].join(", ")})`
    );
  }
}

// -------------------------------------------------------- 2: statuses present
const statuses = seedTournaments.map((tournament) => tournament.status);
for (const required of ["open", "active"] as const) {
  if (!statuses.includes(required)) {
    fail(`no seeded tournament has status "${required}" (saw: ${statuses.join(", ") || "none"})`);
  }
}

// ------------------------------------------- 4: dates move with the clock
const shifted = buildSeedTournaments(now + YEAR_MS);
if (shifted.length !== seedTournaments.length) {
  fail("buildSeedTournaments returned a different number of tournaments for a shifted clock");
} else {
  for (const [index, base] of seedTournaments.entries()) {
    const moved = shifted[index]!;
    const drift = moved.registrationDeadline.getTime() - base.registrationDeadline.getTime();
    // `seedTournaments` was built a few ms before `now`, so allow a small slop.
    if (Math.abs(drift - YEAR_MS) > 60_000) {
      fail(
        `${base.name}: advancing the clock by a year moved registrationDeadline by ` +
          `${drift}ms — the date is not derived from the supplied clock`
      );
    }
  }
}

// ------------------------------------------------------------------- report
if (failures.length > 0) {
  console.error(`check-seed: ${failures.length} problem(s) in packages/db/src/seed.ts`);
  for (const message of failures) console.error(`  ✗ ${message}`);
  process.exit(1);
}

console.log(
  `check-seed: ok — ${seedTournaments.length} tournaments, ` +
    `${seedScoringFormats.length} scoring formats; ` +
    `statuses [${statuses.join(", ")}]; all deadlines in the future`
);
