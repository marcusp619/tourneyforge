# TourneyForge — CLAUDE.md

## Project Overview
TourneyForge is a multi-tenant SaaS platform for fishing tournament management. Tournament directors sign up, pick a theme, and get a live professional site with registration, payments, and live leaderboards in minutes.

## Development Status

**Current Phase:** Complete through Phase 7

**Completed:**
- ✅ Phase 0: Foundation (monorepo, database, auth, CI/CD, seed data)
- ✅ Phase 1: Tenant Sites & Theming (subdomain routing, theme engine, logo upload)
- ✅ Phase 2: Tournament management, scoring formats, species, divisions
- ✅ Phase 3: Registration + Stripe Connect payments
- ✅ Phase 4: Live tournaments, catch submission (mobile), real-time leaderboards
- ✅ Phase 5: Mobile app polish, Clerk auth, EAS build config
- ✅ Phase 6: Custom domains, sponsors, analytics, email notifications
- ✅ Phase 7: Public API v1, AI catch verification (Claude Haiku), marketplace, SMS

**UI Stack:**
- Web dashboard and marketing site use **shadcn/ui** + Tailwind CSS v4
- Mobile app uses **Tamagui** via `packages/ui`

---

## Development Phases

## Monorepo Structure
```
tourneyforge/
├── apps/
│   ├── web/        # Next.js 15 — public tenant sites + admin dashboard
│   └── mobile/     # Expo SDK 52 — angler mobile app
├── packages/
│   ├── api/        # Hono on Bun — API server
│   ├── db/         # Drizzle ORM — schema, migrations, seed
│   ├── ui/         # Tamagui — shared components (web + native)
│   ├── scoring/    # Pure TS — tournament scoring engine
│   ├── themes/     # Tamagui theme tokens + layout configs
│   ├── validators/ # Zod schemas shared across all apps
│   ├── types/      # Shared TypeScript types
│   └── config/     # Shared ESLint + TS configs
├── turbo.json
├── pnpm-workspace.yaml
└── .github/workflows/
```

## Package Manager
**pnpm** — always use pnpm, never npm or yarn.

```bash
pnpm install                    # install all workspace deps
pnpm turbo run build            # build all packages
pnpm turbo run dev              # dev all apps concurrently
pnpm turbo run check            # typecheck all packages
pnpm turbo run lint             # lint all packages
pnpm turbo run test             # run all tests
```

## Common Commands

### Database
```bash
pnpm db:push          # push schema to DB (development)
pnpm db:migrate       # run migrations
pnpm db:generate      # generate migration files from schema changes
pnpm db:studio        # open Drizzle Studio
pnpm db:seed          # seed with test data
```

### Run Individual Apps
```bash
pnpm turbo run dev --filter=@tourneyforge/web      # web only
pnpm turbo run dev --filter=@tourneyforge/mobile   # mobile only
pnpm turbo run dev --filter=@tourneyforge/api      # API only
```

### API (Hono on Bun)
```bash
cd packages/api
bun run src/index.ts            # start API server
bun --watch src/index.ts        # start with hot reload
```

