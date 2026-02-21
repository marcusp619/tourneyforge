import { db } from "./index";
import { tenants } from "./schema/tenants";
import { users } from "./schema/users";
import { tournaments } from "./schema/tournaments";
import { scoringFormats } from "./schema/tournaments";
import { tenantMembers } from "./schema/tenant-members";

/**
 * Seed script for development
 * Run with: bun run src/seed.ts
 */

// Seed data
const seedTenants = [
  {
    name: "Midwest Bass Trail",
    slug: "midwest-bass",
    plan: "pro" as const,
  },
  {
    name: "Carolina Kayak Fishing",
    slug: "carolina-kayak",
    plan: "starter" as const,
  },
  {
    name: "Lake Norman Bass Club",
    slug: "lake-norman-bass",
    plan: "free" as const,
  },
];

const seedUsers = [
  {
    id: "user-1",
    email: "director@midwestbass.com",
    firstName: "Mike",
    lastName: "Johnson",
    clerkUserId: "clerk-director-1",
  },
  {
    id: "user-2",
    email: "angler@test.com",
    firstName: "Jake",
    lastName: "Williams",
    clerkUserId: "clerk-angler-1",
  },
  {
    id: "user-3",
    email: "admin@tourneyforge.com",
    firstName: "Admin",
    lastName: "User",
    clerkUserId: "clerk-admin-1",
  },
];

const seedScoringFormats = [
  {
    name: "5-Fish Weight Limit",
    type: "weight" as const,
    rules: JSON.stringify({
      fishLimit: 5,
      measurementUnit: "lbs",
      deadFishPenalty: -0.25,
      minimumSize: 12, // inches
      scoringMethod: "sum_top_n",
    }),
  },
  {
    name: "CPR Length Format",
    type: "length" as const,
    rules: JSON.stringify({
      fishLimit: 3,
      measurementUnit: "inches",
      minimumSize: 15,
      scoringMethod: "sum_top_n",
      requirePhoto: true,
    }),
  },
];

async function seed() {
  console.log("🌱 Starting seed...");

  // Clear existing data (in development)
  console.log("🧹 Cleaning existing data...");
  await db.delete(tenantMembers);
  await db.delete(tournaments);
  await db.delete(scoringFormats);
  await db.delete(tenants);
  await db.delete(users);

  // Insert tenants
  console.log("📦 Seeding tenants...");
  const insertedTenants = await db.insert(tenants).values(seedTenants).returning();
  console.log(`   ✅ Created ${insertedTenants.length} tenants`);

  // Insert users
  console.log("👤 Seeding users...");
  await db.insert(users).values(seedUsers);
  console.log(`   ✅ Created ${seedUsers.length} users`);

  // Assign tenant members
  console.log("👥 Assigning tenant members...");
  await db.insert(tenantMembers).values([
    {
      tenantId: insertedTenants[0]!.id,
      userId: "user-1",
      role: "owner",
    },
    {
      tenantId: insertedTenants[0]!.id,
      userId: "user-2",
      role: "member",
    },
    {
      tenantId: insertedTenants[1]!.id,
      userId: "user-2",
      role: "admin",
    },
  ]);
  console.log(`   ✅ Created tenant memberships`);

  // Insert scoring formats for each tenant
  console.log("📊 Seeding scoring formats...");
  for (const tenant of insertedTenants) {
    await db.insert(scoringFormats).values(
      seedScoringFormats.map((format) => ({
        tenantId: tenant.id,
        ...format,
      }))
    );
  }
  console.log(`   ✅ Created scoring formats`);

  // Insert sample tournaments
  console.log("🏆 Seeding tournaments...");
  const midwestTenant = insertedTenants[0]!;
  await db.insert(tournaments).values([
    {
      tenantId: midwestTenant.id,
      name: "Spring Bass Classic 2026",
      description: "Our season opener on Lake Oahe",
      startDate: new Date("2026-04-15T06:00:00Z"),
      endDate: new Date("2026-04-15T15:00:00Z"),
      registrationDeadline: new Date("2026-04-10T23:59:59Z"),
      status: "open",
    },
    {
      tenantId: midwestTenant.id,
      name: "Summer Showdown",
      description: "Mid-summer championship event",
      startDate: new Date("2026-07-20T06:00:00Z"),
      endDate: new Date("2026-07-20T15:00:00Z"),
      registrationDeadline: new Date("2026-07-15T23:59:59Z"),
      status: "draft",
    },
  ]);
  console.log(`   ✅ Created tournaments`);

  console.log("\n✨ Seed complete!");
  console.log("\n📝 Test accounts:");
  console.log("   - Director: director@midwestbass.com (Tenant: midwest-bass)");
  console.log("   - Angler: angler@test.com");
  console.log("   - Admin: admin@tourneyforge.com");
}

seed()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
