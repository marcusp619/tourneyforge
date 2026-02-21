import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireTenant } from "@/lib/tenant";
import Stripe from "stripe";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", process.env.NEXT_PUBLIC_ROOT_DOMAIN ? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}` : "http://localhost:3000"));
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const { tenant } = await requireTenant();

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-02-24.acacia" });

  const baseUrl = process.env.NEXT_PUBLIC_ROOT_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`
    : "http://localhost:3000";

  // Create or retrieve the connected account
  let accountId = tenant.stripeConnectedAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      metadata: { tenantId: tenant.id, tenantSlug: tenant.slug },
    });
    accountId = account.id;

    // Persist the account ID immediately
    const { db, tenants } = await import("@tourneyforge/db");
    const { eq } = await import("drizzle-orm");
    await db
      .update(tenants)
      .set({ stripeConnectedAccountId: accountId, stripeAccountStatus: "pending" })
      .where(eq(tenants.id, tenant.id));
  }

  // Generate a fresh account link
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/api/stripe/connect`,
    return_url: `${baseUrl}/api/stripe/return?accountId=${accountId}`,
    type: "account_onboarding",
  });

  return NextResponse.redirect(accountLink.url);
}
