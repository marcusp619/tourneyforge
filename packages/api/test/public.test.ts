/**
 * API route tests: /api/public/*
 *
 * Uses mock.module to replace @tourneyforge/db so tests run without a real
 * database connection (no Docker, no Postgres — same contract as the other
 * suites in this directory).
 *
 * ── Why these tests assert on the WHERE clause ───────────────────────────────
 * The mocked db ignores every filter and returns whatever is queued, so a test
 * shaped "push a soft-deleted row, expect it absent" would pass with the filter
 * deleted. It would assert nothing.
 *
 * Instead these tests inspect the drizzle SQL object handed to .where() and
 * assert the `is null` chunk is really there. Delete `isNull(deletedAt)` from
 * the route and these go red. Proof that the filter *behaves* correctly against
 * real rows is the live mutation check in docs/NIGHTLY.md, not this file.
 */
import { describe, test, expect, mock, beforeAll, beforeEach } from "bun:test";
import { Hono } from "hono";

// ─── Controllable result queue + call recorder ───────────────────────────────
const resultQueue: unknown[][] = [];
const calls: { innerJoin: number; where: unknown[] } = { innerJoin: 0, where: [] };

function makeChain() {
  let consumed = false;
  const pop = (): Promise<unknown[]> => {
    if (consumed) return Promise.resolve([]);
    consumed = true;
    return Promise.resolve((resultQueue.shift() as unknown[]) ?? []);
  };

  const chain: Record<string, unknown> = {};
  const pass = (..._: unknown[]) => chain;
  const term = (..._: unknown[]) => pop();

  chain["from"] = pass;
  chain["innerJoin"] = (..._: unknown[]) => { calls.innerJoin += 1; return chain; };
  chain["where"] = (arg: unknown) => { calls.where.push(arg); return chain; };
  chain["orderBy"] = term;
  chain["limit"] = term;
  chain["then"] = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    pop().then(res, rej);

  return chain;
}

/**
 * Flattens a drizzle SQL expression into its literal string fragments, e.g.
 * `and(eq(a,b), isNull(c))` -> "( = ) and ( is null)". Lets a test assert that
 * a filter is present without depending on a live database.
 */
function sqlText(expr: unknown): string {
  const out: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (x: any): void => {
    if (!x || typeof x !== "object") return;
    if (typeof x.value === "string") out.push(x.value);
    else if (Array.isArray(x.value)) {
      for (const v of x.value) if (typeof v === "string") out.push(v);
    }
    if (Array.isArray(x.queryChunks)) for (const c of x.queryChunks) walk(c);
  };
  walk(expr);
  return out.join("");
}

mock.module("@tourneyforge/db", () => {
  const mockDb = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
  };
  return {
    db: mockDb,
    tenants: {},
    tournaments: {},
    teams: {},
    scoringFormats: {},
    registrations: {},
    users: {},
    catches: {},
    species: {},
  };
});

// ─── App setup ────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: Hono<any>;

beforeAll(async () => {
  const { publicRouter } = await import("../src/routes/public");
  app = new Hono();
  app.route("/api/public", publicRouter);
});

beforeEach(() => {
  resultQueue.length = 0;
  calls.innerJoin = 0;
  calls.where.length = 0;
});

// UUIDs must be valid v4 — an invalid one 400s before the handler runs and
// leaves the queue undrained, poisoning the next test.
const TENANT_ID     = "11111111-1111-4111-8111-111111111111";
const TOURNAMENT_ID = "22222222-2222-4222-8222-222222222222";

const tournamentRow = {
  id: TOURNAMENT_ID,
  name: "Spring Bass Classic",
  status: "open",
  startDate: "2026-10-01T12:00:00.000Z",
  endDate: "2026-10-02T12:00:00.000Z",
  entryFee: 5000,
  tenantSlug: "midwest-bass",
  tenantName: "Midwest Bass Trail",
  tenantLogoUrl: null,
};

