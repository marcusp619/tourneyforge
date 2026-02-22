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

export interface AiVerifyResult {
  isValidFish: boolean;
  detectedSpecies: string | null;
  confidence: "high" | "medium" | "low";
  estimatedWeightOz: number | null;
  estimatedLengthIn: number | null;
  notes: string;
  autoApproved: boolean;
}

/**
 * Call the AI API to verify a catch photo.
 * If the AI auto-approves, also marks the catch as verified in the DB.
 */
export async function aiVerifyCatch(
  catchId: string,
  tournamentId: string,
  imageUrl: string,
  expectedSpecies?: string
): Promise<AiVerifyResult> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { tenant } = await requireTenant();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const res = await fetch(`${apiUrl}/api/ai/verify-catch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl, expectedSpecies }),
  });

  if (!res.ok) {
    const body = (await res.json()) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `AI API error: ${res.status}`);
  }

  const json = (await res.json()) as { data: AiVerifyResult };
  const result = json.data;

  // Auto-approve: mark as verified in DB
  if (result.autoApproved) {
    await db
      .update(catches)
      .set({ verified: "true", verifiedAt: new Date() })
      .where(and(eq(catches.id, catchId), eq(catches.tenantId, tenant.id)));

    revalidatePath(`/dashboard/tournaments/${tournamentId}/catches`);
  }

  return result;
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
