// Database types (will be synced with Drizzle schema)
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "starter" | "pro" | "enterprise";
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
