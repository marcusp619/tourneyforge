"use server";

import { auth } from "@clerk/nextjs/server";
import { db, scoringFormats } from "@tourneyforge/db";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant";
import { z } from "zod";

const scoringFormatFormSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["weight", "length", "count", "custom"]),
  fishLimit: z.coerce.number().int().positive().optional(),
  minimumSize: z.coerce.number().nonnegative().optional(),
  deadFishPenalty: z.coerce.number().optional(),
  requirePhoto: z.boolean().optional(),
  measurementUnit: z.string().optional(),
});

export async function createScoringFormat(formData: FormData) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { tenant } = await requireTenant();

  const parsed = scoringFormatFormSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    fishLimit: formData.get("fishLimit") || undefined,
    minimumSize: formData.get("minimumSize") || undefined,
    deadFishPenalty: formData.get("deadFishPenalty") || undefined,
    requirePhoto: formData.get("requirePhoto") === "on",
    measurementUnit: formData.get("measurementUnit") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const { name, type, fishLimit, minimumSize, deadFishPenalty, requirePhoto, measurementUnit } =
    parsed.data;

  const rules = JSON.stringify({
    ...(fishLimit !== undefined && { fishLimit }),
    ...(minimumSize !== undefined && { minimumSize }),
    ...(deadFishPenalty !== undefined && { deadFishPenalty }),
    requirePhoto: requirePhoto ?? false,
    measurementUnit: measurementUnit ?? (type === "weight" ? "lbs" : "inches"),
    scoringMethod: "sum_top_n",
  });

  await db.insert(scoringFormats).values({
    tenantId: tenant.id,
    name,
    type,
    rules,
  });

  revalidatePath("/dashboard/scoring-formats");
  redirect("/dashboard/scoring-formats");
}

export async function deleteScoringFormat(id: string) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { tenant } = await requireTenant();

  await db
    .delete(scoringFormats)
    .where(and(eq(scoringFormats.id, id), eq(scoringFormats.tenantId, tenant.id)));

  revalidatePath("/dashboard/scoring-formats");
}
