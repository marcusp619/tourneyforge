import { requireTenant } from "@/lib/tenant";
import { db, marketplaceSponsors } from "@tourneyforge/db";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import Image from "next/image";

export const metadata = { title: "Sponsor Marketplace | Dashboard" };

const BUDGET_LABELS: Record<string, { label: string; color: string }> = {
  local: { label: "Local (<$500)", color: "#6b7280" },
  regional: { label: "Regional ($500–$2.5k)", color: "#2563eb" },
  national: { label: "National ($2.5k+)", color: "#7c3aed" },
};

export default async function MarketplaceDashboardPage() {
  await requireTenant(); // ensures director is logged in

  const sponsors = await db
    .select()
    .from(marketplaceSponsors)
    .where(eq(marketplaceSponsors.active, true))
    .orderBy(desc(marketplaceSponsors.featured), desc(marketplaceSponsors.createdAt));

  // Collect unique categories across all listings
  const allCategories = Array.from(
    new Set(
      sponsors.flatMap((s) =>
        s.categories
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      )
    )
  ).sort();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Sponsor Marketplace</h1>
        <p className="text-gray-500 mt-1">
          Browse brands and companies looking to sponsor fishing tournaments. Reach out directly to connect.
        </p>
      </div>

      {/* Category chips */}
      {allCategories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {allCategories.map((cat) => (
            <span
              key={cat}
              className="text-xs font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-600 capitalize"
            >
              {cat}
            </span>
          ))}
        </div>
      )}

      {sponsors.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <p className="text-4xl mb-4">🤝</p>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No sponsors listed yet</h2>
          <p className="text-gray-500 text-sm">
            Brands can register at{" "}
            <Link href="/marketplace" className="text-blue-600 hover:underline">
              tourneyforge.com/marketplace
            </Link>{" "}
            to appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {sponsors.map((sponsor) => {
            const budget = BUDGET_LABELS[sponsor.budgetTier] ?? BUDGET_LABELS.local!;
            const categories = sponsor.categories
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean);

            return (
              <div
                key={sponsor.id}
                className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col"
              >
                {/* Featured badge */}
                {sponsor.featured && (
                  <div className="flex items-center gap-1 mb-3">
                    <span className="text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
                      Featured
                    </span>
                  </div>
                )}

                {/* Logo + name */}
                <div className="flex items-center gap-3 mb-3">
                  {sponsor.logoUrl ? (
                    <Image
                      src={sponsor.logoUrl}
                      alt={sponsor.name}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-lg object-contain border border-gray-100 bg-gray-50"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xl font-bold">
                      {sponsor.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900">{sponsor.name}</h3>
                    <span
                      className="text-xs font-medium"
                      style={{ color: budget.color }}
                    >
                      {budget.label}
                    </span>
                  </div>
                </div>

                {/* Description */}
                {sponsor.description && (
                  <p className="text-sm text-gray-500 mb-3 line-clamp-3">
                    {sponsor.description}
                  </p>
                )}

                {/* Categories */}
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {categories.map((cat) => (
                      <span
                        key={cat}
                        className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 capitalize"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-auto flex gap-3">
                  <a
                    href={`mailto:${sponsor.contactEmail}?subject=Sponsorship Inquiry – TourneyForge Tournament`}
                    className="flex-1 text-center text-sm font-semibold bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
                  >
                    Contact
                  </a>
                  {sponsor.website && (
                    <a
                      href={sponsor.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center text-sm font-semibold border border-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-50 transition"
                    >
                      Website
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info panel */}
      <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-6 text-sm text-gray-600">
        <p className="font-semibold text-gray-800 mb-1">How it works</p>
        <p>
          Sponsors listed here have opted in to be contacted by tournament directors. Click{" "}
          <strong>Contact</strong> to open a pre-filled email, or visit their website to learn more.
          Once you agree on terms, add them to your tournament via{" "}
          <Link href="/dashboard/tournaments" className="text-blue-600 hover:underline">
            Tournaments → Sponsors
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
