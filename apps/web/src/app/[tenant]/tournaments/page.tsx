import { notFound } from "next/navigation";
import { db, tenants, tournaments } from "@tourneyforge/db";
import { eq, and, ne, desc } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";

interface TournamentsPageProps {
  params: Promise<{ tenant: string }>;
}

export async function generateMetadata({ params }: TournamentsPageProps): Promise<Metadata> {
  const { tenant: slug } = await params;
  const [tenant] = await db
    .select({ name: tenants.name })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  return { title: `Tournaments | ${tenant?.name ?? slug}` };
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

const STATUS_ORDER: Record<string, number> = { active: 0, open: 1, draft: 2, completed: 3 };

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string; text: string; label: string }> = {
    open: { bg: "#dcfce7", text: "#166534", label: "Open" },
    active: { bg: "#dbeafe", text: "#1e40af", label: "Live" },
    draft: { bg: "#fef9c3", text: "#854d0e", label: "Coming Soon" },
    completed: { bg: "#f3f4f6", text: "#6b7280", label: "Completed" },
  };
  const c = configs[status] ?? configs.draft!;
  return (
    <span
      className="text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}

export default async function TournamentsPage({ params }: TournamentsPageProps) {
  const { tenant: slug } = await params;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant) notFound();

  // All non-draft tournaments visible to public, plus active/open drafts via direct link
  const allTournaments = await db
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.tenantId, tenant.id),
        ne(tournaments.status, "draft")
      )
    )
    .orderBy(desc(tournaments.startDate));

  // Group by status for display
  const grouped = {
    live: allTournaments.filter((t) => t.status === "active"),
    upcoming: allTournaments.filter((t) => t.status === "open"),
    completed: allTournaments.filter((t) => t.status === "completed"),
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1
        className="text-4xl font-extrabold mb-2"
        style={{ color: "var(--color-text)" }}
      >
        Tournaments
      </h1>
      <p className="mb-10" style={{ color: "var(--color-muted)" }}>
        All tournaments hosted by {tenant.name}
      </p>

      {allTournaments.length === 0 && (
        <div className="card text-center py-16">
          <p className="text-lg" style={{ color: "var(--color-muted)" }}>
            No tournaments have been published yet.
          </p>
        </div>
      )}

      {grouped.live.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--color-primary)" }}>
            Live Now
          </h2>
          <TournamentGrid tournaments={grouped.live} slug={slug} />
        </section>
      )}

      {grouped.upcoming.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--color-text)" }}>
            Upcoming
          </h2>
          <TournamentGrid tournaments={grouped.upcoming} slug={slug} />
        </section>
      )}

      {grouped.completed.length > 0 && (
        <section className="mb-12">
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: "var(--color-muted)" }}
          >
            Past Tournaments
          </h2>
          <TournamentGrid tournaments={grouped.completed} slug={slug} muted />
        </section>
      )}
    </div>
  );
}

function TournamentGrid({
  tournaments: ts,
  slug,
  muted = false,
}: {
  tournaments: Array<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    startDate: Date;
    endDate: Date;
    registrationDeadline: Date | null;
  }>;
  slug: string;
  muted?: boolean;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {ts.map((t) => (
        <Link
          key={t.id}
          href={`/${slug}/tournaments/${t.id}`}
          className="card block hover:shadow-lg transition-shadow"
          style={muted ? { opacity: 0.75 } : {}}
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
              {t.name}
            </h3>
            <StatusBadge status={t.status} />
          </div>

          {t.description && (
            <p
              className="text-sm mb-4 line-clamp-2"
              style={{ color: "var(--color-muted)" }}
            >
              {t.description}
            </p>
          )}

          <div className="space-y-1 text-sm">
            <p style={{ color: "var(--color-muted)" }}>
              <span className="font-medium" style={{ color: "var(--color-text)" }}>
                {t.status === "completed" ? "Held" : "Date"}:{" "}
              </span>
              {formatDate(t.startDate)}
            </p>
            {t.registrationDeadline && t.status !== "completed" && (
              <p style={{ color: "var(--color-muted)" }}>
                <span className="font-medium" style={{ color: "var(--color-text)" }}>
                  Deadline:{" "}
                </span>
                {formatDate(t.registrationDeadline)}
              </p>
            )}
          </div>

          <div
            className="mt-4 text-sm font-semibold"
            style={{ color: "var(--color-primary)" }}
          >
            {t.status === "completed" ? "View Results →" : "View Details →"}
          </div>
        </Link>
      ))}
    </div>
  );
}
