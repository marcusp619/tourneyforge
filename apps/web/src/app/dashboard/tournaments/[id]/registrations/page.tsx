import { requireTenant } from "@/lib/tenant";
import { db, tournaments, registrations, teams, users } from "@tourneyforge/db";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: "Pending", bg: "#fef9c3", text: "#854d0e" },
  confirmed: { label: "Confirmed", bg: "#dcfce7", text: "#166534" },
  cancelled: { label: "Cancelled", bg: "#fee2e2", text: "#991b1b" },
};

const PAYMENT_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: "Pending", bg: "#fef9c3", text: "#854d0e" },
  paid: { label: "Paid", bg: "#dcfce7", text: "#166534" },
  refunded: { label: "Refunded", bg: "#f3f4f6", text: "#6b7280" },
};

function formatCents(cents: string | null): string {
  if (!cents || cents === "0") return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(cents) / 100);
}

export default async function TournamentRegistrationsPage({ params }: Props) {
  const { id } = await params;
  const { tenant } = await requireTenant();

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(and(eq(tournaments.id, id), eq(tournaments.tenantId, tenant.id)))
    .limit(1);

  if (!tournament) notFound();

  // Join registrations with teams and captains
  const regs = await db
    .select({
      id: registrations.id,
      status: registrations.status,
      paymentStatus: registrations.paymentStatus,
      paymentAmount: registrations.paymentAmount,
      createdAt: registrations.createdAt,
      teamName: teams.name,
      boatName: teams.boatName,
      captainEmail: users.email,
      captainFirst: users.firstName,
      captainLast: users.lastName,
    })
    .from(registrations)
    .innerJoin(teams, eq(teams.id, registrations.teamId))
    .innerJoin(users, eq(users.id, teams.captainId))
    .where(and(eq(registrations.tournamentId, id), eq(registrations.tenantId, tenant.id)))
    .orderBy(registrations.createdAt);

  const confirmedCount = regs.filter((r) => r.status === "confirmed").length;

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link href={`/dashboard/tournaments/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">
          ← {tournament.name}
        </Link>
      </div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registrations</h1>
          <p className="text-gray-500 mt-1">
            {confirmedCount} confirmed
            {tournament.maxTeams ? ` / ${tournament.maxTeams} max` : ""}
          </p>
        </div>
        <Link
          href={`/${tenant.slug}/tournaments/${id}`}
          target="_blank"
          className="text-sm font-medium text-gray-500 hover:text-gray-700 px-3 py-2 border border-gray-200 rounded-lg transition"
        >
          View Public Page ↗
        </Link>
      </div>

      {regs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <p className="text-4xl mb-4">📋</p>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No registrations yet</h2>
          <p className="text-gray-500">
            Registrations will appear here once anglers sign up.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Team</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Captain</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Payment</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Amount</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {regs.map((r) => {
                const s = STATUS_STYLES[r.status] ?? STATUS_STYLES["pending"]!;
                const p = PAYMENT_STYLES[r.paymentStatus] ?? PAYMENT_STYLES["pending"]!;
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3">
                      <span className="font-medium text-gray-900">{r.teamName}</span>
                      {r.boatName && (
                        <span className="text-xs text-gray-400 ml-1.5">({r.boatName})</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      {r.captainFirst || r.captainLast
                        ? `${r.captainFirst ?? ""} ${r.captainLast ?? ""}`.trim()
                        : r.captainEmail}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: s.bg, color: s.text }}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: p.bg, color: p.text }}
                      >
                        {p.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-700">{formatCents(r.paymentAmount)}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Intl.DateTimeFormat("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }).format(r.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
