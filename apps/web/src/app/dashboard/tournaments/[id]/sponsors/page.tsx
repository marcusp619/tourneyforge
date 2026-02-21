import { requireTenant } from "@/lib/tenant";
import { db, sponsors, tournaments } from "@tourneyforge/db";
import { and, eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createSponsor, deleteSponsor } from "@/actions/sponsors";

interface Props {
  params: Promise<{ id: string }>;
}

const TIER_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  title: { label: "Title", bg: "#fef9c3", color: "#854d0e" },
  gold: { label: "Gold", bg: "#fef3c7", color: "#92400e" },
  silver: { label: "Silver", bg: "#f3f4f6", color: "#374151" },
  bronze: { label: "Bronze", bg: "#fdf2f8", color: "#831843" },
};

export default async function SponsorsPage({ params }: Props) {
  const { id } = await params;
  const { tenant } = await requireTenant();

  const [tournament] = await db
    .select({ id: tournaments.id, name: tournaments.name })
    .from(tournaments)
    .where(and(eq(tournaments.id, id), eq(tournaments.tenantId, tenant.id)))
    .limit(1);

  if (!tournament) notFound();

  const tournamentSponsors = await db
    .select()
    .from(sponsors)
    .where(and(eq(sponsors.tenantId, tenant.id), eq(sponsors.tournamentId, id)))
    .orderBy(asc(sponsors.displayOrder), asc(sponsors.createdAt));

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Link href={`/dashboard/tournaments/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">
            ← {tournament.name}
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Sponsors</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage sponsors for this tournament. Sponsors are shown on the public tournament page.
        </p>
      </div>

      {/* Sponsor list */}
      {tournamentSponsors.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 mb-8 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sponsor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Website</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tournamentSponsors.map((s) => {
                const tier = TIER_CONFIG[s.tier] ?? TIER_CONFIG.bronze!;
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: tier.bg, color: tier.color }}
                      >
                        {tier.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {s.website ? (
                        <a
                          href={s.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate max-w-[200px] block"
                        >
                          {s.website.replace(/^https?:\/\//, "")}
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form
                        action={async () => {
                          "use server";
                          await deleteSponsor(s.id, id);
                        }}
                      >
                        <button
                          type="submit"
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center mb-8">
          <p className="text-3xl mb-3">🏅</p>
          <p className="text-gray-500 text-sm">No sponsors yet. Add your first sponsor below.</p>
        </div>
      )}

      {/* Add sponsor form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Add Sponsor</h2>
        <form action={createSponsor.bind(null, id)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="name">
              Sponsor Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="e.g. Bass Pro Shops"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="website">
              Website URL
            </label>
            <input
              id="website"
              name="website"
              type="url"
              placeholder="https://example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="tier">
              Tier
            </label>
            <select
              id="tier"
              name="tier"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="title">Title Sponsor</option>
              <option value="gold">Gold</option>
              <option value="silver">Silver</option>
              <option value="bronze" selected>Bronze</option>
            </select>
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white font-semibold px-5 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
          >
            Add Sponsor
          </button>
        </form>
      </div>
    </div>
  );
}
