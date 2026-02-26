import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, users, tenants, tenantMembers } from "@tourneyforge/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

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

  let [user] = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);

  if (!user) {
    const [created] = await db
      .insert(users)
      .values({ id: crypto.randomUUID(), clerkUserId, email: `${clerkUserId}@placeholder.com` })
      .returning();
    user = created!;
  }

  const [tenant] = await db.insert(tenants).values({ name, slug, plan: "free" }).returning();

  await db.insert(tenantMembers).values({
    tenantId: tenant!.id,
    userId: user.id,
    role: "owner",
  });

  revalidatePath("/dashboard");
  redirect("/dashboard/settings?welcome=1");
}

export default function OnboardingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-5xl">🎣</span>
          <h1 className="text-2xl font-semibold tracking-tight mt-4">Set Up Your Organization</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Create your fishing club or tournament organization to get started.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form action={createOrganization} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Organization Name <span className="text-destructive">*</span>
                </Label>
                <Input id="name" name="name" required maxLength={100} placeholder="e.g. Midwest Bass Trail" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">
                  Site URL <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center rounded-md border border-input overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                  <span className="bg-muted border-r border-input px-3 py-2 text-sm text-muted-foreground shrink-0">
                    tourneyforge.com/
                  </span>
                  <input
                    id="slug"
                    name="slug"
                    required
                    maxLength={50}
                    pattern="[a-z0-9-]+"
                    title="Only lowercase letters, numbers, and hyphens"
                    placeholder="midwest-bass"
                    className="flex-1 px-3 py-2 text-sm bg-transparent focus:outline-none"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, numbers, and hyphens only. Cannot be changed later.
                </p>
              </div>

              <Button type="submit" className="w-full">Create Organization</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
