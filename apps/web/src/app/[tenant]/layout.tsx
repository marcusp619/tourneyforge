import { notFound } from "next/navigation";
import { db, tenants } from "@tourneyforge/db";
import { eq } from "drizzle-orm";
import { resolveTheme, themeToCssVars } from "@tourneyforge/themes";
import Link from "next/link";
import type { Metadata } from "next";

interface TenantLayoutProps {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant: slug } = await params;
  const [tenant] = await db
    .select({ name: tenants.name, tagline: tenants.tagline })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant) return { title: "Not Found" };

  return {
    title: {
      default: tenant.name,
      template: `%s | ${tenant.name}`,
    },
    description: tenant.tagline ?? `Fishing tournaments managed by ${tenant.name}`,
  };
}

export default async function TenantLayout({ children, params }: TenantLayoutProps) {
  const { tenant: slug } = await params;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  if (!tenant) notFound();

  const theme = resolveTheme(tenant);
  const cssVars = themeToCssVars(theme);

  return (
    <div
      style={cssVars as React.CSSProperties}
      className="min-h-screen flex flex-col"
    >
      <style>{`
        :root { font-family: var(--font-family); }
        .btn-primary {
          background-color: var(--color-primary);
          color: #fff;
          padding: 0.625rem 1.25rem;
          border-radius: 0.5rem;
          font-weight: 600;
          transition: opacity 0.15s;
        }
        .btn-primary:hover { opacity: 0.85; }
        .card {
          background-color: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 0.75rem;
          padding: 1.5rem;
        }
      `}</style>

      {/* Tenant header */}
      <header
        style={{ backgroundColor: "var(--color-primary)" }}
        className="text-white shadow-md"
      >
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={`/${slug}`} className="flex items-center gap-3">
            {tenant.logoUrl ? (
              <img
                src={tenant.logoUrl}
                alt={`${tenant.name} logo`}
                className="h-10 w-auto object-contain"
              />
            ) : (
              <span className="text-2xl">🎣</span>
            )}
            <span className="text-xl font-bold">{tenant.name}</span>
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              href={`/${slug}/tournaments`}
              className="text-white/90 hover:text-white font-medium transition"
            >
              Tournaments
            </Link>
            <Link
              href="/sign-in"
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-medium transition"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main
        className="flex-1"
        style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}
      >
        {children}
      </main>

      {/* Footer */}
      <footer
        style={{
          backgroundColor: "var(--color-surface)",
          borderTop: "1px solid var(--color-border)",
          color: "var(--color-muted)",
        }}
        className="py-8"
      >
        <div className="max-w-6xl mx-auto px-4 text-center text-sm">
          <p>
            &copy; {new Date().getFullYear()} {tenant.name}. Powered by{" "}
            <a
              href="https://tourneyforge.com"
              className="hover:underline"
              style={{ color: "var(--color-primary)" }}
            >
              TourneyForge
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
