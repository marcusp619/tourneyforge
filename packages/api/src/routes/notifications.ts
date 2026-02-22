import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db, tournaments, registrations, teams, users, tenants } from "@tourneyforge/db";
import { eq, and } from "drizzle-orm";
import { sendTournamentStartSms, sendTournamentEndSms } from "../lib/sms";

export const notificationRouter = new Hono();

/**
 * POST /api/notifications/tournament-status
 *
 * Called when a tournament's status changes. Sends SMS notifications
 * to registered team captains who have a phone number on file.
 *
 * Body: { tournamentId, tenantId, newStatus }
 */
notificationRouter.post(
  "/tournament-status",
  zValidator(
    "json",
    z.object({
      tournamentId: z.string().uuid(),
      tenantId: z.string().uuid(),
      newStatus: z.enum(["draft", "open", "active", "completed"]),
    })
  ),
  async (c) => {
    const { tournamentId, tenantId, newStatus } = c.req.valid("json");

    // Only send SMS for live start and completion events
    if (newStatus !== "active" && newStatus !== "completed") {
      return c.json({ data: { sent: 0 } });
    }

    const [tournament] = await db
      .select({ name: tournaments.name, startDate: tournaments.startDate })
      .from(tournaments)
      .where(and(eq(tournaments.id, tournamentId), eq(tournaments.tenantId, tenantId)))
      .limit(1);

    if (!tournament) {
      return c.json({ error: { code: "NOT_FOUND", message: "Tournament not found" } }, 404);
    }

    const [tenant] = await db
      .select({ slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    // Get all confirmed team captains with phone numbers
    const regRows = await db
      .select({ captainId: teams.captainId })
      .from(registrations)
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .where(
        and(
          eq(registrations.tournamentId, tournamentId),
          eq(registrations.paymentStatus, "paid")
        )
      );

    const captainIds = [...new Set(regRows.map((r) => r.captainId))];

    const captains = await Promise.all(
      captainIds.map((captainId) =>
        db
          .select({ phone: users.phone })
          .from(users)
          .where(eq(users.id, captainId))
          .limit(1)
          .then((rows) => rows[0])
      )
    );

    const phoneNumbers = captains
      .map((c) => c?.phone)
      .filter((p): p is string => Boolean(p));

    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "tourneyforge.com";
    const leaderboardUrl = `https://${tenant?.slug ?? "app"}.${rootDomain}/tournaments/${tournamentId}/leaderboard`;

    let sent = 0;
    await Promise.all(
      phoneNumbers.map(async (phone) => {
        if (newStatus === "active") {
          await sendTournamentStartSms({ to: phone, tournamentName: tournament.name });
        } else {
          await sendTournamentEndSms({
            to: phone,
            tournamentName: tournament.name,
            leaderboardUrl,
          });
        }
        sent++;
      })
    );

    return c.json({ data: { sent } });
  }
);
