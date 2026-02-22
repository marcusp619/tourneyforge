// Database types (will be synced with Drizzle schema)
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "starter" | "pro" | "enterprise";
  logoUrl: string | null;
  customDomain: string | null;
  themePreset: string;
  primaryColor: string | null;
  accentColor: string | null;
  fontFamily: string | null;
  heroImageUrl: string | null;
  tagline: string | null;
  // Stripe Connect
  stripeConnectedAccountId: string | null;
  stripeAccountStatus: string;
  // Public API access (Enterprise plan)
  apiKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  clerkUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tournament {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  registrationDeadline: Date | null;
  status: "draft" | "open" | "active" | "completed";
  scoringFormatId: string | null;
  entryFee: number; // cents
  maxTeams: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScoringFormat {
  id: string;
  tenantId: string;
  name: string;
  type: "weight" | "length" | "count" | "custom";
  rules: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Theme {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  fontFamily: string;
  heroStyle: string;
  createdAt: Date;
}

// API types
export interface ApiResponse<T = unknown> {
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface LeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  score: number;
  details: Record<string, number>;
}

// Subscription tiers
export type SubscriptionTier = "free" | "starter" | "pro" | "enterprise";

export interface SubscriptionLimits {
  maxTournaments: number;
  maxTeamsPerTournament: number;
  customDomain: boolean;
  analytics: boolean;
  apiAccess: boolean;
}

export const SUBSCRIPTION_LIMITS: Record<SubscriptionTier, SubscriptionLimits> = {
  free: {
    maxTournaments: 2,
    maxTeamsPerTournament: 20,
    customDomain: false,
    analytics: false,
    apiAccess: false,
  },
  starter: {
    maxTournaments: 10,
    maxTeamsPerTournament: 100,
    customDomain: false,
    analytics: false,
    apiAccess: false,
  },
  pro: {
    maxTournaments: 50,
    maxTeamsPerTournament: 500,
    customDomain: true,
    analytics: true,
    apiAccess: false,
  },
  enterprise: {
    maxTournaments: Infinity,
    maxTeamsPerTournament: Infinity,
    customDomain: true,
    analytics: true,
    apiAccess: true,
  },
};