// ─── GET /api/public/tournaments ─────────────────────────────────────────────
describe("GET /api/public/tournaments", () => {
  test("filters out soft-deleted tournaments", async () => {
    resultQueue.push([tournamentRow]);
    const res = await app.request("/api/public/tournaments");

    expect(res.status).toBe(200);
    expect(calls.where).toHaveLength(1);
    expect(sqlText(calls.where[0])).toContain("is null");
  });

  test("still filters on open/active status", async () => {
    resultQueue.push([]);
    await app.request("/api/public/tournaments");
    // two equality comparisons OR'd together, plus the deleted_at guard
    expect(sqlText(calls.where[0])).toContain(" or ");
  });

  test("joins the owning tenant so every row is club-attributed", async () => {
    resultQueue.push([tournamentRow]);
    const res = await app.request("/api/public/tournaments");

    expect(calls.innerJoin).toBe(1);
    const body = await res.json() as { data: Array<Record<string, unknown>> };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toHaveProperty("tenantSlug", "midwest-bass");
    expect(body.data[0]).toHaveProperty("tenantName", "Midwest Bass Trail");
  });

  test("returns an empty list rather than erroring when nothing is open", async () => {
    resultQueue.push([]);
    const res = await app.request("/api/public/tournaments");
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(0);
  });
});

// ─── GET /api/public/tournaments/:id ─────────────────────────────────────────
describe("GET /api/public/tournaments/:id", () => {
  test("excludes soft-deleted tournaments from the lookup", async () => {
    resultQueue.push([{ ...tournamentRow, scoringFormatId: null }]);
    await app.request(`/api/public/tournaments/${TOURNAMENT_ID}`);
    expect(sqlText(calls.where[0])).toContain("is null");
  });

  test("404s when the tournament does not resolve", async () => {
    resultQueue.push([]);
    const res = await app.request(`/api/public/tournaments/${TOURNAMENT_ID}`);
    expect(res.status).toBe(404);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("carries club identity on the detail payload", async () => {
    resultQueue.push([{ ...tournamentRow, scoringFormatId: null }]);
    const res = await app.request(`/api/public/tournaments/${TOURNAMENT_ID}`);

    expect(calls.innerJoin).toBe(1);
    const body = await res.json() as { data: Record<string, unknown> };
    expect(body.data["tenantName"]).toBe("Midwest Bass Trail");
    expect(body.data["scoringFormatType"]).toBeNull();
  });
});

// ─── GET /api/public/tenants/:slug/tournaments ───────────────────────────────
describe("GET /api/public/tenants/:slug/tournaments", () => {
  test("excludes soft-deleted tournaments from a club's own listing", async () => {
    resultQueue.push([{ id: TENANT_ID }]);  // tenant lookup
    resultQueue.push([tournamentRow]);      // tournaments
    const res = await app.request("/api/public/tenants/midwest-bass/tournaments");

    expect(res.status).toBe(200);
    // where[0] is the tenant slug lookup, where[1] is the tournaments filter
    expect(calls.where).toHaveLength(2);
    expect(sqlText(calls.where[1])).toContain("is null");
  });

  test("404s for an unknown club slug", async () => {
    resultQueue.push([]);
    const res = await app.request("/api/public/tenants/nope/tournaments");
    expect(res.status).toBe(404);
  });
});

// ─── GET /api/public/teams ───────────────────────────────────────────────────
describe("GET /api/public/teams", () => {
  test("400s without a tournamentId", async () => {
    const res = await app.request("/api/public/teams");
    expect(res.status).toBe(400);
  });

  test("does NOT filter on deleted_at — the teams table has no such column", async () => {
    // Guards against 'fixing' this route by symmetry with the tournaments
    // routes. packages/db/src/schema/teams-catches.ts:8 — teams has createdAt
    // only; soft deletes landed on catches, tournaments, scoringFormats,
    // sponsors and tournamentDivisions, never teams. Adding isNull here would
    // not typecheck.
    resultQueue.push([]);
    await app.request(`/api/public/teams?tournamentId=${TOURNAMENT_ID}`);
    expect(sqlText(calls.where[0])).not.toContain("is null");
  });
});
