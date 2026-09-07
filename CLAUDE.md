# TourneyForge — CLAUDE.md

## Project Overview
TourneyForge is a multi-tenant SaaS platform for fishing tournament management. Tournament directors sign up, pick a theme, and get a live professional site with registration, payments, and live leaderboards in minutes.

## Development Status

**Current Phase:** Phases 0-6. Phase 7 was deleted on 2026-09-06 (tasks 8 and 9)
after the harness could prove nothing else broke. See the caveat below.

> **What "complete" means here.** Until 2026-09-01 these phases were marked complete
> while CI had been red for eight consecutive runs (main included) and 20 of the 28 API
> tests were failing. "Complete" in the list below means *the code was written*, not
> that anyone has run it end to end. CI on `main` first went green on 2026-09-02
> (run `33626804701`). Known gaps that survive: anglers must paste a raw tournament
> UUID into the mobile app, no web UI creates a catch, and there are no database
> migrations. (Three clubs now have seeded tournaments — fixed 2026-09-06, task 4.)
> Tracked in `docs/NIGHTLY.md`.

**Completed:**
- ✅ Phase 0: Foundation (monorepo, database, auth, CI/CD, seed data)
- ✅ Phase 1: Tenant Sites & Theming (subdomain routing, theme engine, logo upload)
- ✅ Phase 2: Tournament management, scoring formats, species, divisions
- ✅ Phase 3: Registration + Stripe Connect payments
- ✅ Phase 4: Live tournaments, catch submission (mobile), real-time leaderboards
- ✅ Phase 5: Mobile app polish, Clerk auth, EAS build config
- ✅ Phase 6: Custom domains, sponsors, analytics, email notifications

**UI Stack:**
- Web dashboard and marketing site use **shadcn/ui** + Tailwind CSS v4
- Mobile app uses **Tamagui** via `packages/ui`

---

## Development Phases

