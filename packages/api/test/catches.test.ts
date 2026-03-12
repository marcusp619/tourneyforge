/**
 * API route tests: /api/catches
 *
 * Uses mock.module to replace @tourneyforge/db and drizzle-orm so tests
 * run without a real database connection.
 */
import { describe, test, expect, mock, beforeAll } from "bun:test";
import { Hono } from "hono";

// ─── Controllable result queue ────────────────────────────────────────────────
// Each DB query in the handler calls the next terminal method (orderBy, limit,
// returning) which pops one entry from this queue.  Tests push expected results
// before making a request.
const resultQueue: unknown[][] = [];

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
  chain["innerJoin"] = pass;
  chain["where"] = pass;
  chain["set"] = pass;
  chain["values"] = pass;
  chain["orderBy"] = term;
  chain["limit"] = term;
  chain["returning"] = term;
  // Make the chain directly awaitable (for queries with no terminal helper)
  chain["then"] = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    pop().then(res, rej);

  return chain;
}

// ─── Module mocks (must be called before dynamic route import) ────────────────
// Note: drizzle-orm is intentionally NOT mocked. The real eq(), and() functions
// build SQL expression objects that are passed to the mocked .where() chain and
// never executed against a real database.

mock.module("@tourneyforge/db", () => {
  const mockDb = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
  };
  // Include all exports used by any route in this test suite so that Bun's
  // named-import validation passes regardless of which mock is active when
  // test files share a module registry.
  return { db: mockDb, catches: {}, tournaments: {}, teams: {}, species: {}, registrations: {}, users: {} };
});

// ─── App setup ────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: Hono<any>;

beforeAll(async () => {
  const { catchRouter } = await import("../src/routes/catches");
  app = new Hono();
  app.route("/api/catches", catchRouter);
});

// ─── Test data ────────────────────────────────────────────────────────────────
const TENANT_ID    = "11111111-1111-1111-1111-111111111111";
const TOURNAMENT_ID = "22222222-2222-2222-2222-222222222222";
const TEAM_ID      = "33333333-3333-3333-3333-333333333333";
const SPECIES_ID   = "44444444-4444-4444-4444-444444444444";
const CATCH_ID     = "55555555-5555-5555-5555-555555555555";

const validBody = {
  tournamentId: TOURNAMENT_ID,
  teamId:       TEAM_ID,
  speciesId:    SPECIES_ID,
  weight:       100,
  length:       15,
};

