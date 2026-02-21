import { pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const tenantRoleEnum = pgEnum("tenant_role", ["owner", "admin", "member"]);

/**
 * Tenant members - links users to tenants with roles
 * RLS enabled: users can only see memberships for their accessible tenants
 */
export const tenantMembers = pgTable(
  "tenant_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: tenantRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  () => [
    // Enable RLS
    pgPolicy("tenant_members_enable_rls", { for: "all", to: "public", using: sql`true` }),

    // Users can read memberships for their current tenant
    pgPolicy("tenant_members_select_tenant", {
      for: "select",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),

    // Users can insert memberships for their current tenant
    pgPolicy("tenant_members_insert_tenant", {
      for: "insert",
      to: "public",
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
  ]
);

// Import needed for foreign key
import { tenants } from "./tenants";
import { users } from "./users";

export type TenantMember = typeof tenantMembers.$inferSelect;
export type NewTenantMember = typeof tenantMembers.$inferInsert;
