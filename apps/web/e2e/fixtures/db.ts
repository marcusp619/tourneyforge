/**
 * Direct database access for the E2E suite.
 *
 * Used for TWO things only, both scope gaps rather than shortcuts:
 *
 *  1. Reading back ids the UI never shows (team ids), so catches can be attached.
 *  2. Inserting catches. **No web UI creates a catch** — `apps/web/src/actions/catches.ts`
 *     exports only verifyCatch and deleteCatch. Task 18 closes that; until it does, this
 *     suite cannot submit a catch by clicking, and says so rather than pretending.
 *
 * It is NOT used to create tournaments, teams or registrations — those are made through
 * the browser, which is the entire point of the test.
 */
import { db, catches, teams, tournaments, species } from "@tourneyforge/db";
import { eq } from "drizzle-orm";

export async function tournamentIdByName(name: string): Promise<string> {
  const [row] = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(eq(tournaments.name, name))
    .limit(1);
  if (!row) throw new Error(`no tournament named "${name}" — the UI did not create it`);
  return row.id;
}

export async function teamIdsByName(tournamentId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.tournamentId, tournamentId));
  return new Map(rows.map((r) => [r.name, r.id]));
}

/** Attach catches to a team. Weight is ounces in a text column. */
export async function seedCatches(
  tournamentId: string,
  teamId: string,
  weightsOz: number[]
): Promise<void> {
  const [t] = await db
    .select({ tenantId: tournaments.tenantId })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!t) throw new Error(`tournament ${tournamentId} vanished`);
  const [sp] = await db.select({ id: species.id }).from(species).limit(1);
  if (!sp) throw new Error("no species seeded");
  await db.insert(catches).values(
    weightsOz.map((oz) => ({
      tenantId: t.tenantId,
      tournamentId,
      teamId,
      speciesId: sp.id,
      weight: String(oz),
      length: "20",
      timestamp: new Date(),
      verified: "true",
    }))
  );
}
