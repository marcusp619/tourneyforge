import { notFound } from "next/navigation";
import { db, tenants, tournaments } from "@tourneyforge/db";
import { eq, and, or } from "drizzle-orm";
import { resolveTheme } from "@tourneyforge/themes";
import Link from "next/link";

interface TenantPageProps {
  params: Promise<{ tenant: string }>;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function tournamentStatusBadge(status: string) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    open: { bg: "#dcfce7", text: "#166534", label: "Open for Registration" },
    active: { bg: "#dbeafe", text: "#1e40af", label: "Live Now" },
    draft: { bg: "#f3f4f6", text: "#6b7280", label: "Coming Soon" },
    completed: { bg: "#f3f4f6", text: "#6b7280", label: "Completed" },
  };
  const s = styles[status] ?? styles.draft!;
  return (
    <span
      className="text-xs font-semibold px-2 py-1 rounded-full"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

export default async function TenantHomePage({ params }: TenantPageProps) {
  const { tenant: slug } = await params;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant) notFound();

  const theme = resolveTheme(tenant);

  // Fetch upcoming + active tournaments (not draft, not completed)
  const upcomingTournaments = await db
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.tenantId, tenant.id),
        or(eq(tournaments.status, "open"), eq(tournaments.status, "active"))
      )
    )
    .limit(6);

  const heroIsGradient = theme.heroStyle === "gradient";

  return (
    <div>
      {/* Hero section */}
      <section
        className="py-20 px-4"
        style={
          heroIsGradient
            ? {
                background: `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.accentColor} 100%)`,
                color: "#fff",
              }
            : tenant.heroImageUrl
            ? {
                backgroundImage: `url(${tenant.heroImageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                color: "#fff",
                position: "relative",
              }
            : {
                backgroundColor: "var(--color-surface)",
                color: "var(--color-text)",
              }
        }
      >
        {tenant.heroImageUrl && !heroIsGradient && (
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.45)" }}
          />
        )}
        <div className="max-w-4xl mx-auto text-center relative">
          <h1 className="text-5xl font-extrabold mb-4 leading-tight">{tenant.name}</h1>
          {tenant.tagline && (
            <p className="text-xl mb-8 opacity-90">{tenant.tagline}</p>
          )}
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href={`/${slug}/tournaments`}
              className="btn-primary inline-block"
              style={{ backgroundColor: heroIsGradient ? "#fff" : "var(--color-primary)", color: heroIsGradient ? theme.primaryColor : "#fff" }}
            >
              View Tournaments
            </Link>
            <Link
              href="/sign-up"
              className="inline-block px-5 py-2.5 rounded-lg font-semibold border-2 transition"
              style={{
                borderColor: heroIsGradient ? "#fff" : "var(--color-primary)",
                color: heroIsGradient ? "#fff" : "var(--color-primary)",
              }}
            >
              Register as Angler
            </Link>
          </div>
        </div>
      </section>

      {/* Upcoming tournaments */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-3xl font-bold mb-8"
            style={{ color: "var(--color-text)" }}
          >
            Upcoming Tournaments
          </h2>

          {upcomingTournaments.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-lg" style={{ color: "var(--color-muted)" }}>
                No tournaments scheduled yet. Check back soon!
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {upcomingTournaments.map((t) => (
                <Link
                  key={t.id}
                  href={`/${slug}/tournaments/${t.id}`}
                  className="card block hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3
                      className="text-lg font-semibold"
                      style={{ color: "var(--color-text)" }}
                    >
                      {t.name}
                    </h3>
                    {tournamentStatusBadge(t.status)}
                  </div>

                  {t.description && (
                    <p
                      className="text-sm mb-4 line-clamp-2"
                      style={{ color: "var(--color-muted)" }}
                    >
                      {t.description}
                    </p>
                  )}

                  <div className="space-y-1">
                    <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                      <span className="font-medium" style={{ color: "var(--color-text)" }}>
                        Date:{" "}
                      </span>
                      {formatDate(t.startDate)}
                    </p>
                    {t.registrationDeadline && (
                      <p className="text-sm" style={{ color: "var(--color-muted)" }}>
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
                    View Details →
                  </div>
                </Link>
              ))}
            </div>
          )}

          {upcomingTournaments.length > 0 && (
            <div className="mt-8 text-center">
              <Link
                href={`/${slug}/tournaments`}
                className="btn-primary inline-block"
              >
                See All Tournaments
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
