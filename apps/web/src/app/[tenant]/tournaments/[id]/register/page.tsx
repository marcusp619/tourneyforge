import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db, tenants, tournaments, tournamentDivisions } from "@tourneyforge/db";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { createRegistration } from "@/actions/registrations";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ tenant: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [t] = await db
    .select({ name: tournaments.name })
    .from(tournaments)
    .where(eq(tournaments.id, id))
    .limit(1);
  return { title: `Register — ${t?.name ?? "Tournament"}` };
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default async function RegisterPage({ params }: Props) {
  const { tenant: slug, id } = await params;

  const { userId } = await auth();
  if (!userId) redirect(`/sign-in?redirect_url=/${slug}/tournaments/${id}/register`);

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

  if (!tournament || tournament.status !== "open") notFound();

  const registrationClosed =
    tournament.registrationDeadline && tournament.registrationDeadline < new Date();
  if (registrationClosed) notFound();

  const divisions = await db
    .select()
    .from(tournamentDivisions)
    .where(and(eq(tournamentDivisions.tournamentId, id), eq(tournamentDivisions.tenantId, tenant.id)));

  const isPaid = tournament.entryFee > 0;
  const hasDivisions = divisions.length > 0;

  const registerAction = createRegistration.bind(null, id, slug);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Breadcrumb */}
      <nav className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
        <Link href={`/${slug}`} className="hover:underline">{tenant.name}</Link>
        {" / "}
        <Link href={`/${slug}/tournaments`} className="hover:underline">Tournaments</Link>
        {" / "}
        <Link href={`/${slug}/tournaments/${id}`} className="hover:underline">{tournament.name}</Link>
        {" / "}
        <span style={{ color: "var(--color-text)" }}>Register</span>
      </nav>

      <div className="max-w-lg">
        <h1 className="text-3xl font-extrabold mb-2" style={{ color: "var(--color-text)" }}>
          Register for {tournament.name}
        </h1>
        {isPaid && (
          <p className="text-lg font-semibold mb-6" style={{ color: "var(--color-primary)" }}>
            Entry fee: {formatCents(tournament.entryFee)}
          </p>
        )}

        <div className="card">
          <form action={registerAction} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Team Name <span className="text-red-500">*</span>
              </label>
              <input
                name="teamName"
                type="text"
                required
                maxLength={100}
                placeholder="e.g. Reel Warriors"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{ "--tw-ring-color": "var(--color-primary)" } as React.CSSProperties}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Your Name (Team Captain) <span className="text-red-500">*</span>
              </label>
              <input
                name="anglerName"
                type="text"
                required
                maxLength={100}
                placeholder="First Last"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{ "--tw-ring-color": "var(--color-primary)" } as React.CSSProperties}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                Boat Name <span className="text-xs font-normal" style={{ color: "var(--color-muted)" }}>(optional)</span>
              </label>
              <input
                name="boatName"
                type="text"
                maxLength={100}
                placeholder="e.g. Bass Blaster"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{ "--tw-ring-color": "var(--color-primary)" } as React.CSSProperties}
              />
            </div>

            {hasDivisions && (
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--color-text)" }}>
                  Division <span className="text-xs font-normal" style={{ color: "var(--color-muted)" }}>(optional)</span>
                </label>
                <select
                  name="divisionId"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2"
                  style={{ "--tw-ring-color": "var(--color-primary)" } as React.CSSProperties}
                >
                  <option value="">— No Division —</option>
                  {divisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              className="w-full font-semibold py-3 rounded-lg text-white transition hover:opacity-90"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              {isPaid ? `Pay ${formatCents(tournament.entryFee)} & Register` : "Complete Registration"}
            </button>

            {isPaid && (
              <p className="text-xs text-center" style={{ color: "var(--color-muted)" }}>
                You will be redirected to Stripe to complete payment securely.
              </p>
            )}
          </form>
        </div>

        <p className="text-sm mt-4 text-center" style={{ color: "var(--color-muted)" }}>
          <Link href={`/${slug}/tournaments/${id}`} className="hover:underline">
            ← Back to tournament
          </Link>
        </p>
      </div>
    </div>
  );
}
