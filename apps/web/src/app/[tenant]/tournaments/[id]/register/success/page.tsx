import { db, tenants, tournaments, registrations } from "@tourneyforge/db";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import Stripe from "stripe";

interface Props {
  params: Promise<{ tenant: string; id: string }>;
  searchParams: Promise<{ session_id?: string }>;
}

async function getStripeSession(sessionId: string) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  try {
    const stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
    return await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return null;
  }
}

export default async function RegisterSuccessPage({ params, searchParams }: Props) {
  const { tenant: slug, id } = await params;
  const { session_id } = await searchParams;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant) notFound();

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(and(eq(tournaments.id, id), eq(tournaments.tenantId, tenant.id)))
    .limit(1);
  if (!tournament) notFound();

  // For paid tournaments, verify the Stripe session
  let paymentVerified = tournament.entryFee === 0; // free = auto-verified
  if (session_id && !paymentVerified) {
    const session = await getStripeSession(session_id);
    if (session?.payment_status === "paid") {
      paymentVerified = true;
      // Update registration if needed (webhook may not have fired yet)
      const registrationId = session.metadata?.["registrationId"];
      if (registrationId) {
        await db
          .update(registrations)
          .set({ status: "confirmed", paymentStatus: "paid", stripePaymentIntentId: session.payment_intent as string })
          .where(and(eq(registrations.id, registrationId), eq(registrations.tenantId, tenant.id)));
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="max-w-lg mx-auto text-center">
        <div className="text-6xl mb-6">{paymentVerified ? "🎉" : "⏳"}</div>

        <h1 className="text-3xl font-extrabold mb-3" style={{ color: "var(--color-text)" }}>
          {paymentVerified ? "You're Registered!" : "Registration Pending"}
        </h1>

        <p className="text-lg mb-8" style={{ color: "var(--color-muted)" }}>
          {paymentVerified
            ? `Your registration for ${tournament.name} is confirmed. We'll see you on the water!`
            : `Your payment is being processed. You'll receive confirmation once complete.`}
        </p>

        <div className="card mb-6 text-left">
          <h2 className="font-semibold mb-3" style={{ color: "var(--color-text)" }}>
            Tournament Info
          </h2>
          <p className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
            {tournament.name}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>
            {new Intl.DateTimeFormat("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            }).format(tournament.startDate)}
          </p>
        </div>

        <Link
          href={`/${slug}/tournaments/${id}`}
          className="inline-block font-semibold px-6 py-3 rounded-lg text-white transition hover:opacity-90"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          View Tournament
        </Link>
      </div>
    </div>
  );
}
