import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@tourneyforge/db";
import { tournaments } from "@tourneyforge/db";
import { createTournamentSchema, updateTournamentSchema } from "@tourneyforge/validators";
import { eq } from "drizzle-orm";

export const tournamentRouter = new Hono();

// Get all tournaments for a tenant
tournamentRouter.get("/", async (c) => {
  const tenantId = c.req.header("x-tenant-id");
  if (!tenantId) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Missing x-tenant-id header" } }, 400);
  }

  const tenantTournaments = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.tenantId, tenantId));

  return c.json({ data: tenantTournaments });
});

// Get tournament by ID
tournamentRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const tournament = await db.select().from(tournaments).where(eq(tournaments.id, id));

  if (!tournament.length) {
    return c.json({ error: { code: "NOT_FOUND", message: "Tournament not found" } }, 404);
  }

  return c.json({ data: tournament[0] });
});

// Create tournament
tournamentRouter.post("/", zValidator("json", createTournamentSchema), async (c) => {
  const tenantId = c.req.header("x-tenant-id");
  if (!tenantId) {
    return c.json({ error: { code: "BAD_REQUEST", message: "Missing x-tenant-id header" } }, 400);
  }

  const body = c.req.valid("json");
  const newTournament = await db
    .insert(tournaments)
    .values({ ...body, tenantId })
    .returning();

  return c.json({ data: newTournament[0] }, 201);
});

// Update tournament
tournamentRouter.patch("/:id", zValidator("json", updateTournamentSchema), async (c) => {
  const id = c.req.param("id");
  const body = c.req.valid("json");
  const updated = await db.update(tournaments).set(body).where(eq(tournaments.id, id)).returning();

  if (!updated.length) {
    return c.json({ error: { code: "NOT_FOUND", message: "Tournament not found" } }, 404);
  }

  return c.json({ data: updated[0] });
});

// Delete tournament
tournamentRouter.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const deleted = await db.delete(tournaments).where(eq(tournaments.id, id)).returning();

  if (!deleted.length) {
    return c.json({ error: { code: "NOT_FOUND", message: "Tournament not found" } }, 404);
  }

  return c.json({ data: deleted[0] });
});
