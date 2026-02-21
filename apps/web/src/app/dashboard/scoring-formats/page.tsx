import { requireTenant } from "@/lib/tenant";
import { db, scoringFormats } from "@tourneyforge/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { deleteScoringFormat } from "@/actions/scoring-formats";

export const metadata = { title: "Scoring Formats | Dashboard" };

const TYPE_LABELS: Record<string, string> = {
  weight: "Weight",
  length: "Length (CPR)",
  count: "Fish Count",
  custom: "Custom",
};

export default async function ScoringFormatsPage() {
  const { tenant } = await requireTenant();

  const formats = await db
    .select()
    .from(scoringFormats)
    .where(eq(scoringFormats.tenantId, tenant.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scoring Formats</h1>
          <p className="text-gray-500 mt-1">Define how fish catches are scored in your tournaments</p>
        </div>
        <Link
          href="/dashboard/scoring-formats/new"
          className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          + New Format
        </Link>
      </div>

      {formats.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <p className="text-4xl mb-4">📏</p>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No scoring formats yet</h2>
          <p className="text-gray-500 mb-6">
            Create a scoring format to assign to your tournaments.
          </p>
          <Link
            href="/dashboard/scoring-formats/new"
            className="bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-blue-700 transition"
          >
            Create Scoring Format
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {formats.map((f) => {
            let rules: Record<string, unknown> = {};
            try {
              rules = JSON.parse(f.rules) as Record<string, unknown>;
            } catch {
              // ignore
            }

            return (
              <div key={f.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{f.name}</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                    {TYPE_LABELS[f.type] ?? f.type}
                  </span>
                </div>

                <dl className="text-sm space-y-1.5 mb-4">
                  {rules.fishLimit !== undefined && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Fish limit</dt>
                      <dd className="font-medium text-gray-900">{String(rules.fishLimit)}</dd>
                    </div>
                  )}
                  {rules.minimumSize !== undefined && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Minimum size</dt>
                      <dd className="font-medium text-gray-900">
                        {String(rules.minimumSize)} {String(rules.measurementUnit ?? "")}
                      </dd>
                    </div>
                  )}
                  {rules.deadFishPenalty !== undefined && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Dead fish penalty</dt>
                      <dd className="font-medium text-gray-900">{String(rules.deadFishPenalty)} lbs</dd>
                    </div>
                  )}
                  {rules.requirePhoto !== undefined && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Photo required</dt>
                      <dd className="font-medium text-gray-900">
                        {rules.requirePhoto ? "Yes" : "No"}
                      </dd>
                    </div>
                  )}
                </dl>

                <form
                  action={async () => {
                    "use server";
                    await deleteScoringFormat(f.id);
                  }}
                >
                  <button
                    type="submit"
                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    Delete
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
