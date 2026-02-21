"use server";

import { auth } from "@clerk/nextjs/server";
import { db, tournaments, tournamentDivisions } from "@tourneyforge/db";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant";
import { z } from "zod";

const tournamentFormSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  registrationDeadline: z.string().optional(),
  scoringFormatId: z.string().uuid().optional(),
});

export async function createTournament(formData: FormData) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { tenant } = await requireTenant();

  const parsed = tournamentFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    registrationDeadline: formData.get("registrationDeadline") || undefined,
    scoringFormatId: formData.get("scoringFormatId") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const { name, description, startDate, endDate, registrationDeadline, scoringFormatId } =
    parsed.data;

  const [tournament] = await db
    .insert(tournaments)
    .values({
      tenantId: tenant.id,
      name,
      description: description ?? null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
      status: "draft",
      scoringFormatId: scoringFormatId ?? null,
    })
    .returning();

  revalidatePath("/dashboard/tournaments");
  redirect(`/dashboard/tournaments/${tournament!.id}`);
}

export async function updateTournament(id: string, formData: FormData) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { tenant } = await requireTenant();

  const parsed = tournamentFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    registrationDeadline: formData.get("registrationDeadline") || undefined,
    scoringFormatId: formData.get("scoringFormatId") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const { name, description, startDate, endDate, registrationDeadline, scoringFormatId } =
    parsed.data;

  await db
    .update(tournaments)
    .set({
      name,
      description: description ?? null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
      scoringFormatId: scoringFormatId ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(tournaments.id, id), eq(tournaments.tenantId, tenant.id)));

  revalidatePath(`/dashboard/tournaments/${id}`);
  revalidatePath("/dashboard/tournaments");
  redirect(`/dashboard/tournaments/${id}`);
}

export async function updateTournamentStatus(
  id: string,
  status: "draft" | "open" | "active" | "completed"
) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { tenant } = await requireTenant();

  await db
    .update(tournaments)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(tournaments.id, id), eq(tournaments.tenantId, tenant.id)));

  revalidatePath(`/dashboard/tournaments/${id}`);
  revalidatePath("/dashboard/tournaments");
}

export async function deleteTournament(id: string) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { tenant } = await requireTenant();

  await db
    .delete(tournaments)
    .where(and(eq(tournaments.id, id), eq(tournaments.tenantId, tenant.id)));

  revalidatePath("/dashboard/tournaments");
  redirect("/dashboard/tournaments");
}

// Division actions
const divisionFormSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export async function createDivision(tournamentId: string, formData: FormData) {
  const { tenant } = await requireTenant();

  const parsed = divisionFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }

  await db.insert(tournamentDivisions).values({
    tenantId: tenant.id,
    tournamentId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
  });

  revalidatePath(`/dashboard/tournaments/${tournamentId}`);
}

export async function deleteDivision(tournamentId: string, divisionId: string) {
  const { tenant } = await requireTenant();

  await db
    .delete(tournamentDivisions)
    .where(
      and(
        eq(tournamentDivisions.id, divisionId),
        eq(tournamentDivisions.tenantId, tenant.id)
      )
    );

  revalidatePath(`/dashboard/tournaments/${tournamentId}`);
}
