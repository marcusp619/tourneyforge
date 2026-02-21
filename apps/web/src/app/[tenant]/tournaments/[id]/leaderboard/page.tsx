import { notFound } from "next/navigation";
import { db, tenants, tournaments, catches, teams, scoringFormats } from "@tourneyforge/db";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";
import { calculateStandings, type ScoringInput } from "@tourneyforge/scoring";
import LeaderboardRefresher from "./LeaderboardRefresher";

// Revalidate every 15 seconds for near-real-time standings
export const revalidate = 15;

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
  return { title: `Leaderboard — ${t?.name ?? "Tournament"}` };
}

function formatWeight(oz: number): string {
  const lbs = Math.floor(oz / 16);
  const rem = (oz % 16).toFixed(1);
  return lbs > 0 ? `${lbs} lb ${rem} oz` : `${rem} oz`;
}

function formatLength(inches: number): string {
  return `${inches.toFixed(1)}"`;
}

export default async function LeaderboardPage({ params }: Props) {
  const { tenant: slug, id } = await params;

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
  if (!tournament || tournament.status === "draft") notFound();

  const isLive = tournament.status === "active";

  // Compute standings
  let scoringFormat: "weight" | "length" | "count" = "weight";
  let scoringOptions: ScoringInput["options"] = {};

  if (tournament.scoringFormatId) {
    const [fmt] = await db
      .select()
      .from(scoringFormats)
      .where(eq(scoringFormats.id, tournament.scoringFormatId))
      .limit(1);
    if (fmt) {
      if (fmt.type === "weight" || fmt.type === "length" || fmt.type === "count") {
        scoringFormat = fmt.type;
      }
      try {
        const rules = JSON.parse(fmt.rules) as Record<string, unknown>;
        if (typeof rules["fishLimit"] === "number") scoringOptions = { ...scoringOptions, maxCatches: rules["fishLimit"] as number };
        if (typeof rules["minimumSize"] === "number") scoringOptions = { ...scoringOptions, minimumSize: rules["minimumSize"] as number };
      } catch { /* ignore */ }
    }
  }

  const [tournamentCatches, tournamentTeams] = await Promise.all([
    db.select().from(catches).where(eq(catches.tournamentId, id)),
    db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.tournamentId, id)),
  ]);

  const teamNames = new Map(tournamentTeams.map((t) => [t.id, t.name]));

  const input: ScoringInput = {
    catches: tournamentCatches.map((c) => ({
      id: c.id,
      teamId: c.teamId,
      speciesId: c.speciesId,
      weight: Number(c.weight),
      length: Number(c.length),
      timestamp: c.timestamp,
    })),
    format: scoringFormat,
    ...(Object.keys(scoringOptions ?? {}).length > 0 ? { options: scoringOptions } : {}),
  };

  const result = calculateStandings(input);
  const leaderboard = result.leaderboard.map((e) => ({
    ...e,
    teamName: teamNames.get(e.teamId) ?? e.teamId,
  }));

  const scoreLabel = scoringFormat === "weight" ? "Total Weight" : scoringFormat === "length" ? "Total Length" : "Fish Count";
  const formatScore = (score: number) =>
    scoringFormat === "weight" ? formatWeight(score) :
    scoringFormat === "length" ? formatLength(score) :
    `${score} fish`;

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <nav className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
        <Link href={`/${slug}`} className="hover:underline">{tenant.name}</Link>
        {" / "}
        <Link href={`/${slug}/tournaments`} className="hover:underline">Tournaments</Link>
        {" / "}
        <Link href={`/${slug}/tournaments/${id}`} className="hover:underline">{tournament.name}</Link>
        {" / "}
        <span style={{ color: "var(--color-text)" }}>Leaderboard</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h1 className="text-3xl font-extrabold flex-1" style={{ color: "var(--color-text)" }}>
          Leaderboard
        </h1>
        {isLive && (
          <span className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: "#dcfce7", color: "#166534" }}>
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            Live
          </span>
        )}
      </div>
      <p className="text-base mb-6" style={{ color: "var(--color-muted)" }}>
        {tournament.name} · {result.totalCatches} {result.totalCatches === 1 ? "catch" : "catches"} recorded
      </p>

      {/* Auto-refresh client component (hidden, triggers page reload) */}
      {isLive && <LeaderboardRefresher intervalSeconds={15} />}

      {leaderboard.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-4xl mb-4">🎣</p>
          <p className="text-lg font-semibold mb-1" style={{ color: "var(--color-text)" }}>
            No catches yet
          </p>
          <p style={{ color: "var(--color-muted)" }} className="text-sm">
            {isLive ? "Catches will appear here as anglers submit them." : "No catches were recorded for this tournament."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {leaderboard.map((entry) => {
            const medal = medals[entry.rank - 1] ?? null;
            return (
              <div
                key={entry.teamId}
                className="card flex items-center gap-4"
                style={entry.rank === 1 ? { borderColor: "var(--color-primary)", borderWidth: 2 } : {}}
              >
                {/* Rank */}
                <div className="text-center w-10 flex-shrink-0">
                  {medal ? (
                    <span className="text-2xl">{medal}</span>
                  ) : (
                    <span className="text-lg font-bold" style={{ color: "var(--color-muted)" }}>
                      {entry.rank}
                    </span>
                  )}
                </div>

                {/* Team */}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base truncate" style={{ color: "var(--color-text)" }}>
                    {entry.teamName}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-muted)" }}>
                    {entry.details["catchCount"] ?? 0} {(entry.details["catchCount"] ?? 0) === 1 ? "catch" : "catches"}
                  </p>
                </div>

                {/* Score */}
                <div className="text-right flex-shrink-0">
                  <p className="font-extrabold text-lg" style={{ color: "var(--color-primary)" }}>
                    {formatScore(entry.score)}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                    {scoreLabel}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href={`/${slug}/tournaments/${id}`} className="text-sm font-medium hover:underline" style={{ color: "var(--color-primary)" }}>
          ← Back to Tournament
        </Link>
      </div>
    </div>
  );
}
