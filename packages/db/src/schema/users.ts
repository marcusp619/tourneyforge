import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * System users table (no RLS - readable by all authenticated users)
 * Linked to Clerk user IDs
 */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  phone: text("phone"), // E.164 format, e.g. +15551234567 — for SMS notifications
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

