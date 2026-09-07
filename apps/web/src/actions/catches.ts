"use server";

import { db, catches } from "@tourneyforge/db";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant";

export async function verifyCatch(catchId: string, verified: boolean) {
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
  const { tenant } = await requireTenant();

  await db
    .update(catches)
    .set({ deletedAt: new Date() })
    .where(and(eq(catches.id, catchId), eq(catches.tenantId, tenant.id), isNull(catches.deletedAt)));

  revalidatePath(`/dashboard/tournaments/${tournamentId}/catches`);
}
