import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-100 max-w-6xl mx-auto">
        <span className="text-xl font-bold text-gray-900">TourneyForge</span>
        <div className="flex items-center gap-4">
          <Link href="/marketplace" className="text-sm text-gray-600 hover:text-gray-900 transition">
            Browse Tournaments
          </Link>
          <Link href="/sign-in" className="text-sm text-gray-600 hover:text-gray-900 transition">
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-8 py-24 text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-6 leading-tight">
          Run Better Fishing Tournaments
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          Professional tournament sites, online registration, Stripe payments, and live leaderboards —
          up and running in minutes.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/sign-up"
            className="px-7 py-3.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition text-base"
          >
            Start Free
          </Link>
          <Link
            href="/marketplace"
            className="px-7 py-3.5 border border-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition text-base"
          >
            Browse Tournaments
          </Link>
        </div>
      </div>

      {/* Feature grid */}
      <div className="max-w-6xl mx-auto px-8 pb-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: "🎨",
              title: "Branded Tournament Sites",
              desc: "Custom domain, colors, logo, and theme. Your club — your brand.",
            },
            {
              icon: "💳",
              title: "Online Registration & Payments",
              desc: "Stripe Connect sends entry fees straight to your bank. Platform fee: 1.5–3.5%.",
            },
            {
              icon: "🏆",
              title: "Live Leaderboards",
              desc: "Real-time standings as catches come in. Multiple scoring formats supported.",
            },
            {
              icon: "📱",
              title: "Mobile Catch Submission",
              desc: "Anglers submit catches from the field with GPS, weight, and photo evidence.",
            },
            {
              icon: "🤖",
              title: "AI Catch Verification",
              desc: "Claude AI analyzes fish photos to confirm species and flag suspicious submissions.",
            },
            {
              icon: "🤝",
              title: "Sponsor Marketplace",
              desc: "Connect with brands looking to sponsor local, regional, and national tournaments.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-gray-100 bg-gray-50 p-7">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 text-center text-xs text-gray-400">
        &copy; {new Date().getFullYear()} TourneyForge. All rights reserved.
      </footer>
    </main>
  );
}
