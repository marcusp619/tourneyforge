import { Hono } from "hono";
import { db, registrations, tenants, teams, users, tournaments } from "@tourneyforge/db";
import { eq, and } from "drizzle-orm";
import Stripe from "stripe";
import { Redis } from "@upstash/redis";
import { sendRegistrationConfirmation } from "../lib/email";

export const stripeRouter = new Hono();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
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
 *
 * Idempotency: processed event IDs are stored in Redis for 24h to prevent
 * duplicate processing on Stripe retries.
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

  // Idempotency check — skip events already processed
  const redis = getRedis();
  if (redis) {
    const idempotencyKey = `stripe:event:${event.id}`;
    const alreadyProcessed = await redis.set(idempotencyKey, "1", {
      ex: 86400, // 24 hours
      nx: true,  // only set if not exists
    });
    if (alreadyProcessed === null) {
      // Key already existed — event was processed before
      console.info(`[stripe webhook] duplicate event skipped: ${event.id}`);
      return c.json({ received: true });
    }
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

          // Send confirmation email
          if (teamId && tournamentId) {
            const emailResult = await sendRegistrationEmail({
              tenantId, teamId, tournamentId,
            });
            if (!emailResult.ok) {
              console.error("[stripe webhook] email failed:", emailResult.error);
              // Non-fatal — registration is already confirmed in DB
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
    // Remove idempotency key so Stripe retries can be re-processed
    if (redis) {
      await redis.del(`stripe:event:${event.id}`).catch(() => {/* best effort */});
    }
    return c.json({ error: "Internal error processing webhook" }, 500);
  }

  return c.json({ received: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SendEmailArgs {
  tenantId: string;
  teamId: string;
  tournamentId: string;
}

async function sendRegistrationEmail(
  args: SendEmailArgs
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    const [team] = await db
      .select({ name: teams.name, captainId: teams.captainId })
      .from(teams)
      .where(eq(teams.id, args.teamId))
      .limit(1);

    const [tenant] = await db
      .select({ name: tenants.name, slug: tenants.slug })
      .from(tenants)
      .where(eq(tenants.id, args.tenantId))
      .limit(1);

    const [tournament] = await db
      .select({ name: tournaments.name, startDate: tournaments.startDate })
      .from(tournaments)
      .where(eq(tournaments.id, args.tournamentId))
      .limit(1);

    if (!team || !tenant || !tournament) {
      return { ok: false, error: "Missing team/tenant/tournament record" };
    }

    const [captain] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, team.captainId))
      .limit(1);

    if (!captain || captain.email.endsWith("@placeholder.com")) {
      return { ok: true }; // no-op — placeholder email
    }

    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "tourneyforge.com";
    const tournamentUrl = `https://${tenant.slug}.${rootDomain}/tournaments/${args.tournamentId}`;
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

    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
