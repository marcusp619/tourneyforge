import { notFound } from "next/navigation";
import { db, tenants, tournaments } from "@tourneyforge/db";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";

interface TournamentDetailPageProps {
  params: Promise<{ tenant: string; id: string }>;
}

export async function generateMetadata({
  params,
}: TournamentDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const [tournament] = await db
    .select({ name: tournaments.name })
    .from(tournaments)
    .where(eq(tournaments.id, id))
    .limit(1);
  return { title: tournament?.name ?? "Tournament" };
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(date);
}

export default async function TournamentDetailPage({
  params,
}: TournamentDetailPageProps) {
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

  const isOpen = tournament.status === "open";
  const isActive = tournament.status === "active";
  const isCompleted = tournament.status === "completed";

  const registrationOpen =
    isOpen &&
    (!tournament.registrationDeadline ||
      tournament.registrationDeadline > new Date());

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Breadcrumb */}
      <nav className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
        <Link href={`/${slug}`} className="hover:underline">
          {tenant.name}
        </Link>
        {" / "}
        <Link href={`/${slug}/tournaments`} className="hover:underline">
          Tournaments
        </Link>
        {" / "}
        <span style={{ color: "var(--color-text)" }}>{tournament.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-start gap-4 mb-3">
          <h1
            className="text-4xl font-extrabold flex-1"
            style={{ color: "var(--color-text)" }}
          >
            {tournament.name}
          </h1>
          <StatusChip status={tournament.status} />
        </div>
        {tournament.description && (
          <p className="text-lg" style={{ color: "var(--color-muted)" }}>
            {tournament.description}
          </p>
        )}
      </div>

      {/* Details card */}
      <div className="card mb-8">
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: "var(--color-text)" }}
        >
          Tournament Details
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
              Tournament Date
            </dt>
            <dd className="text-base mt-1" style={{ color: "var(--color-text)" }}>
              {formatDate(tournament.startDate)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
              Start Time
            </dt>
            <dd className="text-base mt-1" style={{ color: "var(--color-text)" }}>
              {formatTime(tournament.startDate)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
              End Time
            </dt>
            <dd className="text-base mt-1" style={{ color: "var(--color-text)" }}>
              {formatTime(tournament.endDate)}
            </dd>
          </div>
          {tournament.registrationDeadline && (
            <div>
              <dt className="text-sm font-medium" style={{ color: "var(--color-muted)" }}>
                Registration Deadline
              </dt>
              <dd className="text-base mt-1" style={{ color: "var(--color-text)" }}>
                {formatDate(tournament.registrationDeadline)}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* CTA */}
      {registrationOpen && (
        <div
          className="rounded-xl p-6 mb-8"
          style={{
            background: `linear-gradient(135deg, var(--color-primary), var(--color-accent, var(--color-primary)))`,
            color: "#fff",
          }}
        >
          <h2 className="text-xl font-bold mb-2">Registration is Open!</h2>
          <p className="text-sm opacity-90 mb-4">
            {tournament.registrationDeadline
              ? `Register before ${formatDate(tournament.registrationDeadline)}.`
              : "Register now to secure your spot."}
          </p>
          <Link
            href={`/${slug}/tournaments/${id}/register`}
            className="inline-block bg-white font-semibold px-6 py-3 rounded-lg transition hover:opacity-90"
            style={{ color: "var(--color-primary)" }}
          >
            Register Now →
          </Link>
        </div>
      )}

      {isActive && (
        <div
          className="card mb-8"
          style={{ borderColor: "var(--color-primary)", borderWidth: 2 }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <h2
                className="text-lg font-bold"
                style={{ color: "var(--color-primary)" }}
              >
                Tournament is Live!
              </h2>
              <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                Check the leaderboard for live standings.
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-3 flex-wrap">
            <Link href={`/${slug}/tournaments/${id}/leaderboard`} className="btn-primary inline-block">
              View Live Leaderboard
            </Link>
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="card mb-8">
          <h2
            className="text-lg font-bold mb-3"
            style={{ color: "var(--color-text)" }}
          >
            Tournament Results
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>
            This tournament has concluded. View the final standings below.
          </p>
          <Link href={`/${slug}/tournaments/${id}/leaderboard`} className="btn-primary inline-block">
            View Final Results
          </Link>
        </div>
      )}

      {/* Back link */}
      <Link
        href={`/${slug}/tournaments`}
        className="text-sm font-medium hover:underline"
        style={{ color: "var(--color-primary)" }}
      >
        ← Back to All Tournaments
      </Link>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const configs: Record<string, { bg: string; color: string; label: string }> = {
    open: { bg: "#dcfce7", color: "#166534", label: "Open for Registration" },
    active: { bg: "#dbeafe", color: "#1e40af", label: "Live Now" },
    draft: { bg: "#fef9c3", color: "#854d0e", label: "Coming Soon" },
    completed: { bg: "#f3f4f6", color: "#6b7280", label: "Completed" },
  };
  const c = configs[status] ?? configs.draft!;
  return (
    <span
      className="text-sm font-bold px-3 py-1.5 rounded-full"
      style={{ backgroundColor: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  );
}
