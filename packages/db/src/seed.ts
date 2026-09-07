import { basename } from "node:path";
import { db } from "./index";
import { tenants } from "./schema/tenants";
import { users } from "./schema/users";
import { tournaments, scoringFormats } from "./schema/tournaments";
import type { NewScoringFormat } from "./schema/tournaments";
import { species } from "./schema/teams-catches";
import { tenantMembers } from "./schema/tenant-members";
import { marketplaceSponsors } from "./schema/marketplace";

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

/**
 * Fixed ids for the primary tenant's scoring formats.
 *
 * Tournaments must be inserted with a real `scoringFormatId` — without one the
 * leaderboard route in `packages/api/src/routes/leaderboards.ts` falls through to
 * its no-format branch and ranking is undefined. The ids are pinned here (rather
 * than left to the column's `defaultRandom()`) so `seedTournaments` below can
 * reference a format that this seed genuinely creates.
 *
 * The seed deletes every scoring format before inserting, so re-seeding cannot
 * collide on these primary keys.
 */
const WEIGHT_FORMAT_ID = "2fa76f7e-c016-47c1-9674-da5c554f742e";
const LENGTH_FORMAT_ID = "76ffce93-8673-49a4-9d33-455243e74914";

/**
 * Scoring-format ids pinned PER TENANT.
 *
 * Every tenant gets its own copy of every format, and a tournament must reference a
 * format belonging to *its own* tenant. Pointing carolina-kayak's tournament at
 * midwest-bass's format id would still satisfy a foreign key — the tables are related by
 * id, not by tenant — but it is a tenant-scope bug, and nothing in the database will stop
 * you (RLS is defined and not enforced; see tasks 11 and 12). `scripts/check-seed.ts`
 * asserts the ownership, which is the only thing that does.
 */
export const seedFormatIds: Record<string, { weight: string; length: string }> = {
  "midwest-bass": { weight: WEIGHT_FORMAT_ID, length: LENGTH_FORMAT_ID },
  "carolina-kayak": {
    weight: "3b7c1d2e-4f5a-4b6c-8d9e-0a1b2c3d4e5f",
    length: "4c8d2e3f-5a6b-4c7d-9e0f-1a2b3c4d5e6f",
  },
  "lake-norman-bass": {
    weight: "5d9e3f4a-6b7c-4d8e-a1f2-2b3c4d5e6f70",
    length: "6ea04f5b-7c8d-4e9f-b2a3-3c4d5e6f7081",
  },
};

export type SeedScoringFormat = {
  id: string;
  name: string;
  type: "weight" | "length" | "count" | "custom";
  rules: string;
};

export const seedScoringFormats: SeedScoringFormat[] = [
  {
    id: WEIGHT_FORMAT_ID,
    name: "5-Fish Weight Limit",
    type: "weight",
    rules: JSON.stringify({
      fishLimit: 5,
      measurementUnit: "lbs",
      deadFishPenalty: -0.25,
      minimumSize: 12, // inches
      scoringMethod: "sum_top_n",
    }),
  },
  {
    id: LENGTH_FORMAT_ID,
    name: "CPR Length Format",
    type: "length",
    rules: JSON.stringify({
      fishLimit: 3,
      measurementUnit: "inches",
      minimumSize: 15,
      scoringMethod: "sum_top_n",
      requirePhoto: true,
    }),
  },
];

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type SeedTournament = {
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  registrationDeadline: Date;
  status: "draft" | "open" | "active" | "completed";
  scoringFormatId: string;
  /** Slug of the tenant that owns this tournament. */
  tenantSlug: string;
};

/**
 * Tournament fixtures, always relative to the clock.
 *
 * These used to be hard-coded ISO date-string literals, which meant every
 * seeded tournament silently rotted into the past: the registration page
 * (`apps/web/src/app/[tenant]/tournaments/[id]/register/page.tsx`) calls
 * `notFound()` once `registrationDeadline` is behind `new Date()`, so a freshly
 * seeded database served a 404 on every "Register" link.
 *
 * `now` is a parameter so the guard in `scripts/check-seed.ts` can advance the
 * clock and prove the offsets really are derived from it.
 */
