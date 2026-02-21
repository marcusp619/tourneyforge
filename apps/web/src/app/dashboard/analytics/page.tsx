import { requireTenant } from "@/lib/tenant";
import { db, tournaments, registrations, catches } from "@tourneyforge/db";
import { eq, count, and } from "drizzle-orm";
import { SUBSCRIPTION_LIMITS } from "@tourneyforge/types";
import Link from "next/link";

export const metadata = { title: "Analytics | Dashboard" };

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function AnalyticsPage() {
  const { tenant } = await requireTenant();

  const limits = SUBSCRIPTION_LIMITS[tenant.plan];
  if (!limits.analytics) {
    return (
      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-4xl mb-4">📊</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Pro Feature</h2>
          <p className="text-gray-500 text-sm mb-6">
            Analytics are available on the Pro and Enterprise plans. Upgrade to unlock registration trends,
            revenue reporting, and catch analytics.
          </p>
          <Link
            href="/dashboard/settings"
            className="inline-block bg-blue-600 text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-blue-700 transition text-sm"
          >
            Upgrade Plan
          </Link>
        </div>
      </div>
    );
  }

  // Fetch all tournaments for this tenant
  const tenantTournaments = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.tenantId, tenant.id));

  // Per-tournament stats
  const tournamentStats = await Promise.all(
    tenantTournaments.map(async (t) => {
      const [regCountResult, catchCountResult] = await Promise.all([
        db
          .select({ value: count() })
          .from(registrations)
          .where(
            and(
              eq(registrations.tournamentId, t.id),
              eq(registrations.paymentStatus, "paid")
            )
          ),
        db
          .select({ value: count() })
          .from(catches)
          .where(eq(catches.tournamentId, t.id)),
      ]);

      const regCount = regCountResult[0]?.value ?? 0;
      const catchCount = catchCountResult[0]?.value ?? 0;
      const revenue = regCount * t.entryFee; // paid registrations × entry fee

      return {
        id: t.id,
        name: t.name,
        status: t.status,
        entryFee: t.entryFee,
        regCount,
        catchCount,
        revenue,
      };
    })
  );

  // Totals
  const totalTournaments = tenantTournaments.length;
  const activeTournaments = tenantTournaments.filter((t) => t.status === "active").length;
  const totalRegistrations = tournamentStats.reduce((s, t) => s + t.regCount, 0);
  const totalRevenue = tournamentStats.reduce((s, t) => s + t.revenue, 0);
  const totalCatches = tournamentStats.reduce((s, t) => s + t.catchCount, 0);

  // Sort by revenue desc for the table
  const sortedStats = [...tournamentStats].sort((a, b) => b.revenue - a.revenue);

  const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
    draft: { label: "Draft", bg: "#fef9c3", color: "#854d0e" },
    open: { label: "Open", bg: "#dcfce7", color: "#166534" },
    active: { label: "Live", bg: "#dbeafe", color: "#1e40af" },
    completed: { label: "Done", bg: "#f3f4f6", color: "#6b7280" },
  };

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">
          Overview of tournament registrations, revenue, and activity.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Tournaments" value={String(totalTournaments)} icon="🏆" />
        <StatCard label="Live Now" value={String(activeTournaments)} icon="🔴" highlight={activeTournaments > 0} />
        <StatCard label="Total Registrations" value={String(totalRegistrations)} icon="📋" />
        <StatCard label="Total Revenue" value={formatCents(totalRevenue)} icon="💵" />
      </div>

      {/* Catch summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Catches" value={String(totalCatches)} icon="🎣" />
        <StatCard
          label="Avg Catches / Tournament"
          value={totalTournaments > 0 ? (totalCatches / totalTournaments).toFixed(1) : "—"}
          icon="📈"
        />
        <StatCard
          label="Avg Revenue / Tournament"
          value={totalTournaments > 0 ? formatCents(totalRevenue / totalTournaments) : "—"}
          icon="💰"
        />
      </div>

      {/* Tournament breakdown table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Tournaments Breakdown</h2>
        </div>
        {sortedStats.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 text-sm">No tournaments yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tournament</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Registrations</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Catches</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedStats.map((t) => {
                const badge = STATUS_BADGE[t.status] ?? STATUS_BADGE.draft!;
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/tournaments/${t.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {t.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: badge.bg, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{t.regCount}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{t.catchCount}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {t.entryFee > 0 ? formatCents(t.revenue) : <span className="text-gray-400">Free</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td className="px-4 py-3 font-semibold text-gray-900" colSpan={2}>Total</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{totalRegistrations}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{totalCatches}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCents(totalRevenue)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-xl border p-5 ${highlight ? "border-blue-300 bg-blue-50" : "border-gray-200"}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <span className={`text-xs font-semibold uppercase tracking-wide ${highlight ? "text-blue-600" : "text-gray-500"}`}>
          {label}
        </span>
      </div>
      <p className={`text-2xl font-bold ${highlight ? "text-blue-700" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
