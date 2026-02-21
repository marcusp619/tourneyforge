import { db } from "./index";
import { tenants } from "./schema/tenants";
import { users } from "./schema/users";
import { tournaments, scoringFormats } from "./schema/tournaments";
import { species } from "./schema/teams-catches";
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
    themePreset: "classic",
    tagline: "The Midwest's Premier Bass Tournament Series",
  },
  {
    name: "Carolina Kayak Fishing",
    slug: "carolina-kayak",
    plan: "starter" as const,
    themePreset: "coastal",
    tagline: "CPR Tournament Fishing — Catch, Photo, Release",
  },
  {
    name: "Lake Norman Bass Club",
    slug: "lake-norman-bass",
    plan: "free" as const,
    themePreset: "forest",
    tagline: "Lake Norman's Local Bass Fishing Community",
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

const seedSpecies = [
  // Bass
  { name: "Largemouth Bass", commonName: "Largemouth Bass", scientificName: "Micropterus salmoides" },
  { name: "Smallmouth Bass", commonName: "Smallmouth Bass", scientificName: "Micropterus dolomieu" },
  { name: "Spotted Bass", commonName: "Spotted Bass", scientificName: "Micropterus punctulatus" },
  { name: "Striped Bass", commonName: "Striped Bass", scientificName: "Morone saxatilis" },
  { name: "White Bass", commonName: "White Bass", scientificName: "Morone chrysops" },
  { name: "Rock Bass", commonName: "Rock Bass", scientificName: "Ambloplites rupestris" },
  // Crappie & Panfish
  { name: "Black Crappie", commonName: "Black Crappie", scientificName: "Pomoxis nigromaculatus" },
  { name: "White Crappie", commonName: "White Crappie", scientificName: "Pomoxis annularis" },
  { name: "Bluegill", commonName: "Bluegill", scientificName: "Lepomis macrochirus" },
  { name: "Redear Sunfish", commonName: "Shellcracker", scientificName: "Lepomis microlophus" },
  { name: "Pumpkinseed", commonName: "Pumpkinseed", scientificName: "Lepomis gibbosus" },
  // Pike family
  { name: "Northern Pike", commonName: "Northern Pike", scientificName: "Esox lucius" },
  { name: "Muskellunge", commonName: "Musky", scientificName: "Esox masquinongy" },
  { name: "Tiger Musky", commonName: "Tiger Musky", scientificName: "Esox masquinongy × lucius" },
  { name: "Chain Pickerel", commonName: "Chain Pickerel", scientificName: "Esox niger" },
  // Walleye & Perch
  { name: "Walleye", commonName: "Walleye", scientificName: "Sander vitreus" },
  { name: "Sauger", commonName: "Sauger", scientificName: "Sander canadensis" },
  { name: "Yellow Perch", commonName: "Yellow Perch", scientificName: "Perca flavescens" },
  // Catfish
  { name: "Channel Catfish", commonName: "Channel Cat", scientificName: "Ictalurus punctatus" },
  { name: "Blue Catfish", commonName: "Blue Cat", scientificName: "Ictalurus furcatus" },
  { name: "Flathead Catfish", commonName: "Flathead Cat", scientificName: "Pylodictis olivaris" },
  // Trout & Salmon
  { name: "Rainbow Trout", commonName: "Rainbow Trout", scientificName: "Oncorhynchus mykiss" },
  { name: "Brown Trout", commonName: "Brown Trout", scientificName: "Salmo trutta" },
  { name: "Brook Trout", commonName: "Brookie", scientificName: "Salvelinus fontinalis" },
  { name: "Lake Trout", commonName: "Laker", scientificName: "Salvelinus namaycush" },
  { name: "Chinook Salmon", commonName: "King Salmon", scientificName: "Oncorhynchus tshawytscha" },
  { name: "Coho Salmon", commonName: "Silver Salmon", scientificName: "Oncorhynchus kisutch" },
  // Carp & Other
  { name: "Common Carp", commonName: "Common Carp", scientificName: "Cyprinus carpio" },
  { name: "Grass Carp", commonName: "Grass Carp", scientificName: "Ctenopharyngodon idella" },
  { name: "Bowfin", commonName: "Bowfin", scientificName: "Amia calva" },
  { name: "Gar", commonName: "Longnose Gar", scientificName: "Lepisosteus osseus" },
  // Saltwater (common inshore)
  { name: "Redfish", commonName: "Red Drum", scientificName: "Sciaenops ocellatus" },
  { name: "Speckled Trout", commonName: "Spotted Seatrout", scientificName: "Cynoscion nebulosus" },
  { name: "Flounder", commonName: "Southern Flounder", scientificName: "Paralichthys lethostigma" },
  { name: "Snook", commonName: "Common Snook", scientificName: "Centropomus undecimalis" },
  { name: "Tarpon", commonName: "Tarpon", scientificName: "Megalops atlanticus" },
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
  await db.delete(species);

  // Seed species (system-wide)
  console.log("🐟 Seeding species...");
  await db.insert(species).values(seedSpecies);
  console.log(`   ✅ Created ${seedSpecies.length} species`);

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
