# TourneyForge

Multi-tenant SaaS platform for fishing tournament management.

## Phase 0 Setup

This monorepo is in initial setup phase. Run:

```bash
# Install dependencies (requires pnpm)
pnpm install

# Run typecheck on all packages
pnpm turbo run check

# Run tests (scoring engine only currently)
pnpm turbo run test
```

## Environment Setup

Copy `.env.example` to appropriate locations:
- `apps/web/.env.local` for Next.js
- `packages/api/.env` for Hono API
- `packages/db/.env` for Drizzle CLI

## Project Structure

```
tourneyforge/
├── apps/
│   ├── web/      # Next.js 15
│   └── mobile/   # Expo SDK 52
└── packages/
    ├── api/      # Hono on Bun
    ├── db/       # Drizzle ORM
    ├── scoring/  # Pure TS scoring engine
    ├── themes/   # Tamagui theme tokens
    ├── ui/       # Tamagui components
    ├── types/    # Shared TS types
    ├── validators/ # Zod schemas
    └── config/   # ESLint + TS configs
```

## Development

Run individual apps:
```bash
pnpm turbo run dev --filter=@tourneyforge/web
pnpm turbo run dev --filter=@tourneyforge/mobile
pnpm turbo run dev --filter=@tourneyforge/api
```

See [CLAUDE.md](./CLAUDE.md) for full documentation.
