import { Hono } from "hono";
import { db } from "@tourneyforge/db";
import { tenants, tournaments, teams, scoringFormats } from "@tourneyforge/db";
import { resolveTheme } from "@tourneyforge/themes";
import { eq, and, ne, or } from "drizzle-orm";

export const publicRouter = new Hono();

/**
 * GET /api/public/tenants/:slug
 * Returns safe public profile for a tenant — no auth required.
 * Used by the Next.js tenant site pages.
 */
publicRouter.get("/tenants/:slug", async (c) => {
  const slug = c.req.param("slug");

  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      logoUrl: tenants.logoUrl,
      tagline: tenants.tagline,
      themePreset: tenants.themePreset,
      primaryColor: tenants.primaryColor,
      accentColor: tenants.accentColor,
      fontFamily: tenants.fontFamily,
      heroImageUrl: tenants.heroImageUrl,
    })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant) {
    return c.json({ error: { code: "NOT_FOUND", message: "Tenant not found" } }, 404);
  }

  const theme = resolveTheme(tenant);

  return c.json({ data: { ...tenant, resolvedTheme: theme } });
});

/**
 * GET /api/public/tenants/:slug/tournaments
 * Returns all published (non-draft) tournaments for a tenant.
 */
publicRouter.get("/tenants/:slug/tournaments", async (c) => {
  const slug = c.req.param("slug");

  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant) {
    return c.json({ error: { code: "NOT_FOUND", message: "Tenant not found" } }, 404);
  }

  const publishedTournaments = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      description: tournaments.description,
      startDate: tournaments.startDate,
      endDate: tournaments.endDate,
      registrationDeadline: tournaments.registrationDeadline,
      status: tournaments.status,
    })
    .from(tournaments)
    .where(
      and(
        eq(tournaments.tenantId, tenant.id),
        ne(tournaments.status, "draft")
      )
    );

  return c.json({ data: publishedTournaments });
});

/**
 * GET /api/public/tournaments/:id
 * Returns a single tournament by ID with scoring format info.
 * Used by the mobile app tournament detail screen.
 */
publicRouter.get("/tournaments/:id", async (c) => {
  const id = c.req.param("id");

  const [tournament] = await db
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
      scoringFormatId: tournaments.scoringFormatId,
    })
    .from(tournaments)
    .where(eq(tournaments.id, id))
    .limit(1);

  if (!tournament) {
    return c.json({ error: { code: "NOT_FOUND", message: "Tournament not found" } }, 404);
  }

  let scoringFormatType: string | null = null;
  if (tournament.scoringFormatId) {
    const [fmt] = await db
      .select({ type: scoringFormats.type, name: scoringFormats.name })
      .from(scoringFormats)
      .where(eq(scoringFormats.id, tournament.scoringFormatId))
      .limit(1);
    if (fmt) scoringFormatType = fmt.type;
  }

  return c.json({ data: { ...tournament, scoringFormatType } });
});

/**
 * GET /api/public/tournaments
 * Returns all open and active tournaments across all tenants.
 * Used by the mobile app tournaments tab.
 */
publicRouter.get("/tournaments", async (c) => {
  const allTournaments = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      status: tournaments.status,
      startDate: tournaments.startDate,
      endDate: tournaments.endDate,
      entryFee: tournaments.entryFee,
    })
    .from(tournaments)
    .where(or(eq(tournaments.status, "open"), eq(tournaments.status, "active")));

  return c.json({ data: allTournaments });
});

/**
 * GET /api/public/teams?tournamentId=
 * Returns teams for a given tournament.
 * Used by the mobile app catch submission screen.
 */
publicRouter.get("/teams", async (c) => {
  const tournamentId = c.req.query("tournamentId");
  if (!tournamentId) {
    return c.json({ error: { code: "BAD_REQUEST", message: "tournamentId is required" } }, 400);
  }

  const tournamentTeams = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.tournamentId, tournamentId));

  return c.json({ data: tournamentTeams });
});
