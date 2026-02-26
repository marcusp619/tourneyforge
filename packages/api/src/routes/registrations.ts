import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, registrations, teams, users } from "@tourneyforge/db";
import { eq, and, count } from "drizzle-orm";

export const registrationRouter = new Hono();

// GET /api/registrations?tournamentId=<uuid> — list registrations for a tournament
registrationRouter.get(
  "/",
  zValidator("query", z.object({ tournamentId: z.string().uuid() })),
  async (c) => {
    const { tournamentId } = c.req.valid("query");
    const tenantId = c.req.header("x-tenant-id");
    if (!tenantId) {
      return c.json({ error: { code: "BAD_REQUEST", message: "Missing x-tenant-id header" } }, 400);
    }

    const regs = await db
      .select({
        id: registrations.id,
        status: registrations.status,
        paymentStatus: registrations.paymentStatus,
        paymentAmount: registrations.paymentAmount,
        createdAt: registrations.createdAt,
        teamName: teams.name,
        captainEmail: users.email,
      })
      .from(registrations)
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .innerJoin(users, eq(users.id, teams.captainId))
      .where(and(eq(registrations.tournamentId, tournamentId), eq(registrations.tenantId, tenantId)));

    return c.json({ data: regs });
  }
);

// GET /api/registrations/count?tournamentId=<uuid> — count confirmed registrations
registrationRouter.get(
  "/count",
  zValidator("query", z.object({ tournamentId: z.string().uuid() })),
  async (c) => {
    const { tournamentId } = c.req.valid("query");
    const tenantId = c.req.header("x-tenant-id");
    if (!tenantId) {
      return c.json({ error: { code: "BAD_REQUEST", message: "Missing x-tenant-id header" } }, 400);
    }
    const result = await db
      .select({ value: count() })
      .from(registrations)
      .where(
        and(
          eq(registrations.tournamentId, tournamentId),
          eq(registrations.tenantId, tenantId),
          eq(registrations.status, "confirmed")
        )
      );
    return c.json({ data: { count: result[0]?.value ?? 0 } });
  }
);

// PATCH /api/registrations/:id — update registration status (admin/webhook use)
registrationRouter.patch(
  "/:id",
  zValidator(
    "json",
    z.object({
      status: z.enum(["pending", "confirmed", "cancelled"]).optional(),
      paymentStatus: z.enum(["pending", "paid", "refunded"]).optional(),
      stripePaymentIntentId: z.string().optional(),
    })
  ),
  async (c) => {
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const tenantId = c.req.header("x-tenant-id");
    if (!tenantId) {
      return c.json({ error: { code: "BAD_REQUEST", message: "Missing x-tenant-id header" } }, 400);
    }

    const [updated] = await db
      .update(registrations)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(registrations.id, id), eq(registrations.tenantId, tenantId)))
      .returning();

    if (!updated) {
      return c.json({ error: { code: "NOT_FOUND", message: "Registration not found" } }, 404);
    }

    return c.json({ data: updated });
  }
);
