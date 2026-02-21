import { NextRequest, NextResponse } from "next/server";
import { db, tenants } from "@tourneyforge/db";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get("accountId");

  const baseUrl = process.env.NEXT_PUBLIC_ROOT_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`
    : "http://localhost:3000";

  if (!accountId) {
    return NextResponse.redirect(`${baseUrl}/dashboard/settings`);
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.redirect(`${baseUrl}/dashboard/settings`);
  }

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-02-24.acacia" });
    const account = await stripe.accounts.retrieve(accountId);

    // Check if onboarding is complete
    const isActive =
      account.details_submitted &&
      (account.charges_enabled ?? false);

    await db
      .update(tenants)
      .set({
        stripeConnectedAccountId: accountId,
        stripeAccountStatus: isActive ? "active" : "pending",
      })
      .where(eq(tenants.stripeConnectedAccountId, accountId));
  } catch {
    // Best effort — still redirect to settings
  }

  return NextResponse.redirect(`${baseUrl}/dashboard/settings`);
}
