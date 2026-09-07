/**
 * API route tests: /api/registrations
 *
 * Uses mock.module to replace @tourneyforge/db and drizzle-orm so tests
 * run without a real database connection.
 */
import { describe, test, expect, mock, beforeAll, beforeEach } from "bun:test";
import { Hono } from "hono";

// ─── Controllable result queue ────────────────────────────────────────────────
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
  // Directly awaitable (for queries that end in .where() without a helper)
  chain["then"] = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    pop().then(res, rej);

  return chain;
}

// ─── Module mocks ─────────────────────────────────────────────────────────────
// Note: drizzle-orm is intentionally NOT mocked. The real eq(), and(), count()
// functions build SQL expression objects that are passed to the mocked .where()
// chain and never executed against a real database.

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
  return {
    db: mockDb,
    registrations: {},
    teams: {},
    users: {},
    catches: {},
    tournaments: {},
    species: {},
    tenants: {},
    scoringFormats: {},
    tenantMembers: {},
  };
});

// ─── App setup ────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: Hono<any>;

beforeAll(async () => {
  const { registrationRouter } = await import("../src/routes/registrations");
  app = new Hono();
  app.route("/api/registrations", registrationRouter);
});

beforeEach(() => {
  // LOCAL_DEV assumes a fixed *identity*; the tenant is still resolved from the
  // membership rows queued below, so the boundary is exercised either way.
  process.env["LOCAL_DEV"] = "true";
  process.env["LOCAL_DEV_USER_ID"] = CALLER_ID;
  resultQueue.length = 0;
});

// ─── The real tenant middleware runs on every request ─────────────────────────
// It is deliberately NOT stubbed. Stubbing it would mean these tests never touch the
// boundary they exist to protect, and a stub registered here would leak into
// middleware.test.ts through bun's shared module registry.
//
// The cost is that each request begins with two extra queries — the caller, then their
// memberships — which `pushAuth()` answers. Forgetting it is not silent: the users
// lookup then pops whatever the test queued for the route, finds no `id`, and the
// request 401s instead of quietly shifting every later result by one.
function pushAuth(tenantId: string = TENANT_ID, role = "owner") {
  resultQueue.push([{ id: CALLER_ID }]);            // requireUser  → users
  resultQueue.push([{ tenantId, role }]);           // requireTenant → tenant_members
}

/** For routes behind `requireUser` only, such as catch submission. */
function pushUser() {
  resultQueue.push([{ id: CALLER_ID }]);
}

// ─── Test data ────────────────────────────────────────────────────────────────
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const CALLER_ID  = "user-1";
const TOURNAMENT_ID  = "22222222-2222-4222-8222-222222222222";
const TEAM_ID        = "33333333-3333-4333-8333-333333333333";
const REGISTRATION_ID = "66666666-6666-4666-8666-666666666666";

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

// ─── GET /api/registrations ───────────────────────────────────────────────────
describe("GET /api/registrations", () => {
  test("returns 401 when the caller is unauthenticated", async () => {
    resultQueue.push([]); // requireUser: no such user
    const res = await app.request(`/api/registrations?tournamentId=${TOURNAMENT_ID}`);
    expect(res.status).toBe(401);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  test("returns 400 when tournamentId is not a valid UUID", async () => {
    pushAuth();
    const res = await app.request("/api/registrations?tournamentId=bad-id");
    expect(res.status).toBe(400);
  });

  test("returns registrations scoped to tenant tournament", async () => {
    pushAuth();
    resultQueue.push([{
      id: REGISTRATION_ID, status: "confirmed", paymentStatus: "paid",
      paymentAmount: "5000", createdAt: new Date().toISOString(),
      teamName: "Team A", captainEmail: "captain@example.com",
    }]);

    const res = await app.request(`/api/registrations?tournamentId=${TOURNAMENT_ID}`);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });

  test("returns empty list when no registrations match tenant scope", async () => {
    pushAuth();
    resultQueue.push([]);

    const res = await app.request(`/api/registrations?tournamentId=${TOURNAMENT_ID}`);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(0);
  });
});

// ─── GET /api/registrations/count ────────────────────────────────────────────
describe("GET /api/registrations/count", () => {
  test("returns 401 when the caller is unauthenticated", async () => {
    resultQueue.push([]); // requireUser: no such user
    const res = await app.request(`/api/registrations/count?tournamentId=${TOURNAMENT_ID}`);
    expect(res.status).toBe(401);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  test("returns 400 when tournamentId is not a valid UUID", async () => {
    pushAuth();
    const res = await app.request("/api/registrations/count?tournamentId=bad-id");
    expect(res.status).toBe(400);
  });

  test("returns confirmed registration count for the tenant tournament", async () => {
    pushAuth();
    resultQueue.push([{ value: 7 }]);

    const res = await app.request(`/api/registrations/count?tournamentId=${TOURNAMENT_ID}`);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { count: number } };
    expect(body.data.count).toBe(7);
  });

  test("returns 0 when no confirmed registrations for tenant", async () => {
    pushAuth();
    resultQueue.push([{ value: 0 }]);

    const res = await app.request(`/api/registrations/count?tournamentId=${TOURNAMENT_ID}`);

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { count: number } };
    expect(body.data.count).toBe(0);
  });
});

// ─── PATCH /api/registrations/:id ────────────────────────────────────────────
describe("PATCH /api/registrations/:id", () => {
  test("returns 401 when the caller is unauthenticated", async () => {
    resultQueue.push([]); // requireUser: no such user
    const res = await req("PATCH", `/api/registrations/${REGISTRATION_ID}`, {
      body: { status: "confirmed" },
    });
    expect(res.status).toBe(401);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  test("returns 400 when status value is invalid", async () => {
    pushAuth();
    const res = await req("PATCH", `/api/registrations/${REGISTRATION_ID}`, {
      body: { status: "invalid-status" },
    });
    expect(res.status).toBe(400);
  });

  test("returns 404 when registration not found for tenant", async () => {
    pushAuth();
    resultQueue.push([]); // update returning nothing

    const res = await req("PATCH", `/api/registrations/${REGISTRATION_ID}`, {
      body: { status: "confirmed" },
    });

    expect(res.status).toBe(404);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("updates registration status scoped to tenant", async () => {
    pushAuth();
    const updated = {
      id: REGISTRATION_ID, tenantId: TENANT_ID, teamId: TEAM_ID,
      tournamentId: TOURNAMENT_ID, status: "confirmed",
      paymentStatus: "paid", paymentAmount: "5000",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    resultQueue.push([updated]);

    const res = await req("PATCH", `/api/registrations/${REGISTRATION_ID}`, {
      body: { status: "confirmed", paymentStatus: "paid" },
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { data: { status: string } };
    expect(body.data.status).toBe("confirmed");
  });
});
