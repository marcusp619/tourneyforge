import { notFound } from "next/navigation";
import { db, tenants } from "@tourneyforge/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";

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
  return { title: `Rules | ${tenant?.name ?? slug}` };
}

export default async function RulesPage({ params }: Props) {
  const { tenant: slug } = await params;

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);
  if (!tenant) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Breadcrumb */}
      <nav className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
        <Link href={`/${slug}`} className="hover:underline">{tenant.name}</Link>
        {" / "}
        <span style={{ color: "var(--color-text)" }}>Rules</span>
      </nav>

      <h1 className="text-4xl font-extrabold mb-8" style={{ color: "var(--color-text)" }}>
        Tournament Rules
      </h1>

      {tenant.rulesText ? (
        <div className="card" style={{ color: "var(--color-text)" }}>
          {tenant.rulesText.split("\n").map((line, i) =>
            line.trim() ? (
              <p key={i} className="mb-4 leading-relaxed" style={{ color: "var(--color-text)" }}>
                {line}
              </p>
            ) : (
              <br key={i} />
            )
          )}
        </div>
      ) : (
        <div className="card text-center py-16">
          <p className="text-4xl mb-4">📋</p>
          <p className="text-lg font-semibold mb-2" style={{ color: "var(--color-text)" }}>
            Rules page coming soon
          </p>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            {tenant.name} hasn&apos;t published their rules yet.
          </p>
        </div>
      )}

      <div className="mt-8">
        <Link
          href={`/${slug}/tournaments`}
          className="text-sm font-medium hover:underline"
          style={{ color: "var(--color-primary)" }}
        >
          ← View Tournaments
        </Link>
      </div>
    </div>
  );
}
