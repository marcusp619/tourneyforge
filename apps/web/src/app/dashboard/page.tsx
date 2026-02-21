import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 mb-4">Welcome, User ID: {userId}</p>
          <p className="text-gray-500">
            This is a placeholder dashboard. The full dashboard will be built in Phase 1.
          </p>
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold mb-2">Coming Soon:</h3>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Tenant management</li>
              <li>Tournament creation</li>
              <li>Registration management</li>
              <li>Theme customization</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
