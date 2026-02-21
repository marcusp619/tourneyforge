import { Hono } from "hono";
import { db } from "@tourneyforge/db";
import { tenants, tournaments } from "@tourneyforge/db";
import { resolveTheme } from "@tourneyforge/themes";
import { eq, and, ne } from "drizzle-orm";

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
