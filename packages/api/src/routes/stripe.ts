import { Hono } from "hono";
import { db, registrations, tenants } from "@tourneyforge/db";
import { eq, and } from "drizzle-orm";
import Stripe from "stripe";

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
 * - checkout.session.completed → confirm registration + mark paid
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
