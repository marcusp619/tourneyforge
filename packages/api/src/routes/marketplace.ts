import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@tourneyforge/db";
import { tournaments, tenants, marketplaceSponsors } from "@tourneyforge/db";
import { eq, or, desc, and } from "drizzle-orm";

export const marketplaceRouter = new Hono();

// ── GET /api/marketplace/tournaments ──────────────────────────────────────────
//
// Public discovery: all open + upcoming (open) tournaments across all tenants.
// Returns tenant branding so the UI can show logos / colors.
// No auth required.

marketplaceRouter.get("/tournaments", async (c) => {
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
      // Tenant branding
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      tenantLogoUrl: tenants.logoUrl,
      tenantPrimaryColor: tenants.primaryColor,
    })
    .from(tournaments)
    .innerJoin(tenants, eq(tenants.id, tournaments.tenantId))
    .where(or(eq(tournaments.status, "open"), eq(tournaments.status, "active")))
    .orderBy(desc(tournaments.startDate));

  return c.json({ data: rows });
});

// ── GET /api/marketplace/sponsors ─────────────────────────────────────────────
//
// Browse sponsor brands looking to sponsor fishing tournaments.
// Featured sponsors appear first. No auth required.

marketplaceRouter.get("/sponsors", async (c) => {
  const category = c.req.query("category");
  const budget = c.req.query("budget") as "local" | "regional" | "national" | undefined;

  let query = db
    .select()
    .from(marketplaceSponsors)
    .where(eq(marketplaceSponsors.active, true))
    .$dynamic();

  if (budget) {
    query = query.where(
      and(
        eq(marketplaceSponsors.active, true),
        eq(marketplaceSponsors.budgetTier, budget)
      )
    );
  }

  const rows = await query.orderBy(
    desc(marketplaceSponsors.featured),
    desc(marketplaceSponsors.createdAt)
  );

  // Apply category filter in-memory (categories is a comma-separated text column)
  const filtered =
    category
      ? rows.filter((r) =>
          r.categories
            .split(",")
            .map((c) => c.trim().toLowerCase())
            .includes(category.toLowerCase())
        )
      : rows;

  return c.json({ data: filtered });
});

// ── POST /api/marketplace/sponsors ────────────────────────────────────────────
//
// Self-registration for a brand / company wanting to sponsor tournaments.
// Starts inactive (pending admin review) unless self-activating for dev.

const registerSponsorSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  contactEmail: z.string().email(),
  categories: z.array(z.string().min(1).max(50)).min(1).max(10),
  budgetTier: z.enum(["local", "regional", "national"]),
});

marketplaceRouter.post(
  "/sponsors",
  zValidator("json", registerSponsorSchema),
  async (c) => {
    const body = c.req.valid("json");

    const [created] = await db
      .insert(marketplaceSponsors)
      .values({
        name: body.name,
        description: body.description,
        logoUrl: body.logoUrl,
        website: body.website,
        contactEmail: body.contactEmail,
        categories: body.categories.join(","),
        budgetTier: body.budgetTier,
        // New listings start inactive — platform admin approves them
        active: false,
        featured: false,
      })
      .returning();

    return c.json(
      {
        data: created,
        message:
          "Your listing has been submitted for review. We will activate it within 1–2 business days.",
      },
      201
    );
  }
);
