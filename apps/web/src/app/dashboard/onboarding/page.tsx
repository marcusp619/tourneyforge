import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, users, tenants, tenantMembers } from "@tourneyforge/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export const metadata = { title: "Set Up Your Organization | TourneyForge" };

async function createOrganization(formData: FormData) {
  "use server";

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const name = (formData.get("name") as string).trim();
  const slug = (formData.get("slug") as string)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");

  if (!name || !slug) throw new Error("Name and slug are required");

  // Find or create the internal user record
  let [user] = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);

  if (!user) {
    const [created] = await db
      .insert(users)
      .values({ id: crypto.randomUUID(), clerkUserId, email: `${clerkUserId}@placeholder.com` })
      .returning();
    user = created!;
  }

  // Create the tenant
  const [tenant] = await db
    .insert(tenants)
    .values({ name, slug, plan: "free" })
    .returning();

  // Make this user the owner
  await db.insert(tenantMembers).values({
    tenantId: tenant!.id,
    userId: user.id,
    role: "owner",
  });

  revalidatePath("/dashboard");
  // Send new directors straight to settings so they can set their theme and logo immediately
  redirect("/dashboard/settings?welcome=1");
}

export default function OnboardingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-4xl">🎣</span>
          <h1 className="text-2xl font-bold text-gray-900 mt-3">Set Up Your Organization</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Create your fishing club or tournament organization to get started.
          </p>
        </div>

        <form action={createOrganization} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="name">
              Organization Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={100}
              placeholder="e.g. Midwest Bass Trail"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="slug">
              Site Slug <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
              <span className="bg-gray-50 border-r border-gray-300 px-3 py-2 text-sm text-gray-500 flex-shrink-0">
                tourneyforge.com/
              </span>
              <input
                id="slug"
                name="slug"
                type="text"
                required
                maxLength={50}
                pattern="[a-z0-9-]+"
                title="Only lowercase letters, numbers, and hyphens"
                placeholder="midwest-bass"
                className="flex-1 px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Lowercase letters, numbers, hyphens only. Cannot be changed later.
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition"
          >
            Create Organization
          </button>
        </form>
      </div>
    </div>
  );
}
