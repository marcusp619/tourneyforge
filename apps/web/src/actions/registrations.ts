"use server";

import { auth } from "@clerk/nextjs/server";
import { db, users, teams, registrations, tournaments, tenants } from "@tourneyforge/db";
import { eq, and, count } from "drizzle-orm";
import { redirect } from "next/navigation";
import { registerFormSchema, PLATFORM_FEE_BPS } from "@tourneyforge/validators";
import Stripe from "stripe";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, { apiVersion: "2025-01-27.acacia" });
}

export async function createRegistration(
  tournamentId: string,
  tenantSlug: string,
  formData: FormData
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  // Parse + validate form data
  const parsed = registerFormSchema.safeParse({
    teamName: formData.get("teamName"),
    anglerName: formData.get("anglerName"),
    boatName: formData.get("boatName") || undefined,
    divisionId: formData.get("divisionId") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }
  const { teamName, boatName, divisionId } = parsed.data;

  // Look up tenant
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);
  if (!tenant) throw new Error("Tenant not found");

  // Look up tournament
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(and(eq(tournaments.id, tournamentId), eq(tournaments.tenantId, tenant.id)))
    .limit(1);
  if (!tournament || tournament.status !== "open") throw new Error("Tournament is not open for registration");

  // Check registration deadline
  if (tournament.registrationDeadline && tournament.registrationDeadline < new Date()) {
    throw new Error("Registration deadline has passed");
  }

  // Check capacity
  if (tournament.maxTeams) {
    const [{ value: teamCount }] = await db
      .select({ value: count() })
      .from(registrations)
      .where(
        and(
          eq(registrations.tournamentId, tournamentId),
          eq(registrations.tenantId, tenant.id)
        )
      );
    if (teamCount >= tournament.maxTeams) {
      throw new Error("Tournament is at full capacity");
    }
  }

  // Find or create internal user
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  if (!user) {
    const [created] = await db
      .insert(users)
      .values({ id: crypto.randomUUID(), clerkUserId, email: `${clerkUserId}@placeholder.com` })
      .returning();
    user = created!;
  }

  // Create the team
  const [team] = await db
    .insert(teams)
    .values({
      tenantId: tenant.id,
      tournamentId,
      name: teamName,
      captainId: user.id,
      ...(boatName ? { boatName } : {}),
      ...(divisionId ? { divisionId } : {}),
    })
    .returning();

  if (!team) throw new Error("Failed to create team");

  // --- FREE TOURNAMENT ---
  if (tournament.entryFee === 0) {
    await db.insert(registrations).values({
      tenantId: tenant.id,
      tournamentId,
      teamId: team.id,
      ...(divisionId ? { divisionId } : {}),
      status: "confirmed",
      paymentStatus: "paid", // free = no payment needed
    });

    redirect(`/${tenantSlug}/tournaments/${tournamentId}/register/success`);
  }

  // --- PAID TOURNAMENT — create Stripe Checkout Session ---
  if (!tenant.stripeConnectedAccountId || tenant.stripeAccountStatus !== "active") {
    throw new Error("Tournament director has not completed payment setup");
  }

  const stripe = getStripe();

  // Create pending registration first (we'll confirm it in the webhook)
  const [registration] = await db
    .insert(registrations)
    .values({
      tenantId: tenant.id,
      tournamentId,
      teamId: team.id,
      ...(divisionId ? { divisionId } : {}),
      status: "pending",
      paymentStatus: "pending",
      paymentAmount: String(tournament.entryFee),
    })
    .returning();

  if (!registration) throw new Error("Failed to create registration");

  const feeBps = PLATFORM_FEE_BPS[tenant.plan] ?? 350;
  const applicationFee = Math.round(tournament.entryFee * (feeBps / 10000));

  const baseUrl = process.env.NEXT_PUBLIC_ROOT_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`
    : "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `${tournament.name} — Entry Fee` },
          unit_amount: tournament.entryFee,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    payment_intent_data: {
      application_fee_amount: applicationFee,
      transfer_data: { destination: tenant.stripeConnectedAccountId },
    },
    success_url: `${baseUrl}/${tenantSlug}/tournaments/${tournamentId}/register/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/${tenantSlug}/tournaments/${tournamentId}/register`,
    metadata: {
      registrationId: registration.id,
      tenantId: tenant.id,
      tournamentId,
      teamId: team.id,
    },
  });

  if (!session.url) throw new Error("Failed to create Stripe Checkout session");
  redirect(session.url);
}
