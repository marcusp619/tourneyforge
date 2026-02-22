# TourneyForge

Multi-tenant SaaS platform for fishing tournament management. Tournament directors sign up, pick a theme, and get a live professional site with registration, payments, and live leaderboards in minutes.

## Current Status

All 7 development phases are complete (see [CLAUDE.md](./CLAUDE.md) for the full roadmap).

| Phase | Feature Set | Status |
|-------|-------------|--------|
| 0 | Monorepo scaffold, DB schema, auth, CI/CD, seed data | ✅ Complete |
| 1 | Theming engine, tenant sites, subdomain routing, logo upload | ✅ Complete |
| 2 | Tournament management, scoring formats, divisions, species | ✅ Complete |
| 3 | Registration + Stripe Connect payments | ✅ Complete |
| 4 | Live tournament, catch submission, real-time leaderboards | ✅ Complete |
| 5 | Mobile app polish, Expo auth, EAS build config | ✅ Complete |
| 6 | Custom domains, sponsors, analytics, email + SMS notifications | ✅ Complete |
| 7 | Public API v1, marketplace, AI catch verification | ✅ Complete |

---

## Project Structure

```
tourneyforge/
├── apps/
│   ├── web/        # Next.js 15 — tenant public sites + director dashboard
│   └── mobile/     # Expo SDK 52 — angler mobile app (iOS + Android)
└── packages/
    ├── api/        # Hono on Bun — REST API server
    ├── db/         # Drizzle ORM — schema, migrations, seed
    ├── scoring/    # Pure TS scoring engine (zero side effects)
    ├── themes/     # Tamagui theme tokens + layout configs
    ├── ui/         # Tamagui — shared components (web + native)
    ├── validators/ # Zod schemas shared across all apps
    ├── types/      # Shared TypeScript types
    └── config/     # Shared ESLint + TS configs
```

---

## Quick Start

