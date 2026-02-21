import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Teams table - tenant-scoped
 */
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    captainId: uuid("captain_id").notNull().references(() => users.id),
    divisionId: uuid("division_id").references(() => tournamentDivisions.id),
    boatName: text("boat_name"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  () => [
    pgPolicy("teams_enable_rls", { for: "all", to: "public", using: sql`true` }),
    pgPolicy("teams_select_tenant", {
      for: "select",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("teams_insert_tenant", {
      for: "insert",
      to: "public",
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("teams_update_tenant", {
      for: "update",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("teams_delete_tenant", {
      for: "delete",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
  ]
);

/**
 * Tournament divisions
 */
export const tournamentDivisions = pgTable(
  "tournament_divisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  () => [
    pgPolicy("divisions_enable_rls", { for: "all", to: "public", using: sql`true` }),
    pgPolicy("divisions_select_tenant", {
      for: "select",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("divisions_insert_tenant", {
      for: "insert",
      to: "public",
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("divisions_update_tenant", {
      for: "update",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("divisions_delete_tenant", {
      for: "delete",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
  ]
);

/**
 * Tournament species (what fish can be caught)
 */
export const tournamentSpecies = pgTable(
  "tournament_species",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    speciesId: uuid("species_id").notNull().references(() => species.id),
    points: text("points").notNull(), // JSON for scoring rules
    minSize: text("min_size"), // JSON with weight/length minimums
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  () => [
    pgPolicy("species_enable_rls", { for: "all", to: "public", using: sql`true` }),
    pgPolicy("species_select_tenant", {
      for: "select",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("species_insert_tenant", {
      for: "insert",
      to: "public",
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("species_update_tenant", {
      for: "update",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("species_delete_tenant", {
      for: "delete",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
  ]
);

/**
 * Master species list (system-wide, no tenant scope)
 */
export const species = pgTable("species", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  commonName: text("common_name"),
  scientificName: text("scientific_name"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Registrations
 */
export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    divisionId: uuid("division_id").references(() => tournamentDivisions.id),
    status: text("status").notNull().default("pending"), // pending, confirmed, cancelled
    paymentStatus: text("payment_status").notNull().default("pending"), // pending, paid, refunded
    paymentAmount: text("payment_amount"), // integer in cents
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  () => [
    pgPolicy("registrations_enable_rls", { for: "all", to: "public", using: sql`true` }),
    pgPolicy("registrations_select_tenant", {
      for: "select",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("registrations_insert_tenant", {
      for: "insert",
      to: "public",
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("registrations_update_tenant", {
      for: "update",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("registrations_delete_tenant", {
      for: "delete",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
  ]
);

/**
 * Catches - the core scoring data
 */
export const catches = pgTable(
  "catches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    speciesId: uuid("species_id").notNull().references(() => species.id),
    weight: text("weight").notNull(), // stored as integer (ounces)
    length: text("length").notNull(), // stored as integer (inches)
    photoUrl: text("photo_url"),
    timestamp: timestamp("timestamp").notNull(),
    latitude: text("latitude"), // decimal degrees
    longitude: text("longitude"), // decimal degrees
    verified: text("verified").notNull().default("false"), // boolean as text
    verifiedAt: timestamp("verified_at"),
    verifiedBy: uuid("verified_by").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  () => [
    pgPolicy("catches_enable_rls", { for: "all", to: "public", using: sql`true` }),
    pgPolicy("catches_select_tenant", {
      for: "select",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("catches_insert_tenant", {
      for: "insert",
      to: "public",
      withCheck: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("catches_update_tenant", {
      for: "update",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
    pgPolicy("catches_delete_tenant", {
      for: "delete",
      to: "public",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
  ]
);

// Import for foreign keys
import { tenants } from "./tenants";
import { tournaments } from "./tournaments";
import { users } from "./users";

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TournamentDivision = typeof tournamentDivisions.$inferSelect;
export type NewTournamentDivision = typeof tournamentDivisions.$inferInsert;
export type TournamentSpecies = typeof tournamentSpecies.$inferSelect;
export type NewTournamentSpecies = typeof tournamentSpecies.$inferInsert;
export type Species = typeof species.$inferSelect;
export type NewSpecies = typeof species.$inferInsert;
export type Registration = typeof registrations.$inferSelect;
export type NewRegistration = typeof registrations.$inferInsert;
export type Catch = typeof catches.$inferSelect;
export type NewCatch = typeof catches.$inferInsert;
