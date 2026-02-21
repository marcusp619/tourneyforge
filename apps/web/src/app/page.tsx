import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-3xl text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-6">
          TourneyForge
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Professional fishing tournament management platform
        </p>
        <p className="text-gray-500 mb-12">
          Create beautiful tournament websites, manage registrations, process payments,
          and run live leaderboards — all in one place.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/sign-up"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Get Started Free
          </Link>
          <Link
            href="/sign-in"
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            Sign In
          </Link>
        </div>
        <p className="mt-8 text-sm text-gray-400">
          Phase 0 setup complete. Phase 1 coming soon.
        </p>
      </div>
    </main>
  );
}