### Scoring Engine Tests
```bash
cd packages/scoring
bun test                        # run all scoring engine tests
bun test --watch                # watch mode
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo |
| Frontend (Web) | Next.js 15 (App Router) |
| Frontend (Mobile) | Expo SDK 52 + Expo Router |
| Shared UI | Tamagui |
| API | Hono on Bun |
| ORM | Drizzle ORM |
| Database | PostgreSQL via Neon (serverless) |
| Auth | Clerk (multi-tenant / organizations) |
| Payments | Stripe Connect |
| File Storage | Cloudflare R2 (S3-compatible) |
| Cache / Realtime | Upstash Redis |
| Email | Resend |
| Hosting (Web) | Vercel |
| Hosting (API) | Fly.io |
| Validation | Zod |

## Architecture Notes

### Multi-Tenancy
- Single PostgreSQL database with `tenant_id` on every tenant-scoped table
- Row-Level Security (RLS) enforced at DB level via Drizzle `pgPolicy()`
- Per-request: `SET LOCAL app.current_tenant_id = '<uuid>'` in Hono middleware
- Use `current_setting('app.current_tenant_id', true)` in RLS policies — the `true` arg is `missing_ok` and prevents crashes outside tenant context

### Tenant Resolution (apps/web/middleware.ts)
Order of resolution:
1. Custom domain → Redis lookup (`custom_domain:{host}` → tenantSlug)
2. Subdomain → `{slug}.tourneyforge.com`
3. Null → platform marketing site

Tenant slug injected as `x-tenant-slug` header for downstream RSC/route handlers.

### Scoring Engine (packages/scoring)
- Pure function: `calculateStandings(input: ScoringInput): ScoringResult`
- Zero side effects, zero DB calls — fully deterministic
- Used in: API leaderboard route, web dashboard, mobile results screen
- Test with `bun test` inside `packages/scoring`

### Stripe Connect
- Each tenant gets their own Stripe connected account
- Platform fees layered on top of Stripe base rate (1.5–3.5% depending on plan)
- Entry fees flow: angler → tenant connected account (platform fee withheld)

## Environment Variables
Copy `.env.example` to:
- `apps/web/.env.local` for Next.js
- `packages/api/.env` for Hono API
- `packages/db/.env` for Drizzle CLI commands

Required variables:
```
DATABASE_URL                          # Neon PostgreSQL connection string
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY     # Clerk public key
CLERK_SECRET_KEY                      # Clerk secret key
CLERK_WEBHOOK_SECRET                  # For Clerk webhook route
STRIPE_SECRET_KEY                     # Stripe secret key
STRIPE_WEBHOOK_SECRET                 # For Stripe webhook route
UPSTASH_REDIS_REST_URL                # Upstash Redis URL
UPSTASH_REDIS_REST_TOKEN              # Upstash Redis token
R2_ACCOUNT_ID                         # Cloudflare R2 account ID
R2_ACCESS_KEY_ID                      # R2 access key
R2_SECRET_ACCESS_KEY                  # R2 secret key
R2_BUCKET_NAME                        # R2 bucket name
RESEND_API_KEY                        # Resend email API key
NEXT_PUBLIC_ROOT_DOMAIN               # e.g., tourneyforge.com
NEXT_PUBLIC_API_URL                   # e.g., https://api.tourneyforge.com
```

## Critical Constraints / Gotchas

1. **`.npmrc` must exist before `pnpm install`** — `node-linker=hoisted` is required for Expo SDK 52. If you install first and add it after, delete `node_modules` and reinstall.

2. **`next.config.js` must be CommonJS** — Keep as `.js` with `module.exports`. `@tamagui/next-plugin` requires CJS. Never rename to `.mjs` or `.ts`.

3. **Tamagui versions must be identical** — All `@tamagui/*` and `tamagui` packages must pin the same exact version across every workspace. Never use `^` ranges for Tamagui packages.

4. **`transpilePackages` required** — Every `@tourneyforge/*` workspace package (that ships TS source) plus `tamagui`, `@tamagui/core`, `react-native-web` must be listed in `next.config.js` `transpilePackages`.

5. **Next.js minimum 15.2.3** — Earlier versions have CVE-2025-29927 (CVSS 9.1) middleware bypass. Never downgrade.

6. **Hono needs `moduleResolution: bundler`** — The `node` strategy breaks Hono subpath imports (`hono/cors`, `hono/logger`, etc.).

7. **Turbo 2.x uses `tasks` key** — Not `pipeline`. Schema validation fails with the old key.

8. **API Dockerfile builds from monorepo root** — Run `docker build -f packages/api/Dockerfile .` from the repo root, not from inside the package.

9. **React / React Native versions are pinned** — Match Expo SDK 52's exact peer requirements. Do not float these with `^`.

## Code Style

- TypeScript strict mode everywhere (`strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`)
- Prefer `type` imports: `import type { Foo } from './foo'`
- No `any` — use `unknown` and narrow
- Zod for all external input validation (API bodies, env vars, form data)
- All DB queries go through Drizzle — no raw SQL except for session variable setting and RLS admin queries
- Scoring engine must remain pure — no DB calls, no side effects

## Database Schema Overview

Tenant-scoped tables (have `tenant_id` + RLS):
- `tenants`, `tenant_members`, `scoring_formats`, `tournaments`, `tournament_divisions`, `tournament_species`, `teams`, `registrations`, `catches`, `leaderboard_cache`, `seasons`, `season_standings`

System tables (no RLS, readable by all authenticated users):
- `users`, `species`, `themes`

## Subscription Tiers
`free` | `starter` ($19/mo) | `pro` ($49/mo) | `enterprise` ($149/mo)

Plan is stored on `tenants.plan` enum. Feature gating is enforced in the API middleware and UI — check `tenant.plan` before enabling Pro/Enterprise features.

## Development Phases
- **Phase 0** ✅ COMPLETE: Monorepo scaffold, DB schema, auth (Clerk), API stubs, CI/CD, seed data
- **Phase 1** ✅ COMPLETE: Theming engine, tenant sites, subdomain routing, logo upload
- **Phase 2** ✅ COMPLETE: Tournament management, scoring formats, species, divisions
- **Phase 3** ✅ COMPLETE: Registration + Stripe Connect payments
- **Phase 4** ✅ COMPLETE: Live tournament, catch submission (mobile), real-time leaderboards
- **Phase 5** ✅ COMPLETE: Mobile app polish, Clerk auth, EAS build config
- **Phase 6** ✅ COMPLETE: Custom domains, sponsors, analytics, SMS notifications
- **Phase 7** ✅ COMPLETE: Public API v1, marketplace, AI catch verification (Claude Haiku)

---

## Recent Changes (Phase 0 Completion)

### Auth Integration (Clerk)
- Multi-tenant auth with organization support
- Middleware with tenant resolution via subdomain
- Sign-in / Sign-up flows
- Protected dashboard routes

### CI/CD
- GitHub Actions workflow for type checking, linting, and testing
- Runs on all PRs and pushes to main/develop branches

### Seed Data
- `packages/db/src/seed.ts` creates realistic test data:
  - 3 tenants (Midwest Bass Trail, Carolina Kayak Fishing, Lake Norman Bass Club)
  - Sample users (director, angler, admin)
  - Tournament templates
  - Scoring formats

### Environment Setup
Created `.env.example` files in:
- `apps/web/.env.local.example`
- `packages/api/.env.example`
- `packages/db/.env.example`

---
