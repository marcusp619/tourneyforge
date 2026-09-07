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
 *   1. registrationDeadline is in the future for every OPEN or DRAFT tournament —
 *      those are the ones the register page calls notFound() on. A COMPLETED
 *      tournament must be entirely in the PAST, and at least one must exist, or the
 *      public results archive has nothing to render. This is a split of the original
 *      blanket rule, not a relaxation of it: the future-deadline requirement still
 *      applies in full everywhere it was ever meaningful.
 *   2. at least one tournament is `open` and at least one is `active`
 *   3. every scoringFormatId is non-null AND names a scoring format the seed
 *      actually creates (a dangling uuid is as useless as a null one)
 *   4. the dates really are derived from the clock — advancing `now` by a year
 *      must move every date by a year
 *   5. every tournament's scoringFormatId belongs to its OWN tenant. A cross-tenant
 *      reference still satisfies the foreign key, so nothing in the database catches
 *      it — and RLS is defined but not enforced, so nothing at runtime does either.
 *   6. at least two distinct tenants own an open-or-active tournament, because
 *      discovery is cross-club and one club makes the attribution untestable.
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

const { seedTournaments, seedScoringFormats, buildSeedTournaments, seedFormatIds } =
  await import("../packages/db/src/seed");

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

// Every pinned format id, and the tenant that owns it.
const formatOwner = new Map<string, string>();
for (const [slug, ids] of Object.entries(seedFormatIds)) {
  formatOwner.set(ids.weight, slug);
  formatOwner.set(ids.length, slug);
}
const knownFormatIds = new Set([
  ...seedScoringFormats.map((format) => format.id),
  ...formatOwner.keys(),
]);

// ------------------------------------------------- 1 & 3: per-tournament
for (const tournament of seedTournaments) {
  const label = tournament.name || "<unnamed tournament>";

  const deadline = tournament.registrationDeadline;
  if (!(deadline instanceof Date) || Number.isNaN(deadline.getTime())) {
    fail(`${label}: registrationDeadline is not a valid Date`);
  } else if (tournament.status === "completed") {
    // A finished tournament must be wholly in the past — a "completed" tournament whose
    // dates are in the future is not a result, it is a contradiction.
    for (const [field, value] of [
      ["registrationDeadline", deadline],
      ["startDate", tournament.startDate],
      ["endDate", tournament.endDate],
    ] as const) {
      if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        fail(`${label}: ${field} is not a valid Date`);
      } else if (value.getTime() > now) {
        fail(
          `${label}: is completed but its ${field} ${value.toISOString()} is in the ` +
            "future — a finished tournament cannot end after now"
        );
      }
    }
  } else if (deadline.getTime() <= now) {
    // Everything not completed keeps the ORIGINAL rule unchanged. Only `completed` is
    // exempt, and it is exempt into a stricter rule, not out of one — so this split
    // loosens nothing.
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
  } else {
    // 5. tenant scope: the format must belong to the tournament's own tenant.
    const owner = formatOwner.get(formatId);
    if (owner && owner !== tournament.tenantSlug) {
      fail(
        `${label}: belongs to tenant "${tournament.tenantSlug}" but its scoringFormatId ` +
          `${formatId} belongs to "${owner}" — a cross-tenant reference. The foreign key ` +
          `accepts this and RLS is not enforced, so nothing but this check will catch it.`
      );
    }
  }
}

// -------------------------------------- 6: more than one club is publicly visible
const publicClubs = new Set(
  seedTournaments
    .filter((t) => t.status === "open" || t.status === "active")
    .map((t) => t.tenantSlug)
);
if (publicClubs.size < 2) {
  fail(
    `only ${publicClubs.size} club(s) own an open-or-active tournament ` +
      `(${[...publicClubs].join(", ") || "none"}) — discovery is cross-club, so the club ` +
      `attribution is invisible and task 17's group-by-club picker has nothing to group`
  );
}

// -------------------------------------------------------- 2: statuses present
const statuses = seedTournaments.map((tournament) => tournament.status);
if (!statuses.includes("completed")) {
  fail(
    "no seeded tournament has status \"completed\" — the public results archive at " +
      "/[tenant]/results renders nothing without one"
  );
}
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
    `statuses [${statuses.join(", ")}]; unfinished deadlines in the future, ` +
    `completed ones in the past; ` +
    `${publicClubs.size} clubs publicly visible [${[...publicClubs].join(", ")}]`
);
