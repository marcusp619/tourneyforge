import { requireTenant } from "@/lib/tenant";
import { db, tournaments, tournamentDivisions, scoringFormats } from "@tourneyforge/db";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  updateTournament,
  updateTournamentStatus,
  deleteTournament,
  createDivision,
  deleteDivision,
} from "@/actions/tournaments";

interface Props {
  params: Promise<{ id: string }>;
}

function formatDatetimeLocal(date: Date) {
  // Convert to YYYY-MM-DDTHH:mm for datetime-local input
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

const STATUS_FLOW: Record<string, { next: string; label: string; color: string } | null> = {
  draft: { next: "open", label: "Publish (Open for Registration)", color: "#16a34a" },
  open: { next: "active", label: "Start Tournament", color: "#1d4ed8" },
  active: { next: "completed", label: "Complete Tournament", color: "#6b7280" },
  completed: null,
};

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "#fef9c3", text: "#854d0e" },
  open: { label: "Open", bg: "#dcfce7", text: "#166534" },
  active: { label: "Live", bg: "#dbeafe", text: "#1e40af" },
  completed: { label: "Completed", bg: "#f3f4f6", text: "#6b7280" },
};

export default async function TournamentDetailPage({ params }: Props) {
  const { id } = await params;
  const { tenant } = await requireTenant();

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(and(eq(tournaments.id, id), eq(tournaments.tenantId, tenant.id)))
    .limit(1);

  if (!tournament) notFound();

  const [divisions, formats] = await Promise.all([
    db
      .select()
      .from(tournamentDivisions)
      .where(and(eq(tournamentDivisions.tournamentId, id), eq(tournamentDivisions.tenantId, tenant.id))),
    db.select().from(scoringFormats).where(eq(scoringFormats.tenantId, tenant.id)),
  ]);

  const statusInfo = STATUS_LABELS[tournament.status] ?? STATUS_LABELS.draft!;
  const nextStatus = STATUS_FLOW[tournament.status];

  const updateThisTournament = updateTournament.bind(null, id);

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/dashboard/tournaments" className="text-gray-400 hover:text-gray-600 text-sm">
              ← Tournaments
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: statusInfo.bg, color: statusInfo.text }}
            >
              {statusInfo.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {nextStatus && (
            <form
              action={async () => {
                "use server";
                await updateTournamentStatus(
                  id,
                  nextStatus.next as "draft" | "open" | "active" | "completed"
                );
              }}
            >
              <button
                type="submit"
                className="text-sm font-semibold px-4 py-2 rounded-lg text-white transition hover:opacity-90"
                style={{ backgroundColor: nextStatus.color }}
              >
                {nextStatus.label}
              </button>
            </form>
          )}
          <Link
            href={`/${tenant.slug}/tournaments/${id}`}
            target="_blank"
            className="text-sm font-medium text-gray-500 hover:text-gray-700 px-3 py-2 border border-gray-200 rounded-lg transition"
          >
            View Public Page ↗
          </Link>
        </div>
      </div>

      {/* Edit form */}
      <form action={updateThisTournament} className="space-y-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Tournament Details</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={tournament.name}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={tournament.description ?? ""}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="startDate">
                Start Date & Time
              </label>
              <input
                id="startDate"
                name="startDate"
                type="datetime-local"
                required
                defaultValue={formatDatetimeLocal(tournament.startDate)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="endDate">
                End Date & Time
              </label>
              <input
                id="endDate"
                name="endDate"
                type="datetime-local"
                required
                defaultValue={formatDatetimeLocal(tournament.endDate)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-1.5"
              htmlFor="registrationDeadline"
            >
              Registration Deadline
            </label>
            <input
              id="registrationDeadline"
              name="registrationDeadline"
              type="datetime-local"
              defaultValue={
                tournament.registrationDeadline
                  ? formatDatetimeLocal(tournament.registrationDeadline)
                  : ""
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-1.5"
              htmlFor="scoringFormatId"
            >
              Scoring Format
            </label>
            <select
              id="scoringFormatId"
              name="scoringFormatId"
              defaultValue={tournament.scoringFormatId ?? ""}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— None —</option>
              {formats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.type})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button
              type="submit"
              className="bg-blue-600 text-white font-semibold px-5 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
            >
              Save Changes
            </button>
          </div>
        </div>
      </form>

      {/* Divisions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <h2 className="font-semibold text-gray-900 mb-4">Divisions</h2>
        <p className="text-sm text-gray-500 mb-5">
          Optionally split the tournament into angler categories (e.g. Pro, Co-Angler, Youth).
        </p>

        {divisions.length > 0 && (
          <ul className="space-y-2 mb-5">
            {divisions.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <span className="text-sm font-medium text-gray-900">{d.name}</span>
                  {d.description && (
                    <span className="text-xs text-gray-400 ml-2">{d.description}</span>
                  )}
                </div>
                <form
                  action={async () => {
                    "use server";
                    await deleteDivision(id, d.id);
                  }}
                >
                  <button type="submit" className="text-xs text-red-500 hover:text-red-700">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form
          action={createDivision.bind(null, id)}
          className="flex gap-3 items-end"
        >
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="divName">
              Division Name
            </label>
            <input
              id="divName"
              name="name"
              type="text"
              required
              placeholder="e.g. Pro, Co-Angler, Youth"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1" htmlFor="divDesc">
              Description (optional)
            </label>
            <input
              id="divDesc"
              name="description"
              type="text"
              placeholder="Optional"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="bg-gray-800 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-900 transition flex-shrink-0"
          >
            Add Division
          </button>
        </form>
      </div>

      {/* Danger zone */}
      {tournament.status === "draft" && (
        <div className="bg-white rounded-xl border border-red-200 p-6">
          <h2 className="font-semibold text-red-700 mb-2">Danger Zone</h2>
          <p className="text-sm text-gray-500 mb-4">
            Delete this tournament permanently. This cannot be undone.
          </p>
          <form
            action={async () => {
              "use server";
              await deleteTournament(id);
            }}
          >
            <button
              type="submit"
              className="bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-700 transition"
            >
              Delete Tournament
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
