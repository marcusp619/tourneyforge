/**
 * The tenant boundary itself.
 *
 * `auth-stub.ts` replaces this module for the route tests, and bun shares one module
 * registry across the files in a run — so if that stub ever leaked into this file, these
 * tests would be asserting against the stub and would pass while proving nothing. The
 * first test below exists to catch exactly that: the stub ignores `x-tenant-id`
 * entirely, so a forged header would sail through it with a 200.
 */
import { describe, test, expect, mock, beforeAll, afterEach } from "bun:test";
import { Hono } from "hono";

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
  chain["then"] = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    pop().then(res, rej);
  return chain;
}

mock.module("@tourneyforge/db", () => {
  const mockDb = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
  };
  return {
    db: mockDb, catches: {}, tournaments: {}, teams: {}, species: {},
    registrations: {}, users: {}, tenants: {}, scoringFormats: {},
    tenantMembers: {},
  };
});

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_ID = "user-1";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: Hono<any>;

beforeAll(async () => {
  const { requireUser, requireTenant } = await import("../src/middleware/tenant");
  app = new Hono();
  // A probe route that reports what the middleware resolved, so a test can tell
  // "denied" apart from "allowed, but scoped to a different club" — which an empty
  // 200 body could not.
  app.get("/probe", requireUser, requireTenant, (c) =>
    c.json({ userId: c.get("userId"), tenantId: c.get("tenantId"), role: c.get("tenantRole") })
  );
  app.get("/probe-user", requireUser, (c) => c.json({ userId: c.get("userId") }));
});

const envBackup = { ...process.env };
afterEach(() => {
  resultQueue.length = 0;
  process.env["LOCAL_DEV"] = envBackup["LOCAL_DEV"];
  process.env["CLERK_SECRET_KEY"] = envBackup["CLERK_SECRET_KEY"];
  process.env["LOCAL_DEV_USER_ID"] = envBackup["LOCAL_DEV_USER_ID"];
});

function localDev() {
  process.env["LOCAL_DEV"] = "true";
}

describe("requireTenant", () => {
  test("a forged x-tenant-id the caller is not a member of is denied", async () => {
    localDev();
    resultQueue.push([{ id: USER_ID }]);                         // requireUser
    resultQueue.push([{ tenantId: TENANT_A, role: "owner" }]);   // memberships

    const res = await app.request("/probe", { headers: { "x-tenant-id": TENANT_B } });

    // Not 200-with-tenant-A. Denied.
    expect(res.status).toBe(403);
    const body = await res.json() as { error: { code: string } };
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("an x-tenant-id the caller IS a member of is honoured", async () => {
    localDev();
    resultQueue.push([{ id: USER_ID }]);
    resultQueue.push([
      { tenantId: TENANT_A, role: "owner" },
      { tenantId: TENANT_B, role: "admin" },
    ]);

    const res = await app.request("/probe", { headers: { "x-tenant-id": TENANT_B } });

    expect(res.status).toBe(200);
    const body = await res.json() as { tenantId: string; role: string };
    expect(body.tenantId).toBe(TENANT_B);
    expect(body.role).toBe("admin");
  });

  test("a single membership needs no header", async () => {
    localDev();
    resultQueue.push([{ id: USER_ID }]);
    resultQueue.push([{ tenantId: TENANT_A, role: "owner" }]);

    const res = await app.request("/probe");

    expect(res.status).toBe(200);
    expect((await res.json() as { tenantId: string }).tenantId).toBe(TENANT_A);
  });

  test("several memberships and no header is a 400, not a silent pick", async () => {
    localDev();
    resultQueue.push([{ id: USER_ID }]);
    resultQueue.push([
      { tenantId: TENANT_A, role: "owner" },
      { tenantId: TENANT_B, role: "admin" },
    ]);

    const res = await app.request("/probe");

    expect(res.status).toBe(400);
    expect((await res.json() as { error: { code: string } }).error.code).toBe("TENANT_REQUIRED");
  });

  test("an authenticated caller who belongs to no club is denied", async () => {
    localDev();
    resultQueue.push([{ id: USER_ID }]);
    resultQueue.push([]); // no memberships

    const res = await app.request("/probe");

    expect(res.status).toBe(403);
  });
});

describe("requireUser", () => {
  test("no Authorization header and no LOCAL_DEV is a 401", async () => {
    delete process.env["LOCAL_DEV"];
    const res = await app.request("/probe-user");
    expect(res.status).toBe(401);
    expect((await res.json() as { error: { code: string } }).error.code).toBe("UNAUTHENTICATED");
  });

  test("a bearer token with no CLERK_SECRET_KEY configured is a 401, not a pass", async () => {
    delete process.env["LOCAL_DEV"];
    delete process.env["CLERK_SECRET_KEY"];
    const res = await app.request("/probe-user", {
      headers: { authorization: "Bearer some.jwt.token" },
    });
    expect(res.status).toBe(401);
  });

  test("a garbage bearer token is a 401", async () => {
    delete process.env["LOCAL_DEV"];
    process.env["CLERK_SECRET_KEY"] = "sk_test_not_a_real_key";
    const res = await app.request("/probe-user", {
      headers: { authorization: "Bearer not-a-jwt" },
    });
    expect(res.status).toBe(401);
  });

  test("LOCAL_DEV still requires the dev identity to be a real user", async () => {
    localDev();
    process.env["LOCAL_DEV_USER_ID"] = "nobody";
    resultQueue.push([]); // users lookup finds nothing

    const res = await app.request("/probe-user");

    expect(res.status).toBe(401);
  });

  test("LOCAL_DEV resolves the configured dev identity", async () => {
    localDev();
    resultQueue.push([{ id: USER_ID }]);

    const res = await app.request("/probe-user");

    expect(res.status).toBe(200);
    expect((await res.json() as { userId: string }).userId).toBe(USER_ID);
  });
});