export function buildSeedTournaments(now: number = Date.now()): SeedTournament[] {
  return [
    {
      name: "Spring Bass Classic",
      description: "Season opener on Lake Oahe. Five-fish weight limit, 6am launch.",
      startDate: new Date(now + 21 * DAY_MS),
      endDate: new Date(now + 21 * DAY_MS + 9 * HOUR_MS),
      registrationDeadline: new Date(now + 14 * DAY_MS),
      status: "open",
      scoringFormatId: WEIGHT_FORMAT_ID,
      tenantSlug: "midwest-bass",
    },
    {
      name: "Lake Oahe Shootout",
      description:
        "On the water right now. Day-of entries accepted at the ramp until lines out.",
      startDate: new Date(now - 2 * HOUR_MS),
      endDate: new Date(now + 6 * HOUR_MS),
      registrationDeadline: new Date(now + 6 * HOUR_MS),
      status: "active",
      scoringFormatId: WEIGHT_FORMAT_ID,
      tenantSlug: "midwest-bass",
    },
    {
      name: "Summer Showdown",
      description: "Mid-summer championship. Catch, photo, release — longest three.",
      startDate: new Date(now + 90 * DAY_MS),
      endDate: new Date(now + 90 * DAY_MS + 9 * HOUR_MS),
      registrationDeadline: new Date(now + 83 * DAY_MS),
      status: "draft",
      scoringFormatId: LENGTH_FORMAT_ID,
      tenantSlug: "midwest-bass",
    },
    // Discovery in the mobile app is cross-club (see Decisions, 2026-09-02), so a seed
    // where one club owns every tournament makes the club attribution invisible and
    // leaves task 17's group-by-club picker with nothing to group.
    {
      name: "Outer Banks Kayak Open",
      description: "Catch, photo, release from a kayak. Longest three redfish take it.",
      startDate: new Date(now + 30 * DAY_MS),
      endDate: new Date(now + 30 * DAY_MS + 8 * HOUR_MS),
      registrationDeadline: new Date(now + 23 * DAY_MS),
      status: "open",
      scoringFormatId: seedFormatIds["carolina-kayak"]!.length,
      tenantSlug: "carolina-kayak",
    },
    {
      name: "Norman Night Bite",
      description: "After-dark summer series. Lines in at sunset, weigh-in at midnight.",
      startDate: new Date(now - 1 * HOUR_MS),
      endDate: new Date(now + 5 * HOUR_MS),
      registrationDeadline: new Date(now + 5 * HOUR_MS),
      status: "active",
      scoringFormatId: seedFormatIds["lake-norman-bass"]!.weight,
      tenantSlug: "lake-norman-bass",
    },
  ];
}

export const seedTournaments: SeedTournament[] = buildSeedTournaments();

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

const seedMarketplaceSponsors = [
  {
    name: "Bass Pro Shops",
    description: "America's largest retailer of outdoor sporting goods — tackle, boats, apparel, and more.",
    website: "https://www.basspro.com",
    contactEmail: "sponsorships@basspro.com",
    categories: "tackle,apparel,electronics,boats",
    budgetTier: "national" as const,
    featured: true,
    active: true,
  },
  {
    name: "Tackle Warehouse",
    description: "Online superstore for bass fishing lures, rods, reels, and terminal tackle.",
    website: "https://www.tacklewarehouse.com",
    contactEmail: "sponsor@tacklewarehouse.com",
    categories: "tackle,accessories",
    budgetTier: "regional" as const,
    featured: true,
    active: true,
  },
  {
    name: "Humminbird",
    description: "Industry-leading fish finders, chartplotters, and sonar technology for tournament anglers.",
    website: "https://www.humminbird.com",
    contactEmail: "tournaments@humminbird.com",
    categories: "electronics,sonar",
    budgetTier: "national" as const,
    featured: false,
    active: true,
  },
  {
    name: "Lew's Fishing",
    description: "Premium fishing rods and reels engineered for competitive tournament anglers.",
    website: "https://www.lewsfishing.com",
    contactEmail: "sponsorships@lewsfishing.com",
    categories: "rods,reels,tackle",
    budgetTier: "regional" as const,
    featured: false,
    active: true,
  },
  {
    name: "Mossy Oak",
    description: "Outdoor lifestyle brand offering camouflage apparel, headwear, and fishing gear.",
    website: "https://www.mossyoak.com",
    contactEmail: "events@mossyoak.com",
    categories: "apparel,accessories",
    budgetTier: "regional" as const,
    featured: false,
    active: true,
  },
  {
    name: "Costa Del Mar",
    description: "Performance sunglasses engineered for the water — the preferred choice of tournament anglers.",
    website: "https://www.costadelmar.com",
    contactEmail: "fishing@costadelmar.com",
    categories: "apparel,accessories",
    budgetTier: "national" as const,
    featured: false,
    active: true,
  },
  {
    name: "Berkley Fishing",
    description: "World's most trusted fishing line, soft baits, and hard baits since 1937.",
    website: "https://www.berkley-fishing.com",
    contactEmail: "sponsorships@berkley-fishing.com",
    categories: "tackle,line",
    budgetTier: "national" as const,
    featured: false,
    active: true,
  },
  {
    name: "Local Lake Marina",
    description: "Full-service marina and bait shop serving the local fishing community for over 30 years.",
    website: "https://example.com/localakemarina",
    contactEmail: "info@locallakemarina.com",
    categories: "bait,boats,fuel,food",
    budgetTier: "local" as const,
    featured: false,
    active: true,
  },
];

