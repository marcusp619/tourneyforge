# The Proving Harness

## Problem Statement

**How might we make an overnight AI agent unable to tell us a feature works when it doesn't?**

## Recommended Direction

TourneyForge has seven "complete" phases and an angler flow that asks fishermen to paste
UUIDs into a text box. That is not a coding failure — it is a *loop* failure. With unlimited
agent-nights and a definition of done that means "it typechecks," the inevitable output is a
large, plausible, non-functioning product. More agent hours make this worse, not better.

The fix is to change what "done" means. Build a harness that lets the machine establish facts
instead of making claims (#1), and a backlog format that tells the agent which fact to
establish next and how it will be checked (#6). These are one mechanism, not two: the
substrate is useless without a queue, and the queue is a lie without the substrate.

Crucially, the infrastructure for this already exists and is unused. `docker-compose.yml`
provides a fully offline stack — Postgres, Redis, MinIO (for R2), Mailpit (for Resend) — and
`LOCAL_DEV=true` bypasses Clerk across 9 files. The entire product can run with zero cloud
accounts and zero dollars. Nothing in `.env.example` mentions this, which is why it has sat
unused. Step one is not building an environment; it is documenting the one we have.

## Key Assumptions to Validate

- [x] **~~The app boots today.~~ FALSIFIED, 2026-09-01.** The toolchain itself is missing:
      `pnpm` and `bun` are both absent from this machine, and `bun` is required to run the API
      server and every existing test in `packages/scoring` and `packages/api`. The repo pins
      no toolchain (`mise.toml` / `.tool-versions` / `.nvmrc` all absent) while CI pins Node 20
      and the local `node` is 26.8.1. **An overnight agent here cannot run a single existing
      test.** Task zero is therefore toolchain reproducibility, not the harness.
- [x] **~~The app boots once the toolchain exists.~~ PARTIALLY CONFIRMED, 2026-09-01.**
      `pnpm install` succeeds on the pinned toolchain, and typecheck / lint / tests are now
      green across all 9 packages (see Findings). The runtime path — docker stack up, schema
      pushed, seeded, requests served — is still unverified and is the next task.
- [ ] **The docker stack actually runs the product.** Test: `docker compose up -d &&
      pnpm db:push && pnpm db:seed`, then curl the API health route and load the dashboard.
- [ ] **E2E green implies the product works.** Half false. The UUID-pasting bug would pass any
      API-level test, because the test would paste the UUID too. Test: the harness must drive
      the user-visible path — find the tournament by clicking a link, not by knowing its id.
      If the test cannot reach it by clicking, a human cannot either.
- [ ] **Agents will verify honestly.** An agent that can edit a test can delete a test.
      Test: make CI the referee, and make removed/skipped tests a visible diff event.
- [ ] **The morning review scales.** Test: cap nightly batches at one backlog item. If a diff
      is too big to read, the batch was too big — shrink the batch, don't improve the summary.

## MVP Scope

The smallest thing that proves a machine can establish a product fact.

**In:**
- A pinned toolchain (`mise.toml` covering node, pnpm and bun, matched to CI) so that any
  agent on any night has the commands the repo's own scripts assume. Nothing else can be
  trusted until this is true.
- `.env.local.example` files documenting the offline stack (`LOCAL_DEV=true`, local Postgres /
  Redis / MinIO / Mailpit values), plus a README section on booting with zero cloud accounts.
- One command that goes from clean checkout to running app with seeded data.
- **One** end-to-end test, web only, via Playwright, driving the full money path through the
  UI: director creates a tournament -> angler registers -> catch submitted -> leaderboard
  ranks correctly. Clicks only. No ids typed into inputs.
- A backlog file where each item carries machine-checkable acceptance criteria the agent runs
  before reporting done.
- CI runs all of the above against the docker stack.

**Out:** mobile E2E, migrations, deleting Phase 7, QR codes, deployment, any new feature.

## Not Doing (and Why)

- **Mobile E2E** — Detox/Maestro on Expo is a multi-night tar pit, and the scoring and API
  logic under test is shared with web. Revisit only once the web harness is green.
- **Deploying anywhere** — There are no users. Deploying now buys a monthly bill and an
  entirely new class of bug. The docker stack *is* the environment until someone needs a URL.
- **Deleting Phase 7** (marketplace, public API, AI verification, SMS) — Correct to do, wrong
  to do first. Deleting before the harness exists means deleting without being able to prove
  nothing else broke. Do it as the harness's first real job.
- **New features, including the QR-code angler flow** — Nothing new gets built until the
  machine can prove it works. That is the entire point.
- **Migrations** — Genuinely foundational and genuinely next, but a migration gate needs a
  running database to test up/down against, and that is what the harness provides. Sequenced
  second, not dropped.

## Open Questions

- Will CI actually be allowed to be the referee — i.e. will red block the morning merge?
- Does the backlog live in-repo as a file (diffable, agent-editable) or as GitHub issues?
- What is the shelf life of "no users"? Set a date to revisit, or it becomes permanent by
  default.


---

## Findings — task zero, 2026-09-01

Green was restored across the board: **typecheck 9/9, lint 5/5, tests 38/38.** Every recent CI
run before this — eight consecutive, including on `main` — was red, and nothing in the repo's
own documentation reflected that.

**Fixed**

| Area | Problem | Fix |
|---|---|---|
| Toolchain | `pnpm` and `bun` absent; nothing pinned | `mise.toml` pins node 22 / pnpm 10.30.1 / bun 1.4.0; CI aligned to match |
| `packages/api` tests | 20 of 28 failing | Fixtures like `2222...-2222-...` are not valid UUIDs. Zod 4 enforces RFC 9562 version/variant bits where Zod 3 did not, so every request 400'd — and a request that 400s early never drains the mock result queue, poisoning the following test. One cause, twenty failures. |
| `packages/validators` | `z.record(z.unknown())` | Zod 4 requires an explicit key schema |
| `packages/scoring` | Unused `index` param vs `noUnusedParameters` | Removed |
| Stripe (5 call sites) | `Stripe.latestApiVersion` is a *type*, not a runtime value — it evaluated to `undefined` | Pinned to `"2026-02-25.clover"` |
| `apps/web` | Clerk 7 moved `afterSignOutUrl` off `<UserButton>` | Moved to `<ClerkProvider>` |
| `apps/web` | `next lint` was removed in Next 16 | `eslint src/`, matching the other packages |
| `apps/web` | FlatCompat crashed on `eslint-config-next` 16 | v16 ships a native flat config; spread it directly |
| `apps/mobile` | Hoisted `node_modules` leaked `@types/bun`, whose `fetch` overloads conflict with React Native's | Pinned `types: ["react"]` |
| `packages/types` | `Tenant` missing `aboutText` / `rulesText` | Added |

**The pattern:** almost every failure is an unrun upgrade — Zod 3→4, Next 15→16, Clerk 6→7,
Stripe. Dependencies were bumped and the checks were never executed. This is precisely the
failure mode the harness exists to prevent.

**Found, not fixed — backlog**

- `packages/types` hand-maintains interfaces duplicating the Drizzle schema, carrying the
  comment *"will be synced with Drizzle schema."* It never was. Derive from
  `typeof tenants.$inferSelect` instead, or it will drift again.
- `@types/react` is pinned `~18.3.0` while `pnpm.overrides` forces React `19.2.4`.
- Still no migrations directory — schema has only ever been `db:push`'d.
- Docs assert things that are false: README/CLAUDE.md claim Expo SDK 52 in one section and 55
  in another; CLAUDE.md gotcha #8 references `packages/api/Dockerfile`, which does not exist;
  the "28 tests" listed as a completed win had 20 failing.
- `pnpm install` skips build scripts for `sharp` and `esbuild`; may matter for `next build`.
