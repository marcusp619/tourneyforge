"use server";

import { requireTenant } from "@/lib/tenant";
import { db, sponsors } from "@tourneyforge/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createSponsor(tournamentId: string, formData: FormData) {
  const { tenant } = await requireTenant();

  const name = formData.get("name") as string;
  const website = (formData.get("website") as string) || null;
  const tier = (formData.get("tier") as "title" | "gold" | "silver" | "bronze") || "bronze";

  if (!name) throw new Error("Name is required");

  await db.insert(sponsors).values({
    tenantId: tenant.id,
    tournamentId,
    name,
    website: website && website.trim() ? website.trim() : null,
    logoUrl: null,
    tier,
    displayOrder: 0,
  });

  revalidatePath(`/dashboard/tournaments/${tournamentId}/sponsors`);
}

export async function deleteSponsor(sponsorId: string, tournamentId: string) {
  const { tenant } = await requireTenant();

  await db
    .delete(sponsors)
    .where(and(eq(sponsors.id, sponsorId), eq(sponsors.tenantId, tenant.id)));

  revalidatePath(`/dashboard/tournaments/${tournamentId}/sponsors`);
}

export async function updateSponsorTier(
  sponsorId: string,
  tournamentId: string,
  tier: "title" | "gold" | "silver" | "bronze"
) {
  const { tenant } = await requireTenant();

  await db
    .update(sponsors)
    .set({ tier, updatedAt: new Date() })
    .where(and(eq(sponsors.id, sponsorId), eq(sponsors.tenantId, tenant.id)));

  revalidatePath(`/dashboard/tournaments/${tournamentId}/sponsors`);
}
