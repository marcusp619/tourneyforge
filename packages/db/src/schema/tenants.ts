import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const tenantPlanEnum = pgEnum("tenant_plan", ["free", "starter", "pro", "enterprise"]);

/**
 * Tenants table - multi-tenant organization
 * RLS enabled: users can only read/update their own tenant
 */
export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    plan: tenantPlanEnum("plan").notNull().default("free"),
    logoUrl: text("logo_url"),
    customDomain: text("custom_domain").unique(),
    // Theming
    themePreset: text("theme_preset").notNull().default("classic"),
    primaryColor: text("primary_color"),   // hex override, null = use preset
    accentColor: text("accent_color"),     // hex override, null = use preset
    fontFamily: text("font_family"),       // override, null = use preset
    heroImageUrl: text("hero_image_url"),  // background image for hero section
    tagline: text("tagline"),             // short marketing text shown on public site
    // Stripe Connect
    stripeConnectedAccountId: text("stripe_connected_account_id"),
    stripeAccountStatus: text("stripe_account_status").notNull().default("not_connected"), // not_connected | pending | active
    // Public API access (Enterprise plan)
    apiKey: text("api_key").unique(), // null = no key generated
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  () => [
    // Enable RLS
    pgPolicy("tenants_enable_rls", { for: "all", to: "public", using: sql`true` }),

    // Users can read their own tenant (via tenant_members)
    pgPolicy("tenants_select_own", {
      for: "select",
      to: "public",
      using: sql`id = current_setting('app.current_tenant_id', true)::uuid`,
    }),

    // Tenant members can update their own tenant
    pgPolicy("tenants_update_own", {
      for: "update",
      to: "public",
      using: sql`id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
  ]
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
