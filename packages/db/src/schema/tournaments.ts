import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const tournamentStatusEnum = pgEnum("tournament_status", [
  "draft",
  "open",
  "active",
  "completed",
]);

/**
 * Tournaments table - tenant-scoped
 * RLS enabled: users can only access tournaments for their current tenant
 */
export const tournaments = pgTable(
  "tournaments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    registrationDeadline: timestamp("registration_deadline"),
    status: tournamentStatusEnum("status").notNull().default("draft"),
    scoringFormatId: uuid("scoring_format_id").references(() => scoringFormats.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  () => [
    // Enable RLS
    pgPolicy("tournaments_enable_rls", { for: "all", to: "public", using: sql`true` }),

    // Users can read tournaments for their current tenant
    pgPolicy("tournaments_select_tenant", {
      for: "select",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),

    // Users can insert/update/delete tournaments for their current tenant
    pgPolicy("tournaments_insert_tenant", {
      for: "insert",
      to: "public",
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("tournaments_update_tenant", {
      for: "update",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("tournaments_delete_tenant", {
      for: "delete",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
  ]
);

// Scoring formats
export const scoringFormatType = pgEnum("scoring_format_type", [
  "weight",
  "length",
  "count",
  "custom",
]);

export const scoringFormats = pgTable(
  "scoring_formats",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: scoringFormatType("type").notNull(),
    rules: text("rules").notNull(), // JSON string
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  () => [
    pgPolicy("scoring_formats_enable_rls", { for: "all", to: "public", using: sql`true` }),
    pgPolicy("scoring_formats_select_tenant", {
      for: "select",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("scoring_formats_insert_tenant", {
      for: "insert",
      to: "public",
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("scoring_formats_update_tenant", {
      for: "update",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("scoring_formats_delete_tenant", {
      for: "delete",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
  ]
);

// Import for foreign key
import { tenants } from "./tenants";

export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;
export type ScoringFormat = typeof scoringFormats.$inferSelect;
export type NewScoringFormat = typeof scoringFormats.$inferInsert;
