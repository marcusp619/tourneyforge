import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/dashboard/tournaments", label: "Tournaments", icon: "🏆" },
  { href: "/dashboard/scoring-formats", label: "Scoring Formats", icon: "📏" },
  { href: "/dashboard/settings", label: "Site & Theme", icon: "🎨" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-5 border-b border-gray-100">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🎣</span>
            <span className="font-bold text-gray-900">TourneyForge</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/" />
            <span className="text-sm text-gray-600">Account</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <div />
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">Dashboard</span>
          </div>
        </header>
        <main className="flex-1 p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
