import { Hono } from "hono";
import { db, registrations, tenants, teams, users, tournaments } from "@tourneyforge/db";
import { eq, and } from "drizzle-orm";
import Stripe from "stripe";
import { sendRegistrationConfirmation } from "../lib/email";

export const stripeRouter = new Hono();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events. Must receive the raw body for signature verification.
 *
 * Key events handled:
 * - checkout.session.completed → confirm registration + mark paid + send email
 * - checkout.session.expired  → cancel pending registration
 * - account.updated           → sync Stripe Connect account status
 */
stripeRouter.post("/webhook", async (c) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return c.json({ error: "Webhook secret not configured" }, 503);
  }

  const rawBody = await c.req.text();
  const signature = c.req.header("stripe-signature");

  if (!signature) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return c.json({ error: "Invalid webhook signature" }, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const registrationId = session.metadata?.["registrationId"];
        const tenantId = session.metadata?.["tenantId"];
        const teamId = session.metadata?.["teamId"];
        const tournamentId = session.metadata?.["tournamentId"];

        if (registrationId && tenantId) {
          await db
            .update(registrations)
            .set({
              status: "confirmed",
              paymentStatus: "paid",
              stripePaymentIntentId: session.payment_intent as string,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(registrations.id, registrationId),
                eq(registrations.tenantId, tenantId)
              )
            );

          // Send confirmation email (best-effort)
          if (teamId && tournamentId) {
            try {
              const [team] = await db
                .select({ name: teams.name, captainId: teams.captainId })
                .from(teams)
                .where(eq(teams.id, teamId))
                .limit(1);

              const [tenant] = await db
                .select({ name: tenants.name, slug: tenants.slug })
                .from(tenants)
                .where(eq(tenants.id, tenantId))
                .limit(1);

              const [tournament] = await db
                .select({ name: tournaments.name, startDate: tournaments.startDate })
                .from(tournaments)
                .where(eq(tournaments.id, tournamentId))
                .limit(1);

              if (team && tenant && tournament) {
                const [captain] = await db
                  .select({ email: users.email })
                  .from(users)
                  .where(eq(users.id, team.captainId))
                  .limit(1);

                if (captain && !captain.email.endsWith("@placeholder.com")) {
                  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "tourneyforge.com";
                  const tournamentUrl = `https://${tenant.slug}.${rootDomain}/tournaments/${tournamentId}`;
                  const dateStr = tournament.startDate.toLocaleDateString("en-US", {
                    weekday: "long", month: "long", day: "numeric", year: "numeric",
                  });

                  await sendRegistrationConfirmation({
                    to: captain.email,
                    tenantName: tenant.name,
                    tournamentName: tournament.name,
                    teamName: team.name,
                    tournamentDate: dateStr,
                    tournamentUrl,
                  });
                }
              }
            } catch (emailErr) {
              console.error("[stripe webhook] email error:", emailErr);
            }
          }
        }
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const registrationId = session.metadata?.["registrationId"];
        const tenantId = session.metadata?.["tenantId"];

        if (registrationId && tenantId) {
          await db
            .update(registrations)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(
              and(
                eq(registrations.id, registrationId),
                eq(registrations.tenantId, tenantId)
              )
            );
        }
        break;
      }

      case "account.updated": {
        // Sync Stripe Connect account status
        const account = event.data.object as Stripe.Account;
        const isActive = account.details_submitted && (account.charges_enabled ?? false);

        await db
          .update(tenants)
          .set({
            stripeAccountStatus: isActive ? "active" : "pending",
            updatedAt: new Date(),
          })
          .where(eq(tenants.stripeConnectedAccountId, account.id));
        break;
      }

      default:
        // Unhandled event type — return 200 so Stripe doesn't retry
        break;
    }
  } catch (err) {
    console.error("[stripe webhook] handler error:", err);
    return c.json({ error: "Internal error processing webhook" }, 500);
  }

  return c.json({ received: true });
});
