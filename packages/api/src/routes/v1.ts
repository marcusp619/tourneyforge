import { Hono } from "hono";
import { db, tenants, tournaments, teams, catches, species, registrations } from "@tourneyforge/db";
import { eq, and, count } from "drizzle-orm";
import { calculateStandings } from "@tourneyforge/scoring";
import type { ScoringInput } from "@tourneyforge/scoring";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// 100 requests / 60s per API key — gracefully degrades if Redis is unconfigured
function getRatelimiter(): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(100, "60 s"),
    prefix: "tf:v1:rl",
    analytics: false,
  });
}

/**
 * Public API v1 — Enterprise plan only
 *
 * Authentication: `x-api-key: <tenant api key>` header
 *
 * Routes:
 *   GET /api/v1/tournaments
 *   GET /api/v1/tournaments/:id
 *   GET /api/v1/tournaments/:id/leaderboard
 *   GET /api/v1/tournaments/:id/registrations
 */
export const v1Router = new Hono();

// ── Middleware: API key auth ──────────────────────────────────────────────────

v1Router.use("*", async (c, next) => {
  const apiKey = c.req.header("x-api-key");
  if (!apiKey) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Missing x-api-key header" } }, 401);
  }

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.apiKey, apiKey))
    .limit(1);

  if (!tenant) {
    return c.json({ error: { code: "UNAUTHORIZED", message: "Invalid API key" } }, 401);
  }

  if (tenant.plan !== "enterprise") {
    return c.json(
      { error: { code: "FORBIDDEN", message: "Public API access requires the Enterprise plan" } },
      403
    );
  }

  // Store tenant in context for downstream handlers
  c.set("tenant" as never, tenant);

  // Rate limiting: 100 req/min per API key
  const rl = getRatelimiter();
  if (rl) {
    const { success, limit, remaining, reset } = await rl.limit(apiKey);
    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(reset));
    if (!success) {
      return c.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests. Limit: 100 per minute." } },
        429
      );
    }
  }

  return next();
});

// ── GET /api/v1/tournaments ───────────────────────────────────────────────────

v1Router.get("/tournaments", async (c) => {
  const tenant = c.get("tenant" as never) as typeof tenants.$inferSelect;

  const rows = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      description: tournaments.description,
      status: tournaments.status,
      startDate: tournaments.startDate,
      endDate: tournaments.endDate,
      registrationDeadline: tournaments.registrationDeadline,
      entryFee: tournaments.entryFee,
      maxTeams: tournaments.maxTeams,
    })
    .from(tournaments)
    .where(eq(tournaments.tenantId, tenant.id));

  return c.json({ data: rows });
});

// ── GET /api/v1/tournaments/:id ───────────────────────────────────────────────

v1Router.get("/tournaments/:id", async (c) => {
  const tenant = c.get("tenant" as never) as typeof tenants.$inferSelect;
  const id = c.req.param("id");

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(and(eq(tournaments.id, id), eq(tournaments.tenantId, tenant.id)))
    .limit(1);

  if (!tournament) {
    return c.json({ error: { code: "NOT_FOUND", message: "Tournament not found" } }, 404);
  }

  const [regCount] = await db
    .select({ value: count() })
    .from(registrations)
    .where(and(eq(registrations.tournamentId, id), eq(registrations.paymentStatus, "paid")));

  return c.json({
    data: {
      ...tournament,
      registrationCount: regCount?.value ?? 0,
    },
  });
});

// ── GET /api/v1/tournaments/:id/leaderboard ───────────────────────────────────

v1Router.get("/tournaments/:id/leaderboard", async (c) => {
  const tenant = c.get("tenant" as never) as typeof tenants.$inferSelect;
  const id = c.req.param("id");

  const [tournament] = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(and(eq(tournaments.id, id), eq(tournaments.tenantId, tenant.id)))
    .limit(1);

  if (!tournament) {
    return c.json({ error: { code: "NOT_FOUND", message: "Tournament not found" } }, 404);
  }

  const catchRows = await db
    .select({
      id: catches.id,
      teamId: catches.teamId,
      speciesId: catches.speciesId,
      weight: catches.weight,
      length: catches.length,
      timestamp: catches.timestamp,
    })
    .from(catches)
    .innerJoin(species, eq(species.id, catches.speciesId))
    .where(and(eq(catches.tournamentId, id), eq(catches.verified, "true")));

  const scoringInput: ScoringInput = {
    format: "weight",
    catches: catchRows.map((cat) => ({
      id: cat.id,
      teamId: cat.teamId,
      speciesId: cat.speciesId,
      weight: Number(cat.weight),
      length: Number(cat.length),
      timestamp: cat.timestamp,
    })),
  };

  const result = calculateStandings(scoringInput);

  return c.json({ data: result.leaderboard });
});

// ── GET /api/v1/tournaments/:id/registrations ─────────────────────────────────

v1Router.get("/tournaments/:id/registrations", async (c) => {
  const tenant = c.get("tenant" as never) as typeof tenants.$inferSelect;
  const id = c.req.param("id");

  const [tournament] = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(and(eq(tournaments.id, id), eq(tournaments.tenantId, tenant.id)))
    .limit(1);

  if (!tournament) {
    return c.json({ error: { code: "NOT_FOUND", message: "Tournament not found" } }, 404);
  }

  const rows = await db
    .select({
      id: registrations.id,
      teamId: registrations.teamId,
      teamName: teams.name,
      status: registrations.status,
      paymentStatus: registrations.paymentStatus,
      createdAt: registrations.createdAt,
    })
    .from(registrations)
    .innerJoin(teams, eq(teams.id, registrations.teamId))
    .where(
      and(eq(registrations.tournamentId, id), eq(registrations.paymentStatus, "paid"))
    );

  return c.json({ data: rows });
});
