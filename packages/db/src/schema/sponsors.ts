import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { tournaments } from "./tournaments";

export const sponsorTierEnum = pgEnum("sponsor_tier", ["title", "gold", "silver", "bronze"]);

/**
 * Sponsors table - tenant-scoped
 * A sponsor can be associated with a specific tournament, or be site-wide (tournamentId = null).
 */
export const sponsors = pgTable(
  "sponsors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    tournamentId: uuid("tournament_id").references(() => tournaments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    logoUrl: text("logo_url"),
    website: text("website"),
    tier: sponsorTierEnum("tier").notNull().default("bronze"),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  () => [
    pgPolicy("sponsors_enable_rls", { for: "all", to: "public", using: sql`true` }),
    pgPolicy("sponsors_select_tenant", {
      for: "select",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("sponsors_insert_tenant", {
      for: "insert",
      to: "public",
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("sponsors_update_tenant", {
      for: "update",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("sponsors_delete_tenant", {
      for: "delete",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
  ]
);

export type Sponsor = typeof sponsors.$inferSelect;
export type NewSponsor = typeof sponsors.$inferInsert;
