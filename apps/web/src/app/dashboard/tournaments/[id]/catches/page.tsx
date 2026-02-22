import { requireTenant } from "@/lib/tenant";
import { db, tournaments, catches, teams, species } from "@tourneyforge/db";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyCatch, deleteCatch } from "@/actions/catches";
import { AiVerifyButton } from "./AiVerifyButton";

interface Props {
  params: Promise<{ id: string }>;
}

function formatWeight(oz: string): string {
  const n = Number(oz);
  const lbs = Math.floor(n / 16);
  const rem = (n % 16).toFixed(1);
  return lbs > 0 ? `${lbs} lb ${rem} oz` : `${rem} oz`;
}

function formatLength(inches: string): string {
  return `${Number(inches).toFixed(1)}"`;
}

export default async function TournamentCatchesPage({ params }: Props) {
  const { id } = await params;
  const { tenant } = await requireTenant();

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(and(eq(tournaments.id, id), eq(tournaments.tenantId, tenant.id)))
    .limit(1);

  if (!tournament) notFound();

  const rows = await db
    .select({
      id: catches.id,
      teamId: catches.teamId,
      teamName: teams.name,
      speciesName: species.commonName,
      weight: catches.weight,
      length: catches.length,
      photoUrl: catches.photoUrl,
      verified: catches.verified,
      verifiedAt: catches.verifiedAt,
      timestamp: catches.timestamp,
      latitude: catches.latitude,
      longitude: catches.longitude,
    })
    .from(catches)
    .innerJoin(teams, eq(teams.id, catches.teamId))
    .innerJoin(species, eq(species.id, catches.speciesId))
    .where(and(eq(catches.tournamentId, id), eq(catches.tenantId, tenant.id)))
    .orderBy(catches.timestamp);

  const verifiedCount = rows.filter((r) => r.verified === "true").length;

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
          <h1 className="text-2xl font-bold text-gray-900">Catch Log</h1>
          <p className="text-gray-500 mt-1">
            {rows.length} total · {verifiedCount} verified
          </p>
        </div>
        <Link
          href={`/${tenant.slug}/tournaments/${id}/leaderboard`}
          target="_blank"
          className="text-sm font-medium text-gray-500 hover:text-gray-700 px-3 py-2 border border-gray-200 rounded-lg transition"
        >
          Public Leaderboard ↗
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <p className="text-4xl mb-4">🎣</p>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No catches yet</h2>
          <p className="text-gray-500 text-sm">
            Catches submitted by anglers will appear here for review.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const isVerified = row.verified === "true";
            const verifyAction = verifyCatch.bind(null, row.id, !isVerified);
            const deleteAction = deleteCatch.bind(null, row.id, id);
            return (
              <div
                key={row.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-4"
              >
                {/* Photo */}
                <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                  {row.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.photoUrl} alt="Catch" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🐟</div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-900">{row.teamName}</span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-sm text-gray-600">{row.speciesName ?? "Unknown species"}</span>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full ml-auto"
                      style={isVerified
                        ? { backgroundColor: "#dcfce7", color: "#166534" }
                        : { backgroundColor: "#fef9c3", color: "#854d0e" }}
                    >
                      {isVerified ? "Verified" : "Pending"}
                    </span>
                  </div>
                  <div className="flex gap-4 text-sm text-gray-600 mb-2">
                    <span>⚖️ {formatWeight(row.weight)}</span>
                    <span>📏 {formatLength(row.length)}</span>
                    {row.latitude && row.longitude && (
                      <span className="text-xs text-gray-400">
                        📍 {Number(row.latitude).toFixed(4)}, {Number(row.longitude).toFixed(4)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short", day: "numeric",
                      hour: "numeric", minute: "2-digit", hour12: true,
                    }).format(row.timestamp)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <form action={verifyAction}>
                    <button
                      type="submit"
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition w-full"
                      style={isVerified
                        ? { borderColor: "#d1d5db", color: "#6b7280" }
                        : { backgroundColor: "#166534", color: "#fff", borderColor: "#166534" }}
                    >
                      {isVerified ? "Unverify" : "Verify"}
                    </button>
                  </form>
                  {row.photoUrl && !isVerified && (
                    <AiVerifyButton
                      catchId={row.id}
                      tournamentId={id}
                      photoUrl={row.photoUrl}
                      speciesName={row.speciesName ?? null}
                    />
                  )}
                  <form action={deleteAction}>
                    <button
                      type="submit"
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition w-full"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