async function seed() {
  console.log("🌱 Starting seed...");

  // Clear existing data (in development)
  console.log("🧹 Cleaning existing data...");
  await db.delete(marketplaceSponsors);
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

  // Insert scoring formats for each tenant.
  // Every tenant listed in `seedFormatIds` gets PINNED ids, so a tournament in any club
  // can reference a format belonging to its own club. A tenant absent from that map
  // falls back to database-generated ids — which is fine only if it owns no tournament,
  // and `scripts/check-seed.ts` fails if it does.
  console.log("📊 Seeding scoring formats...");
  for (const tenant of insertedTenants) {
    const pinned = seedFormatIds[tenant.slug];
    const rows: NewScoringFormat[] = seedScoringFormats.map((format) => {
      const row: NewScoringFormat = {
        tenantId: tenant.id,
        name: format.name,
        type: format.type,
        rules: format.rules,
      };
      // Pin per tenant, so a tournament in any club can reference its OWN club's format.
      if (pinned) row.id = format.type === "weight" ? pinned.weight : pinned.length;
      return row;
    });
    await db.insert(scoringFormats).values(rows);
  }
  console.log(`   ✅ Created scoring formats`);

  // Insert sample tournaments (rebuilt off the clock at insert time)
  console.log("🏆 Seeding tournaments...");
  const tenantIdBySlug = new Map(insertedTenants.map((t) => [t.slug, t.id]));
  await db.insert(tournaments).values(
    buildSeedTournaments().map(({ tenantSlug, ...tournament }) => {
      const tenantId = tenantIdBySlug.get(tenantSlug);
      if (!tenantId) throw new Error(`seed: no tenant with slug "${tenantSlug}"`);
      return { tenantId, ...tournament };
    })
  );
  console.log(`   ✅ Created ${seedTournaments.length} tournaments`);

  // Seed marketplace sponsors (platform-wide)
  console.log("🤝 Seeding marketplace sponsors...");
  await db.insert(marketplaceSponsors).values(seedMarketplaceSponsors);
  console.log(`   ✅ Created ${seedMarketplaceSponsors.length} marketplace sponsor listings`);

  console.log("\n✨ Seed complete!");
  console.log("\n📝 Test accounts:");
  console.log("   - Director: director@midwestbass.com (Tenant: midwest-bass)");
  console.log("   - Angler: angler@test.com");
  console.log("   - Admin: admin@tourneyforge.com");
}

/**
 * Only write to the database when this file is the process entrypoint.
 *
 * `scripts/check-seed.ts` imports the fixtures above to assert they are still
 * valid; importing must never issue a DELETE. `import.meta.main` is the
 * idiomatic Bun spelling but this package typechecks as CommonJS
 * (`module: NodeNext`, no `"type": "module"`), where tsc rejects `import.meta`
 * outright with TS1470 — hence argv.
 */
if (basename(process.argv[1] ?? "") === "seed.ts") {
  seed()
    .catch((error) => {
      console.error("❌ Seed failed:", error);
      process.exit(1);
    })
    .finally(() => {
      process.exit(0);
    });
}
