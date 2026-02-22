import { boolean, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const marketplaceBudgetTierEnum = pgEnum("marketplace_budget_tier", [
  "local",      // < $500 per tournament
  "regional",   // $500 – $2,500
  "national",   // $2,500+
]);

/**
 * marketplace_sponsors — System table (no RLS)
 *
 * Companies / brands that want to sponsor fishing tournaments on TourneyForge.
 * Tournament directors can browse this directory and reach out to potential sponsors.
 * Sponsors can self-register via POST /api/marketplace/sponsors.
 */
export const marketplaceSponsors = pgTable("marketplace_sponsors", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Company / brand name */
  name: text("name").notNull(),
  /** Short brand description */
  description: text("description"),
  /** Brand logo URL (public) */
  logoUrl: text("logo_url"),
  /** Brand website */
  website: text("website"),
  /** Primary contact email for tournament directors to reach out */
  contactEmail: text("contact_email").notNull(),
  /** Comma-separated categories, e.g. "tackle,apparel,electronics" */
  categories: text("categories").notNull().default(""),
  /** Sponsorship budget range */
  budgetTier: marketplaceBudgetTierEnum("budget_tier").notNull().default("local"),
  /** Platform admin can feature a sponsor to surface them first */
  featured: boolean("featured").notNull().default(false),
  /** Active/inactive flag — admin moderation */
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type MarketplaceSponsor = typeof marketplaceSponsors.$inferSelect;
export type NewMarketplaceSponsor = typeof marketplaceSponsors.$inferInsert;
