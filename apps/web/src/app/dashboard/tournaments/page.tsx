import { requireTenant } from "@/lib/tenant";
import { db, tournaments } from "@tourneyforge/db";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import { updateTournamentStatus } from "@/actions/tournaments";

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "#fef9c3", text: "#854d0e" },
  open: { label: "Open", bg: "#dcfce7", text: "#166534" },
  active: { label: "Live", bg: "#dbeafe", text: "#1e40af" },
  completed: { label: "Completed", bg: "#f3f4f6", text: "#6b7280" },
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default async function TournamentsPage() {
  const { tenant } = await requireTenant();

  const allTournaments = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.tenantId, tenant.id))
    .orderBy(desc(tournaments.createdAt));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tournaments</h1>
          <p className="text-gray-500 mt-1">Manage your fishing tournaments</p>
        </div>
        <Link
          href="/dashboard/tournaments/new"
          className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          + New Tournament
        </Link>
      </div>

      {allTournaments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <p className="text-4xl mb-4">🏆</p>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No tournaments yet</h2>
          <p className="text-gray-500 mb-6">Create your first tournament to get started.</p>
          <Link
            href="/dashboard/tournaments/new"
            className="bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-700 transition"
          >
            Create Tournament
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Name</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Date</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allTournaments.map((t) => {
                const s = STATUS_LABELS[t.status] ?? STATUS_LABELS.draft!;
                return (
                  <tr key={t.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/tournaments/${t.id}`}
                        className="font-medium text-gray-900 hover:text-blue-600 transition"
                      >
                        {t.name}
                      </Link>
                      {t.description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                          {t.description}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(t.startDate)}</td>
                    <td className="px-6 py-4">
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: s.bg, color: s.text }}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/dashboard/tournaments/${t.id}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          Manage
                        </Link>
                        {t.status === "draft" && (
                          <form
                            action={async () => {
                              "use server";
                              await updateTournamentStatus(t.id, "open");
                            }}
                          >
                            <button
                              type="submit"
                              className="text-green-600 hover:underline font-medium"
                            >
                              Publish
                            </button>
                          </form>
                        )}
                      </div>
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
