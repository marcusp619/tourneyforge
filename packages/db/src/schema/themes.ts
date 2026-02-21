import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Themes table — system table, no RLS
 * Preset theme configs available to all tenants
 */
export const themes = pgTable("themes", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  primaryColor: text("primary_color").notNull(),
  accentColor: text("accent_color").notNull(),
  backgroundColor: text("background_color").notNull().default("#ffffff"),
  surfaceColor: text("surface_color").notNull().default("#f8fafc"),
  textColor: text("text_color").notNull().default("#0f172a"),
  fontFamily: text("font_family").notNull().default("Inter"),
  heroStyle: text("hero_style").notNull().default("minimal"), // minimal | gradient | image
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Theme = typeof themes.$inferSelect;
export type NewTheme = typeof themes.$inferInsert;
