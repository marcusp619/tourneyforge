"use server";

import { requireTenant } from "@/lib/tenant";
import { db, sponsors, marketplaceSponsors } from "@tourneyforge/db";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { sendSponsorInquiry } from "@/lib/email";

export async function submitSponsorInquiry(
  sponsorId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const { tenant } = await requireTenant();

  const replyTo = (formData.get("replyTo") as string | null)?.trim();
  const message = (formData.get("message") as string | null)?.trim();

  if (!replyTo || !message) return { ok: false, error: "Email and message are required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) return { ok: false, error: "Invalid reply email." };
  if (message.length > 2000) return { ok: false, error: "Message must be under 2000 characters." };

  const [sponsor] = await db
    .select()
    .from(marketplaceSponsors)
    .where(and(eq(marketplaceSponsors.id, sponsorId), eq(marketplaceSponsors.active, true)))
    .limit(1);

  if (!sponsor) return { ok: false, error: "Sponsor not found." };

  return sendSponsorInquiry({
    to: sponsor.contactEmail,
    sponsorName: sponsor.name,
    directorName: tenant.name,
    replyTo,
    message,
  });
}

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
    .update(sponsors)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(sponsors.id, sponsorId), eq(sponsors.tenantId, tenant.id), isNull(sponsors.deletedAt)));

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
