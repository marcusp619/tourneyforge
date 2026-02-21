import { z } from "zod";

// Tenant schemas
export const tenantPlanSchema = z.enum(["free", "starter", "pro", "enterprise"]);

export const createTenantSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  plan: tenantPlanSchema.default("free"),
});

export const updateTenantSchema = createTenantSchema.partial();

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
