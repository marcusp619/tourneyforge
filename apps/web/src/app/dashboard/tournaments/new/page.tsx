import { requireTenant } from "@/lib/tenant";
import { db, scoringFormats } from "@tourneyforge/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { createTournament } from "@/actions/tournaments";

export const metadata = { title: "New Tournament | Dashboard" };

export default async function NewTournamentPage() {
  const { tenant } = await requireTenant();

  const formats = await db
    .select()
    .from(scoringFormats)
    .where(eq(scoringFormats.tenantId, tenant.id));

  // Default start/end times (tomorrow at 6am–3pm local)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(6, 0, 0, 0);
  const defaultStart = tomorrow.toISOString().slice(0, 16);
  const defaultEnd = new Date(tomorrow.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 16);

  return (
    <div className="max-w-2xl">
      <div className="mb-8 flex items-center gap-3">
        <Link href="/dashboard/tournaments" className="text-gray-400 hover:text-gray-600">
          ← Tournaments
        </Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-2xl font-bold text-gray-900">New Tournament</h1>
      </div>

      <form action={createTournament} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Tournament Details</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="name">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={200}
              placeholder="e.g. Spring Bass Classic 2026"
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
              maxLength={5000}
              placeholder="Optional description shown on the public tournament page"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="startDate">
                Start Date & Time <span className="text-red-500">*</span>
              </label>
              <input
                id="startDate"
                name="startDate"
                type="datetime-local"
                required
                defaultValue={defaultStart}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="endDate">
                End Date & Time <span className="text-red-500">*</span>
              </label>
              <input
                id="endDate"
                name="endDate"
                type="datetime-local"
                required
                defaultValue={defaultEnd}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-400">Leave blank for no deadline</p>
          </div>

          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-1.5"
              htmlFor="scoringFormatId"
            >
              Scoring Format
            </label>
            {formats.length === 0 ? (
              <p className="text-sm text-amber-600">
                No scoring formats yet.{" "}
                <Link
                  href="/dashboard/scoring-formats/new"
                  className="underline font-medium"
                >
                  Create one first
                </Link>
                , then come back.
              </p>
            ) : (
              <select
                id="scoringFormatId"
                name="scoringFormatId"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— None selected —</option>
                {formats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.type})
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1 text-xs text-gray-400">
              Can be assigned later.{" "}
              <Link href="/dashboard/scoring-formats/new" className="text-blue-500 hover:underline">
                Create new format →
              </Link>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="bg-blue-600 text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-blue-700 transition"
          >
            Create Tournament
          </button>
          <Link href="/dashboard/tournaments" className="text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
