import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const firstName = user?.firstName ?? "there";

  const cards = [
    {
      icon: "🏆",
      label: "Tournaments",
      description: "Create and manage your fishing tournaments",
      href: "/dashboard/tournaments",
      cta: "Manage Tournaments",
      color: "#1d4ed8",
    },
    {
      icon: "🎨",
      label: "Site & Theme",
      description: "Customize your public tournament site — colors, logo, tagline",
      href: "/dashboard/settings",
      cta: "Customize Site",
      color: "#7c3aed",
    },
    {
      icon: "👥",
      label: "Team Management",
      description: "View registered teams and anglers",
      href: "/dashboard/teams",
      cta: "View Teams",
      color: "#059669",
      comingSoon: true,
    },
    {
      icon: "📊",
      label: "Analytics",
      description: "Registration trends, revenue, and catch analytics",
      href: "/dashboard/analytics",
      cta: "View Analytics",
      color: "#0891b2",
    },
    {
      icon: "🤝",
      label: "Sponsor Marketplace",
      description: "Find brands looking to sponsor fishing tournaments",
      href: "/dashboard/marketplace",
      cta: "Browse Sponsors",
      color: "#7c3aed",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {firstName}!
        </h1>
        <p className="text-gray-500 mt-1">
          Manage your fishing tournaments and public site from here.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col"
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">{card.icon}</span>
              <h2 className="text-lg font-semibold text-gray-900">{card.label}</h2>
            </div>
            <p className="text-sm text-gray-500 flex-1 mb-4">{card.description}</p>
            {card.comingSoon ? (
              <span className="inline-block text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500">
                Coming Soon
              </span>
            ) : (
              <Link
                href={card.href}
                className="inline-block text-sm font-semibold px-4 py-2 rounded-lg text-white transition hover:opacity-90"
                style={{ backgroundColor: card.color }}
              >
                {card.cta}
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="mt-10 bg-blue-50 border border-blue-100 rounded-xl p-6">
        <h2 className="font-semibold text-gray-800 mb-2">Get Started</h2>
        <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
          <li>
            <Link href="/dashboard/settings" className="text-blue-600 hover:underline font-medium">
              Customize your site
            </Link>{" "}
            — choose a theme and upload your logo
          </li>
          <li>
            <Link href="/dashboard/tournaments" className="text-blue-600 hover:underline font-medium">
              Create your first tournament
            </Link>{" "}
            — set dates, divisions, and scoring format
          </li>
          <li>Share your tournament link with anglers to register</li>
        </ol>
      </div>
    </div>
  );
}
