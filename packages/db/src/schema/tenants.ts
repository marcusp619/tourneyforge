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
