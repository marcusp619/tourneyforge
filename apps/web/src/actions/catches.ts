"use server";

import { auth } from "@clerk/nextjs/server";
import { db, catches } from "@tourneyforge/db";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/tenant";

export async function verifyCatch(catchId: string, verified: boolean) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { tenant } = await requireTenant();

  await db
    .update(catches)
    .set({
      verified: verified ? "true" : "false",
      verifiedAt: verified ? new Date() : null,
    })
    .where(and(eq(catches.id, catchId), eq(catches.tenantId, tenant.id)));

  revalidatePath("/dashboard/tournaments");
}

export async function deleteCatch(catchId: string, tournamentId: string) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { tenant } = await requireTenant();

  await db
    .delete(catches)
    .where(and(eq(catches.id, catchId), eq(catches.tenantId, tenant.id)));

  revalidatePath(`/dashboard/tournaments/${tournamentId}/catches`);
}