function req(
  method: string,
  path: string,
  opts: { headers?: Record<string, string>; body?: unknown } = {}
) {
  return app.request(path, {
    method,
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
}

// ─── GET /api/catches ─────────────────────────────────────────────────────────
describe("GET /api/catches", () => {
  test("returns 400 when x-tenant-id header is missing", async () => {
    const res = await app.request(`/api/catches?tournamentId=${TOURNAMENT_ID}`);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  test("returns 400 when tournamentId is not a valid UUID", async () => {
    const res = await app.request("/api/catches?tournamentId=not-a-uuid", {
      headers: { "x-tenant-id": TENANT_ID },
    });
    expect(res.status).toBe(400);
  });

  test("returns catch list scoped to tenant", async () => {
    resultQueue.push([{
      id: CATCH_ID, tenantId: TENANT_ID, tournamentId: TOURNAMENT_ID,
      teamId: TEAM_ID, teamName: "Team A", speciesId: SPECIES_ID,
      speciesName: "Bass", weight: "100", length: "15",
      photoUrl: null, latitude: null, longitude: null,
      verified: "false", verifiedAt: null,
      timestamp: new Date().toISOString(), createdAt: new Date().toISOString(),
    }]);

    const res = await app.request(`/api/catches?tournamentId=${TOURNAMENT_ID}`, {
      headers: { "x-tenant-id": TENANT_ID },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });
});

// ─── POST /api/catches ────────────────────────────────────────────────────────
describe("POST /api/catches", () => {
  test("returns 400 when x-tenant-id header is missing", async () => {
    const res = await req("POST", "/api/catches", { body: validBody });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  test("returns 400 when body is missing required fields", async () => {
    const res = await req("POST", "/api/catches", {
      headers: { "x-tenant-id": TENANT_ID },
      body: { weight: 100 }, // missing tournamentId, teamId, speciesId, length
    });
    expect(res.status).toBe(400);
  });

  test("returns 404 when tournament not found or belongs to different tenant", async () => {
    resultQueue.push([]); // tournament query returns nothing

    const res = await req("POST", "/api/catches", {
      headers: { "x-tenant-id": TENANT_ID },
      body: validBody,
    });

    expect(res.status).toBe(404);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("returns 422 when tournament is not active", async () => {
    resultQueue.push([{ status: "draft", tenantId: TENANT_ID }]);

    const res = await req("POST", "/api/catches", {
      headers: { "x-tenant-id": TENANT_ID },
      body: validBody,
    });

    expect(res.status).toBe(422);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe("TOURNAMENT_NOT_ACTIVE");
  });

  test("returns 422 when team does not belong to the tournament", async () => {
    resultQueue.push([{ status: "active", tenantId: TENANT_ID }]); // tournament ok
    resultQueue.push([]);                                            // team not found

    const res = await req("POST", "/api/catches", {
      headers: { "x-tenant-id": TENANT_ID },
      body: validBody,
    });

    expect(res.status).toBe(422);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_TEAM");
  });

  test("returns 201 with new catch on success", async () => {
    const created = { id: CATCH_ID, tenantId: TENANT_ID, tournamentId: TOURNAMENT_ID };
    resultQueue.push([{ status: "active", tenantId: TENANT_ID }]); // tournament
    resultQueue.push([{ id: TEAM_ID }]);                           // team
    resultQueue.push([created]);                                    // insert returning

    const res = await req("POST", "/api/catches", {
      headers: { "x-tenant-id": TENANT_ID },
      body: validBody,
    });

    expect(res.status).toBe(201);
    const body = await res.json() as { data: { id: string } };
    expect(body.data.id).toBe(CATCH_ID);
  });
});

// ─── PATCH /api/catches/:id/verify ───────────────────────────────────────────
describe("PATCH /api/catches/:id/verify", () => {
  test("returns 400 when x-tenant-id header is missing", async () => {
    const res = await req("PATCH", `/api/catches/${CATCH_ID}/verify`, {
      body: { verified: true },
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  test("returns 404 when catch not found for tenant", async () => {
    resultQueue.push([]); // update returning nothing

    const res = await req("PATCH", `/api/catches/${CATCH_ID}/verify`, {
      headers: { "x-tenant-id": TENANT_ID },
      body: { verified: true },
    });

    expect(res.status).toBe(404);
  });

  test("verifies catch and returns updated record", async () => {
    resultQueue.push([{ id: CATCH_ID, verified: "true", verifiedAt: new Date().toISOString() }]);

    const res = await req("PATCH", `/api/catches/${CATCH_ID}/verify`, {
      headers: { "x-tenant-id": TENANT_ID },
      body: { verified: true },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { verified: string } };
    expect(body.data.verified).toBe("true");
  });

  test("un-verifies catch when verified=false", async () => {
    resultQueue.push([{ id: CATCH_ID, verified: "false", verifiedAt: null }]);

    const res = await req("PATCH", `/api/catches/${CATCH_ID}/verify`, {
      headers: { "x-tenant-id": TENANT_ID },
      body: { verified: false },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { verified: string } };
    expect(body.data.verified).toBe("false");
  });
});

// ─── DELETE /api/catches/:id ──────────────────────────────────────────────────
describe("DELETE /api/catches/:id", () => {
  test("returns 400 when x-tenant-id header is missing", async () => {
    const res = await app.request(`/api/catches/${CATCH_ID}`, { method: "DELETE" });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  test("returns 404 when catch not found for tenant", async () => {
    resultQueue.push([]); // delete returning nothing

    const res = await app.request(`/api/catches/${CATCH_ID}`, {
      method: "DELETE",
      headers: { "x-tenant-id": TENANT_ID },
    });

    expect(res.status).toBe(404);
  });

  test("deletes catch scoped to tenant and returns its id", async () => {
    resultQueue.push([{ id: CATCH_ID }]);

    const res = await app.request(`/api/catches/${CATCH_ID}`, {
      method: "DELETE",
      headers: { "x-tenant-id": TENANT_ID },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { id: string } };
    expect(body.data.id).toBe(CATCH_ID);
  });
});
