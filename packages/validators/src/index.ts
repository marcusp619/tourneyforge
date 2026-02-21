import { z } from "zod";

// Tenant schemas
export const tenantPlanSchema = z.enum(["free", "starter", "pro", "enterprise"]);

// Hex color validation helper
const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g. #1d4ed8)")
  .optional()
  .nullable();

export const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  plan: tenantPlanSchema.default("free"),
});

export const updateTenantSchema = createTenantSchema.partial();

export const updateTenantThemeSchema = z.object({
  themePreset: z.enum(["classic", "coastal", "forest", "bold", "sport", "midnight"]).optional(),
  primaryColor: hexColorSchema,
  accentColor: hexColorSchema,
  fontFamily: z.string().max(100).optional().nullable(),
  tagline: z.string().max(200).optional().nullable(),
});

export const logoUploadRequestSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]),
  sizeBytes: z.number().int().positive().max(5 * 1024 * 1024), // 5 MB max
});

// Tournament schemas
export const tournamentStatusSchema = z.enum(["draft", "open", "active", "completed"]);

export const createTournamentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).nullish(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  registrationDeadline: z.coerce.date().nullish(),
  status: tournamentStatusSchema.default("draft"),
  scoringFormatId: z.string().uuid(),
  entryFee: z.number().int().nonnegative().default(0), // cents
  maxTeams: z.number().int().positive().nullish(),
});

export const updateTournamentSchema = createTournamentSchema.partial();

// Scoring format schemas
export const scoringFormatTypeSchema = z.enum(["weight", "length", "count", "custom"]);

export const createScoringFormatSchema = z.object({
  name: z.string().min(1).max(100),
  type: scoringFormatTypeSchema,
  rules: z.record(z.unknown()).default({}),
});

// Team schemas
export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  captainId: z.string().uuid(),
  divisionId: z.string().uuid().optional(),
});

// Registration schemas
export const createRegistrationSchema = z.object({
  teamId: z.string().uuid(),
  tournamentId: z.string().uuid(),
  divisionId: z.string().uuid().optional(),
});

// Registration form schema (used by the public-facing register page)
export const registerFormSchema = z.object({
  teamName: z.string().min(1, "Team name is required").max(100),
  anglerName: z.string().min(1, "Your name is required").max(100),
  boatName: z.string().max(100).optional(),
  divisionId: z.string().uuid().optional(),
});

// Stripe Connect schemas
export const stripeConnectCallbackSchema = z.object({
  code: z.string(),
});

// Platform fee rates by plan (in basis points, e.g. 150 = 1.5%)
export const PLATFORM_FEE_BPS: Record<string, number> = {
  free: 350,     // 3.5%
  starter: 250,  // 2.5%
  pro: 175,      // 1.75%
  enterprise: 150, // 1.5%
};

// Catch submission schemas
export const createCatchSchema = z.object({
  teamId: z.string().uuid(),
  speciesId: z.string().uuid(),
  weight: z.number().nonnegative().max(10000), // max ~600 lbs in ounces
  length: z.number().nonnegative().max(200), // max ~16 feet in inches
  photoUrl: z.string().url().optional(),
  timestamp: z.coerce.date().default(() => new Date()),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
});

// API response schemas
export const apiResponseSchema = <T extends z.ZodType>(data: T) => z.object({
  data,
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});

// Environment variable schemas
export const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Clerk Auth
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string(),
  CLERK_SECRET_KEY: z.string(),
  CLERK_WEBHOOK_SECRET: z.string(),

  // Stripe
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string(),

  // Cloudflare R2
  R2_ACCOUNT_ID: z.string(),
  R2_ACCESS_KEY_ID: z.string(),
  R2_SECRET_ACCESS_KEY: z.string(),
  R2_BUCKET_NAME: z.string(),

  // Resend Email
  RESEND_API_KEY: z.string(),

  // Platform
  NEXT_PUBLIC_ROOT_DOMAIN: z.string(),
  NEXT_PUBLIC_API_URL: z.string().url(),
});

export type EnvInput = z.infer<typeof envSchema>;
