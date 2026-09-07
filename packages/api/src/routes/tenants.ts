import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@tourneyforge/db";
import { tenants, tenantMembers } from "@tourneyforge/db";
import { eq, inArray } from "drizzle-orm";
import { createTenantSchema, updateTenantSchema } from "@tourneyforge/validators";
import { requireTenant, requireUser, type TenantEnv } from "../middleware/tenant";

export const tenantRouter = new Hono<TenantEnv>();

/**
 * Columns safe to hand to a caller. `select()` used to return the whole row, which
 * includes `apiKey` and `stripeConnectedAccountId` — `GET /api/tenants` returned both,
 * for every club, to anyone who asked.
 */
export const publicTenantColumns = {
  id: tenants.id,
  name: tenants.name,
  slug: tenants.slug,
  plan: tenants.plan,
  logoUrl: tenants.logoUrl,
  customDomain: tenants.customDomain,
  themePreset: tenants.themePreset,
  primaryColor: tenants.primaryColor,
  accentColor: tenants.accentColor,
  fontFamily: tenants.fontFamily,
  heroImageUrl: tenants.heroImageUrl,
  tagline: tenants.tagline,
  aboutText: tenants.aboutText,
  rulesText: tenants.rulesText,
  createdAt: tenants.createdAt,
  updatedAt: tenants.updatedAt,
} as const;

// GET /api/tenants — the clubs the caller belongs to. This was "all tenants (admin
// only - will add auth middleware later)"; the middleware never arrived and it listed
// every club on the platform, secrets included.
tenantRouter.get("/", requireUser, async (c) => {
  const memberships = await db
    .select({ tenantId: tenantMembers.tenantId })
    .from(tenantMembers)
    .where(eq(tenantMembers.userId, c.get("userId")));

  if (memberships.length === 0) return c.json({ data: [] });

  const mine = await db
    .select(publicTenantColumns)
    .from(tenants)
    .where(inArray(tenants.id, memberships.map((m) => m.tenantId)));

  return c.json({ data: mine });
});

// GET /api/tenants/:slug — public: the tenant site renders from this.
tenantRouter.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const [tenant] = await db
    .select(publicTenantColumns)
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant) {
    return c.json({ error: { code: "NOT_FOUND", message: "Tenant not found" } }, 404);
  }

  return c.json({ data: tenant });
});

// POST /api/tenants — create a club. The creator becomes its owner in the same
// transaction; a tenant with no members would be unreachable through the boundary.
tenantRouter.post("/", requireUser, zValidator("json", createTenantSchema), async (c) => {
  const body = c.req.valid("json");
  const userId = c.get("userId");

  const created = await db.transaction(async (tx) => {
    const [tenant] = await tx
      .insert(tenants)
      .values({ name: body.name, slug: body.slug })
      .returning(publicTenantColumns);
    await tx.insert(tenantMembers).values({
      tenantId: tenant!.id,
      userId,
      role: "owner",
    });
    return tenant;
  });

  return c.json({ data: created }, 201);
});

// PATCH /api/tenants/:id
tenantRouter.patch(
  "/:id",
  requireUser,
  requireTenant,
  zValidator("json", updateTenantSchema),
  async (c) => {
    const id = c.req.param("id");
    const tenantId = c.get("tenantId");
    if (id !== tenantId) {
      return c.json(
        { error: { code: "FORBIDDEN", message: "Not a member of that tenant" } },
        403
      );
    }

    const body = c.req.valid("json");
    // `plan` is deliberately dropped. It is in `updateTenantSchema`, so before auth
    // existed this endpoint let anyone move any club onto the enterprise plan — and
    // with auth it would still let a club upgrade itself for free. Billing sets it.
    const updated = await db
      .update(tenants)
      .set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.slug !== undefined && { slug: body.slug }),
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning(publicTenantColumns);

    if (!updated.length) {
      return c.json({ error: { code: "NOT_FOUND", message: "Tenant not found" } }, 404);
    }

    return c.json({ data: updated[0] });
  }
);
