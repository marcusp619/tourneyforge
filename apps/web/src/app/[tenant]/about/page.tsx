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
  return { title: `About | ${tenant?.name ?? slug}` };
}

export default async function AboutPage({ params }: Props) {
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
        <span style={{ color: "var(--color-text)" }}>About</span>
      </nav>

      <h1 className="text-4xl font-extrabold mb-8" style={{ color: "var(--color-text)" }}>
        About {tenant.name}
      </h1>

      {tenant.aboutText ? (
        <div
          className="card prose max-w-none"
          style={{ color: "var(--color-text)" }}
        >
          {tenant.aboutText.split("\n").map((para, i) =>
            para.trim() ? (
              <p key={i} className="mb-4 leading-relaxed" style={{ color: "var(--color-text)" }}>
                {para}
              </p>
            ) : (
              <br key={i} />
            )
          )}
        </div>
      ) : (
        <div className="card text-center py-16">
          <p className="text-4xl mb-4">🎣</p>
          <p className="text-lg font-semibold mb-2" style={{ color: "var(--color-text)" }}>
            About page coming soon
          </p>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            {tenant.name} hasn&apos;t added their about page yet.
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