## Monorepo Structure
```
tourneyforge/
├── apps/
│   ├── web/        # Next.js 16 — public tenant sites + admin dashboard
│   └── mobile/     # Expo SDK 55 — angler mobile app
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
| Frontend (Web) | Next.js 16 (App Router) |
| Frontend (Mobile) | Expo SDK 55 + Expo Router |
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

> ⚠️ **Tenant isolation is application-level only. Do not rely on the database to
> enforce it.** The API now has a real boundary (task 11, 2026-09-07): a route learns its
> tenant from the caller's `tenant_members` rows and never from the request. But the
> database still enforces nothing — until task 12 in `docs/NIGHTLY.md` lands, **every
> query you write must scope by `tenantId` yourself**; nothing underneath will catch you.

- Single PostgreSQL database with `tenant_id` on every tenant-scoped table. ✅ True.
- Row-Level Security via Drizzle `pgPolicy()`. **Defined, but never enforced.** The
  policies exist and `relrowsecurity` is on, but the app connects as `tf`, `tf` owns every
  table, and `relforcerowsecurity` is off — *a table owner bypasses RLS*. Setting a
  nonexistent tenant id and selecting from `tournaments` still returns every row.
- Per-request `SET LOCAL app.current_tenant_id`. **Does not exist.** That string appears in
  this file and nowhere else in the repo; `packages/api/src` has zero occurrences of
  `current_tenant_id`, `SET LOCAL` or `set_config`. There is no such middleware.
- Note for whoever implements it: `packages/db/src/index.ts` exports one module-level
  `drizzle()` over a postgres.js pool and this repo calls `db.transaction` nowhere, so
  `SET LOCAL` would be a no-op — and a plain `SET` would persist on the pooled connection
  and leak the tenant into the next request. See task 12 for the required shape.
- `x-tenant-id` used to be a **client-supplied header that nothing authenticated** — the
  API had no Clerk import and never checked it against `tenant_members`, so
  `curl -H 'x-tenant-id: <any club uuid>'` read and wrote that club's data. **Fixed
  2026-09-07 (task 11).** `packages/api/src/middleware/tenant.ts` now resolves the caller
  (a verified Clerk bearer token, or a fixed identity under `LOCAL_DEV`) and then the
  tenant from that caller's `tenant_members` rows. The header survives only as a
  *preference* for callers who belong to several clubs, and is checked against membership
  before it is honoured; an id the caller cannot prove membership of is a 403.
  **No route may read it.** `catches` submission is the one exception to `requireTenant`:
  an angler is not a club member, so that route derives the tenant from the tournament
  and authorises the caller against `teams.captainId` instead.

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

Offline-stack only (`packages/api/.env`, `apps/web/.env.local`):
```
LOCAL_DEV=true                        # assume a fixed identity instead of Clerk
LOCAL_DEV_USER_ID=user-1              # which seeded user that is
```
`LOCAL_DEV` assumes an *identity*, never a tenant — the club is still resolved from that
user's `tenant_members` row in both the API and the web dashboard. The API throws if it
sees `LOCAL_DEV=true` with `NODE_ENV=production`. The API needs `CLERK_SECRET_KEY` when
`LOCAL_DEV` is unset: without either it verifies no tokens and authenticates nobody.

## Critical Constraints / Gotchas

1. **`.npmrc` must exist before `pnpm install`** — `node-linker=hoisted` is required for Expo SDK 55. If you install first and add it after, delete `node_modules` and reinstall.

2. **`next.config.js` must be CommonJS** — Keep as `.js` with `module.exports`. `@tamagui/next-plugin` requires CJS. Never rename to `.mjs` or `.ts`.

3. **Tamagui versions must be identical** — All `@tamagui/*` and `tamagui` packages must pin the same exact version across every workspace. Never use `^` ranges for Tamagui packages.

4. **`transpilePackages` required** — Every `@tourneyforge/*` workspace package (that ships TS source) plus `tamagui`, `@tamagui/core`, `react-native-web` must be listed in `next.config.js` `transpilePackages`.

5. **Next.js on 16.1.6** — Do not downgrade below 15.2.3 (CVE-2025-29927 CVSS 9.1 middleware bypass). Currently on 16.x.

6. **Hono needs `moduleResolution: bundler`** — The `node` strategy breaks Hono subpath imports (`hono/cors`, `hono/logger`, etc.).

7. **Turbo 2.x uses `tasks` key** — Not `pipeline`. Schema validation fails with the old key.

8. **The API has no Dockerfile yet** — Nothing in `packages/api` is container-built today, and there is no Fly or Vercel config in the repo. When one is added it must build from the monorepo root, since the package depends on workspace siblings.

9. **React / React Native versions are pinned** — Match Expo SDK 55's exact peer requirements (React 19.2.4, RN 0.83.2). Do not float these with `^` in the mobile app.

10. **Expo SDK 55 requires New Architecture** — `newArchEnabled: true` is mandatory in `app.json`. The Legacy Architecture flag is removed.

## Code Style

- TypeScript strict mode everywhere (`strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`)
- Prefer `type` imports: `import type { Foo } from './foo'`
- No `any` — use `unknown` and narrow
- Zod for all external input validation (API bodies, env vars, form data)
- All DB queries go through Drizzle — no raw SQL except for session variable setting and RLS admin queries
- Scoring engine must remain pure — no DB calls, no side effects

## Database Schema Overview

Tenant-scoped tables — the nine that actually carry a `tenant_id` column, verified against
the database 2026-09-02 (RLS defined but **not enforced** — see Multi-Tenancy):
- `tenant_members`, `scoring_formats`, `tournaments`, `tournament_divisions`,
  `tournament_species`, `teams`, `registrations`, `catches`, `sponsors`

`tenants` is the root of the tree, not a tenant-scoped table — it is keyed by `id` and has
no `tenant_id`. It was previously listed among the scoped tables.

`leaderboard_cache`, `seasons` and `season_standings` were listed here but **have never
existed** — not in `packages/db/src/schema/` and not in the database.

System tables (no `tenant_id`):
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
- **Phase 6** ✅ COMPLETE: Custom domains, sponsors, analytics, email notifications
  (SMS was part of Phase 7 and is gone)
- **Phase 7** ❌ DELETED 2026-09-06: public API v1, marketplace, AI catch verification
  and SMS. Four surfaces no test ever touched and no user ever called; removed so the
  thing the harness has to hold up is smaller. Recoverable from git history.

---

## Recent Changes

### Security: the tenant boundary (2026-09-07, task 11)
Scoping to a client-supplied `x-tenant-id` header was an improvement over accepting any
`tournamentId`, but it was never a boundary — the header was unauthenticated. Every
scoped route now takes its tenant from `packages/api/src/middleware/tenant.ts`.

- `requireUser` — establishes *who* is calling. 401 if anonymous. Fails closed: with
  neither `LOCAL_DEV` nor a `CLERK_SECRET_KEY` the API authenticates nobody.
- `requireTenant` — establishes *which club* they act as, from `tenant_members`.
  403 for a tenant they are not a member of; 400 (never a silent pick) when a
  multi-club caller names none.
- `LOCAL_DEV=true` assumes a fixed *identity* (`LOCAL_DEV_USER_ID`, default `user-1`),
  never a tenant — so the offline stack exercises the same boundary. Refused under
  `NODE_ENV=production`.

Also closed while the boundary was going in, all the same class of hole:
- `PATCH /api/sponsors/:id` was scoped by id alone — any caller could rewrite any club's
  sponsor. `POST /api/sponsors` took `tenantId` from the request body.
- `PATCH /api/tenants/:id` and the three `/:id/theme`, `/:id/logo*` routes took the club
  from the path and trusted it.
- `GET /api/tenants` returned every club on the platform including `apiKey` and
  `stripeConnectedAccountId`. It now returns the caller's clubs, projected.
- `PATCH /api/tenants/:id` accepted `plan`, so a club could upgrade itself for free.

Side effect: `POST /api/catches` from the mobile app used to fail with
`400 Missing x-tenant-id header` — the app sends a bearer token and no such header, and
nothing in the repo ever set it. Catch submission works now.

Still open: `apps/mobile` calls `POST /api/uploads/catch-photo`, a route that does not
exist. Photo upload fails silently and submission continues without the URL.

### API Test Suite
Added Bun test suite covering catches, registrations, public routes and the tenant
middleware (51 tests).
No Docker or local Postgres needed — `@tourneyforge/db` is mocked via `mock.module`.

- `packages/api/test/catches.test.ts` — 18 tests
- `packages/api/test/registrations.test.ts` — 12 tests
- `packages/api/test/public.test.ts` — 11 tests
- `packages/api/test/middleware.test.ts` — 10 tests, the boundary itself
- Every file's `mock.module("@tourneyforge/db")` must list *every* export any route
  under test imports: bun shares one module registry across files and does not order
  them deterministically, so an omission makes the suite pass or fail by file order.
- `packages/api/test/setup.ts` — preload sets dummy DATABASE_URL for Bun validation
- `packages/api/bunfig.toml` — wires preload into `bun test`
- `packages/api/package.json` — added `"test"` script

Run with: `cd packages/api && bun test`

### Which club the dev dashboard administers (fixed 2026-09-07)
`getCurrentTenant()` resolved the `LOCAL_DEV` director's club with
`select().from(tenants).limit(1)` — an unordered `LIMIT 1`, so *which club you were
administering* was decided by Postgres heap order. It looked stable until something
updated a `tenants` row, which moves it in the heap; the dashboard then silently began
administering a different club and the end-to-end money path went red. It now resolves
from `tenant_members` for `LOCAL_DEV_USER_ID`, matching the API.

### Angler Discovery (decided 2026-09-02)
Discovery in the mobile app is **cross-club**: `GET /api/public/tournaments` returns
open/active tournaments from every tenant, with no club-selection step. Because of that,
every tournament shown to an angler must carry its club — the route `innerJoin`s
`tenants` and returns `tenantSlug` / `tenantName` / `tenantLogoUrl`, and both the list
and detail screens render the club name. Rationale and the rejected alternative are in
`docs/NIGHTLY.md` under **Decisions**.

Public routes filter `isNull(tournaments.deletedAt)`. Note the asymmetry: `teams` has no
`deletedAt` column, so `GET /api/public/teams` correctly has no such filter.

### Known Gaps (from quality audit — prioritized backlog)
**High** (done ✅):
- ~~Tenant scope gap in catches/registrations routes~~
- ~~Zero API test coverage~~

**Medium** (done ✅):
- ~~Missing `error.tsx` / `not-found.tsx` in web app~~ — added global + dashboard error/not-found pages
- ~~Mobile catch submission has no real Expo `ImagePicker` (uses text input for `photoUrl`)~~ — replaced with `expo-image-picker` (camera + library)
- ~~Stripe webhook has no duplicate-event protection; email failures silently swallowed~~ — Redis idempotency key (24h TTL, nx), structured email error return
- ~~CI only runs 4 scoring tests — no API/web/mobile coverage~~ — split into `test-scoring` + `test-api` jobs

**Low**:
- ~~Scoring engine edge cases not tested (ties, dead fish penalties, zero catches)~~ — done in `fdf2136`; `packages/scoring/test/index.test.ts` covers all three (10 tests)
- ~~Public tenant site missing results archive, about/rules pages~~ — done: `/results`, `/about`, `/rules` pages added; `aboutText`/`rulesText` columns on `tenants`; dashboard settings editor
- ~~No soft deletes / audit trail anywhere~~ — done: `deletedAt` added to catches, tournaments, scoringFormats, sponsors, tournamentDivisions; all hard deletes converted to soft deletes; all SELECT queries updated with `isNull(deletedAt)` filter

---