### Prerequisites
- [pnpm](https://pnpm.io) (required — do NOT use npm or yarn)
- [Bun](https://bun.sh) (for the API server)
- [Node.js](https://nodejs.org) ≥ 20
- PostgreSQL via [Neon](https://neon.tech) (serverless)

### Install

```bash
pnpm install
```

### Environment Variables

Copy `.env.example` files to their respective locations:

```bash
cp apps/web/.env.local.example apps/web/.env.local
cp packages/api/.env.example packages/api/.env
cp packages/db/.env.example packages/db/.env
```

Fill in all values. Required variables:

| Variable | Where | Description |
|----------|-------|-------------|
| `DATABASE_URL` | api, db | Neon PostgreSQL connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | web | Clerk public key |
| `CLERK_SECRET_KEY` | web, api | Clerk secret key |
| `CLERK_WEBHOOK_SECRET` | api | Clerk webhook signing secret |
| `STRIPE_SECRET_KEY` | api | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | api | Stripe webhook signing secret |
| `UPSTASH_REDIS_REST_URL` | api | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | api | Upstash Redis token |
| `R2_ACCOUNT_ID` | api | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | api | R2 access key |
| `R2_SECRET_ACCESS_KEY` | api | R2 secret key |
| `R2_BUCKET_NAME` | api | R2 bucket name |
| `RESEND_API_KEY` | api | Resend email API key |
| `ANTHROPIC_API_KEY` | api | Claude AI for catch verification |
| `TWILIO_ACCOUNT_SID` | api | Twilio account SID (SMS) |
| `TWILIO_AUTH_TOKEN` | api | Twilio auth token (SMS) |
| `TWILIO_FROM_NUMBER` | api | Twilio sender number, e.g. `+15551234567` |
| `NEXT_PUBLIC_ROOT_DOMAIN` | web | e.g. `tourneyforge.com` |
| `NEXT_PUBLIC_API_URL` | web | e.g. `https://api.tourneyforge.com` |

### Database Setup

```bash
pnpm db:push      # push schema to DB (development)
pnpm db:seed      # seed with test data (3 tenants, sample tournaments)
```

### Run All Apps

```bash
pnpm turbo run dev
```

### Run Individual Apps

```bash
pnpm turbo run dev --filter=@tourneyforge/web      # Next.js on :3000
pnpm turbo run dev --filter=@tourneyforge/api      # Hono API on :3001
pnpm turbo run dev --filter=@tourneyforge/mobile   # Expo dev server
```

---

## Key Features

### Multi-Tenant Architecture
- Single PostgreSQL database with `tenant_id` on all tenant-scoped tables
- Row-Level Security (RLS) enforced at DB level via Drizzle `pgPolicy()`
- Tenant resolved per-request: custom domain → subdomain → marketing site

### Tenant Sites (Phase 1)
- Full theme engine with color tokens, fonts, and layout presets
- Subdomain routing: `{slug}.tourneyforge.com`
- Custom domain support (Pro/Enterprise) with Redis-backed lookup
- Logo upload via Cloudflare R2

### Tournament Management (Phase 2)
- Tournament CRUD with status flow: `draft → open → active → completed`
- Custom scoring formats (weight, count, length, big fish bonus)
- Divisions and species management per tournament

### Registration + Payments (Phase 3)
- Stripe Connect per tenant — entry fees flow directly to tournament directors
- Platform fee: 1.5–3.5% depending on subscription plan
- Registration dashboard with payment status tracking

### Live Tournaments (Phase 4)
- Real-time leaderboards powered by the pure scoring engine
- Catch submission with GPS coordinates, weight, length, and photo
- Upstash Redis for leaderboard caching

### Mobile App (Phase 5)
- Expo SDK 52 + Expo Router
- Clerk auth (sign-in/sign-up)
- Tournament browser, live leaderboard, catch submission with GPS
- EAS Build config for iOS + Android

### Sponsors + Analytics (Phase 6)
- Sponsor management with tier system: Title, Gold, Silver, Bronze
- Analytics dashboard (Pro/Enterprise): registrations, revenue, catches
- Email notifications via Resend (registration confirmation, tournament alerts)
- SMS notifications via Twilio (tournament start/end alerts to registered teams)
- Custom domain management UI

### Public API + AI Verification + Marketplace (Phase 7)
- **Public API v1** (Enterprise): `x-api-key` auth, tournaments + leaderboard + registrations
- **AI Catch Verification**: Claude claude-haiku-4-5 vision analyzes fish photos — species detection, size estimates, auto-approval on high confidence
- **Marketplace**: Public tournament discovery page for anglers + sponsor marketplace for directors

---

## API Overview

### Internal API (Hono, Clerk-authenticated)
| Route | Description |
|-------|-------------|
| `GET /api/public/tenants/:slug` | Public tenant profile |
| `GET /api/public/tournaments` | All open/active tournaments |
| `GET /api/public/tournaments/:id` | Tournament details |
| `POST /api/catches` | Submit a catch |
| `PATCH /api/catches/:id/verify` | Manually verify a catch (director) |
| `POST /api/ai/verify-catch` | AI verify a catch photo |
| `POST /api/stripe/connect` | Stripe Connect onboarding |
| `POST /api/notifications/tournament-status` | Send SMS/email on status change |
| `GET /api/marketplace/tournaments` | Browse all public tournaments |
| `GET /api/marketplace/sponsors` | Browse sponsor marketplace |

### Public API v1 (Enterprise, `x-api-key` auth)
| Route | Description |
|-------|-------------|
| `GET /api/v1/tournaments` | List your tournaments |
| `GET /api/v1/tournaments/:id` | Tournament details + registration count |
| `GET /api/v1/tournaments/:id/leaderboard` | Live leaderboard |
| `GET /api/v1/tournaments/:id/registrations` | Registered teams |

---

## Subscription Plans

| Plan | Price | Features |
|------|-------|---------|
| Free | $0 | 1 tournament, basic scoring, TourneyForge branding |
| Starter | $19/mo | 5 tournaments, custom colors |
| Pro | $49/mo | Unlimited tournaments, analytics, custom domain, sponsor tools |
| Enterprise | $149/mo | Everything + Public API v1, white label, priority support |

---

## Development Commands

```bash
pnpm turbo run build    # build all packages
pnpm turbo run check    # typecheck all packages
pnpm turbo run lint     # lint all packages
pnpm turbo run test     # run all tests

pnpm db:push            # push schema to DB
pnpm db:migrate         # run migrations
pnpm db:generate        # generate migration files
pnpm db:studio          # open Drizzle Studio
pnpm db:seed            # seed test data
```

### Scoring Engine Tests

```bash
cd packages/scoring
bun test
```

---

## Architecture Notes

- **Scoring engine** is a pure function (`calculateStandings`) with zero DB calls — fully testable and deterministic
- **Hono API** needs `moduleResolution: bundler` in tsconfig for subpath imports to work
- **All `@tamagui/*` versions must be identical** — never use `^` ranges for Tamagui packages
- **Next.js config must be CommonJS** — keep as `next.config.js` with `module.exports`
- **Next.js ≥ 15.2.3** required — earlier versions have CVE-2025-29927 (CVSS 9.1)

See [CLAUDE.md](./CLAUDE.md) for full architecture documentation.
