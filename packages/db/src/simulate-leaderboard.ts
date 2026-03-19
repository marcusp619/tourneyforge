/**
 * Live Leaderboard Simulator
 *
 * Sets the Spring Bass Classic tournament to "active" and drip-feeds catches
 * every few seconds so you can watch the leaderboard update in real time.
 *
 * Usage:
 *   cd packages/db
 *   bun run src/simulate-leaderboard.ts
 *
 * Visit: http://localhost:3000/midwest-bass/tournaments/<id>/leaderboard
 * (The tournament ID is printed when the script starts.)
 *
 * Options (env vars):
 *   INTERVAL_MS=5000   ms between catch batches (default: 5000)
 *   BATCH_SIZE=2       catches per batch (default: 2)
 *   RESET=true         wipe existing sim data and start fresh
 */

import { db } from "./index";
import {
  tenants,
  tournaments,
  users,
  teams,
  catches,
  species,
  registrations,
} from "./schema";
import { eq, and } from "drizzle-orm";

const INTERVAL_MS = Number(process.env.INTERVAL_MS ?? 5000);
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? 2);
const RESET = process.env.RESET === "true";

const SIM_TEAMS = [
  { name: "Reel Warriors",    captain: "sim-user-1", boat: "Bass Blaster" },
  { name: "Hook & Sinker",    captain: "sim-user-2", boat: "Deep Striker" },
  { name: "Lake Legends",     captain: "sim-user-3", boat: "Wave Runner" },
  { name: "Bass Assassins",   captain: "sim-user-4", boat: "Night Crawler" },
  { name: "The Bite Squad",   captain: "sim-user-5", boat: "Fin Chaser" },
  { name: "Mud Puppy Crew",   captain: "sim-user-6", boat: "Bottom Dweller" },
];

// Realistic bass catch weights (oz) — biased toward typical 1–4 lb fish
const WEIGHT_POOL_OZ = [
  16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40, 44, 48, 56, 64, 72, 80,
];
// Lengths in inches (12–22 in)
const LENGTH_POOL_IN = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

async function main() {
  console.log("🎣 TourneyForge — Live Leaderboard Simulator\n");

  // 1. Find the midwest-bass tenant
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.slug, "midwest-bass"))
    .limit(1);
  if (!tenant) {
    console.error("❌ Tenant 'midwest-bass' not found. Run `pnpm db:seed` first.");
    process.exit(1);
  }

  // 2. Find Spring Bass Classic
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.tenantId, tenant.id),
        eq(tournaments.name, "Spring Bass Classic 2026")
      )
    )
    .limit(1);
  if (!tournament) {
    console.error("❌ Tournament 'Spring Bass Classic 2026' not found. Run `pnpm db:seed` first.");
    process.exit(1);
  }

  // 3. Find Largemouth Bass species
  const [lmbSpecies] = await db
    .select()
    .from(species)
    .where(eq(species.name, "Largemouth Bass"))
    .limit(1);
  if (!lmbSpecies) {
    console.error("❌ Species 'Largemouth Bass' not found. Run `pnpm db:seed` first.");
    process.exit(1);
  }

  // 4. Optionally wipe existing sim data
  if (RESET) {
    console.log("🗑  RESET=true — clearing existing simulation catches, teams, registrations...");
    await db.delete(catches).where(eq(catches.tournamentId, tournament.id));
    await db.delete(registrations).where(eq(registrations.tournamentId, tournament.id));
    await db.delete(teams).where(eq(teams.tournamentId, tournament.id));
    console.log("   ✅ Cleared\n");
  }

  // 5. Set tournament to active
  await db
    .update(tournaments)
    .set({ status: "active" })
    .where(eq(tournaments.id, tournament.id));
  console.log(`✅ Tournament set to ACTIVE`);
  console.log(`🔗 Leaderboard: http://localhost:3000/midwest-bass/tournaments/${tournament.id}/leaderboard\n`);

  // 6. Ensure sim users exist
  for (let i = 1; i <= SIM_TEAMS.length; i++) {
    const clerkId = `sim-user-${i}`;
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkId))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(users).values({
        id: clerkId,
        clerkUserId: clerkId,
        email: `sim-user-${i}@dev.local`,
      });
    }
  }

  // 7. Ensure teams + registrations exist
  const teamIds: string[] = [];
  for (const simTeam of SIM_TEAMS) {
    const existing = await db
      .select()
      .from(teams)
      .where(
        and(eq(teams.tournamentId, tournament.id), eq(teams.name, simTeam.name))
      )
      .limit(1);

    if (existing.length > 0) {
      teamIds.push(existing[0]!.id);
    } else {
      const [inserted] = await db
        .insert(teams)
        .values({
          tenantId: tenant.id,
          tournamentId: tournament.id,
          name: simTeam.name,
          captainId: simTeam.captain,
          boatName: simTeam.boat,
        })
        .returning();
      teamIds.push(inserted!.id);

      await db.insert(registrations).values({
        tenantId: tenant.id,
        tournamentId: tournament.id,
        teamId: inserted!.id,
        status: "confirmed",
        paymentStatus: "paid",
      });
    }
  }
  console.log(`✅ ${SIM_TEAMS.length} teams ready: ${SIM_TEAMS.map((t) => t.name).join(", ")}\n`);
  console.log(`⏱  Inserting ${BATCH_SIZE} catch(es) every ${INTERVAL_MS / 1000}s. Ctrl+C to stop.\n`);

  // 8. Drip-feed catches
  let round = 1;
  const interval = setInterval(async () => {
    const newCatches = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
      const teamId = pick(teamIds);
      const weightOz = pick(WEIGHT_POOL_OZ);
      const lengthIn = pick(LENGTH_POOL_IN);
      newCatches.push({
        tenantId: tenant.id,
        tournamentId: tournament.id,
        teamId,
        speciesId: lmbSpecies.id,
        weight: String(weightOz),
        length: String(lengthIn),
        timestamp: new Date(),
        verified: "true" as const,
        verifiedAt: new Date(),
      });
    }

    await db.insert(catches).values(newCatches);

    const summary = newCatches
      .map((c) => {
        const team = SIM_TEAMS[teamIds.indexOf(c.teamId)]!;
        return `  • ${team.name}: ${(Number(c.weight) / 16).toFixed(2)} lbs`;
      })
      .join("\n");

    console.log(`[Round ${round++}] +${BATCH_SIZE} catch(es):\n${summary}`);
  }, INTERVAL_MS);

  process.on("SIGINT", () => {
    clearInterval(interval);
    console.log("\n\n🛑 Simulation stopped.");
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
