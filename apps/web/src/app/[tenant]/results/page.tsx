import { notFound } from "next/navigation";
import { db, tenants, tournaments, catches, teams, scoringFormats } from "@tourneyforge/db";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";
import { calculateStandings, type ScoringInput } from "@tourneyforge/scoring";

export const revalidate = 60;

interface Props {
  params: Promise<{ tenant: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tenant: slug } = await params;
  const [tenant] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  return { title: `Results Archive | ${tenant?.name ?? slug}` };
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatWeight(oz: number): string {
  const lbs = Math.floor(oz / 16);
  const rem = (oz % 16).toFixed(1);
  return lbs > 0 ? `${lbs} lb ${rem} oz` : `${rem} oz`;
}

function formatScore(score: number, format: string): string {
  if (format === "weight") return formatWeight(score);
  if (format === "length") return `${score.toFixed(1)}"`;
  return `${score} fish`;
}

const MEDALS = ["🥇", "🥈", "🥉"] as const;

export default async function ResultsPage({ params }: Props) {
  const { tenant: slug } = await params;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant) notFound();

  const completedTournaments = await db
    .select()
    .from(tournaments)
    .where(and(eq(tournaments.tenantId, tenant.id), eq(tournaments.status, "completed")));

  // Compute top-3 for each tournament
  const results = await Promise.all(
    completedTournaments.map(async (t) => {
      let scoringFormat: "weight" | "length" | "count" = "weight";
      let scoringOptions: ScoringInput["options"] = {};

      if (t.scoringFormatId) {
        const [fmt] = await db
          .select()
          .from(scoringFormats)
          .where(eq(scoringFormats.id, t.scoringFormatId))
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
        db.select().from(catches).where(eq(catches.tournamentId, t.id)),
        db.select({ id: teams.id, name: teams.name }).from(teams).where(eq(teams.tournamentId, t.id)),
      ]);

      const teamNames = new Map(tournamentTeams.map((tm) => [tm.id, tm.name]));

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

      const { leaderboard } = calculateStandings(input);
      const podium = leaderboard
        .filter((e) => e.rank <= 3)
        .map((e) => ({ ...e, teamName: teamNames.get(e.teamId) ?? "Unknown" }));

      return { tournament: t, podium, scoringFormat };
    })
  );

  // Sort newest first
  results.sort((a, b) => b.tournament.startDate.getTime() - a.tournament.startDate.getTime());

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Breadcrumb */}
      <nav className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
        <Link href={`/${slug}`} className="hover:underline">{tenant.name}</Link>
        {" / "}
        <span style={{ color: "var(--color-text)" }}>Results Archive</span>
      </nav>

      <h1 className="text-4xl font-extrabold mb-2" style={{ color: "var(--color-text)" }}>
        Results Archive
      </h1>
      <p className="mb-10" style={{ color: "var(--color-muted)" }}>
        Final standings from all completed {tenant.name} tournaments
      </p>

      {results.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-4xl mb-4">🏆</p>
          <p className="text-lg font-semibold mb-1" style={{ color: "var(--color-text)" }}>
            No completed tournaments yet
          </p>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Results will appear here once tournaments have concluded.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {results.map(({ tournament: t, podium, scoringFormat }) => (
            <div key={t.id} className="card">
              {/* Tournament header */}
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: "var(--color-text)" }}>
                    {t.name}
                  </h2>
                  <p className="text-sm mt-0.5" style={{ color: "var(--color-muted)" }}>
                    {formatDate(t.startDate)}
                  </p>
                </div>
                <Link
                  href={`/${slug}/tournaments/${t.id}/leaderboard`}
                  className="text-sm font-semibold hover:underline flex-shrink-0"
                  style={{ color: "var(--color-primary)" }}
                >
                  Full Results →
                </Link>
              </div>

              {/* Podium */}
              {podium.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  No catches recorded.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  {podium.map((entry) => (
                    <div
                      key={entry.teamId}
                      className="flex items-center gap-3 rounded-lg px-4 py-3"
                      style={{
                        backgroundColor: entry.rank === 1 ? "var(--color-primary)" : "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <span className="text-xl flex-shrink-0">{MEDALS[entry.rank - 1]}</span>
                      <div className="min-w-0">
                        <p
                          className="font-bold text-sm truncate"
                          style={{ color: entry.rank === 1 ? "#fff" : "var(--color-text)" }}
                        >
                          {entry.teamName}
                        </p>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: entry.rank === 1 ? "rgba(255,255,255,0.8)" : "var(--color-muted)" }}
                        >
                          {formatScore(entry.score, scoringFormat)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
