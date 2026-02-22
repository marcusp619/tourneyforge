import { db, tournaments, tenants } from "@tourneyforge/db";
import { eq, or, desc } from "drizzle-orm";
import Link from "next/link";

export const metadata = { title: "Tournament Marketplace | TourneyForge" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatCents(cents: number) {
  if (cents === 0) return "Free";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function MarketplacePage() {
  const rows = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      description: tournaments.description,
      status: tournaments.status,
      startDate: tournaments.startDate,
      endDate: tournaments.endDate,
      registrationDeadline: tournaments.registrationDeadline,
      entryFee: tournaments.entryFee,
      maxTeams: tournaments.maxTeams,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      tenantLogoUrl: tenants.logoUrl,
      tenantPrimaryColor: tenants.primaryColor,
    })
    .from(tournaments)
    .innerJoin(tenants, eq(tenants.id, tournaments.tenantId))
    .where(or(eq(tournaments.status, "open"), eq(tournaments.status, "active")))
    .orderBy(desc(tournaments.startDate));

  const live = rows.filter((r) => r.status === "active");
  const upcoming = rows.filter((r) => r.status === "open");

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-14 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Find Your Next Tournament
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Browse open and live fishing tournaments across all TourneyForge clubs. Register directly with each club.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 space-y-12">
        {/* Live Tournaments */}
        {live.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"
              />
              <h2 className="text-xl font-bold text-gray-900">Live Now</h2>
              <span className="ml-1 text-sm text-gray-400">({live.length})</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {live.map((t) => (
                <TournamentCard key={t.id} tournament={t} />
              ))}
            </div>
          </section>
        )}

        {/* Open / Upcoming */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <h2 className="text-xl font-bold text-gray-900">Open for Registration</h2>
            <span className="ml-1 text-sm text-gray-400">({upcoming.length})</span>
          </div>
          {upcoming.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-3xl mb-3">🎣</p>
              <p className="text-gray-500">No tournaments are currently open for registration. Check back soon!</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.map((t) => (
                <TournamentCard key={t.id} tournament={t} />
              ))}
            </div>
          )}
        </section>

        {/* CTA for directors */}
        <div className="bg-blue-600 rounded-2xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-2">Run a Fishing Tournament?</h2>
          <p className="text-blue-100 mb-6">
            TourneyForge gives you a professional site, online registration, Stripe payments, and live leaderboards — in minutes.
          </p>
          <Link
            href="/sign-up"
            className="inline-block bg-white text-blue-700 font-semibold px-6 py-3 rounded-lg hover:bg-blue-50 transition"
          >
            Start Free
          </Link>
        </div>
      </div>
    </main>
  );
}

type TournamentRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: Date;
  endDate: Date;
  registrationDeadline: Date | null;
  entryFee: number;
  maxTeams: number | null;
  tenantName: string;
  tenantSlug: string;
  tenantLogoUrl: string | null;
  tenantPrimaryColor: string | null;
};

function TournamentCard({ tournament: t }: { tournament: TournamentRow }) {
  const color = t.tenantPrimaryColor ?? "#1d4ed8";
  const isLive = t.status === "active";

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition">
      {/* Color accent bar */}
      <div className="h-1.5" style={{ backgroundColor: color }} />

      <div className="p-5 flex flex-col flex-1">
        {/* Club */}
        <div className="flex items-center gap-2 mb-3">
          {t.tenantLogoUrl ? (
            <img src={t.tenantLogoUrl} alt={t.tenantName} className="w-6 h-6 rounded object-cover" />
          ) : (
            <div
              className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: color }}
            >
              {t.tenantName.charAt(0)}
            </div>
          )}
          <span className="text-xs text-gray-500 font-medium">{t.tenantName}</span>
          {isLive && (
            <span className="ml-auto text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
              Live
            </span>
          )}
        </div>

        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{t.name}</h3>
        {t.description && (
          <p className="text-xs text-gray-500 mb-3 line-clamp-2">{t.description}</p>
        )}

        <div className="mt-auto space-y-1.5 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>Start</span>
            <span className="font-medium text-gray-700">{formatDate(t.startDate)}</span>
          </div>
          {t.registrationDeadline && (
            <div className="flex justify-between">
              <span>Reg. closes</span>
              <span className="font-medium text-gray-700">{formatDate(t.registrationDeadline)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Entry fee</span>
            <span className="font-medium text-gray-700">{formatCents(t.entryFee)}</span>
          </div>
          {t.maxTeams && (
            <div className="flex justify-between">
              <span>Max teams</span>
              <span className="font-medium text-gray-700">{t.maxTeams}</span>
            </div>
          )}
        </div>

        <a
          href={`https://${t.tenantSlug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "tourneyforge.com"}/tournaments/${t.id}`}
          className="mt-4 block text-center text-sm font-semibold text-white py-2 rounded-lg transition hover:opacity-90"
          style={{ backgroundColor: color }}
        >
          {isLive ? "View Leaderboard" : "Register Now"}
        </a>
      </div>
    </div>
  );
}
