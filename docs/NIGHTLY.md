# Nightly Backlog

Work queue for unattended agent runs. One task per run. Read the Protocol first.

Every Verify block sources `scripts/verify-lib.sh`. **Do not hand-roll a `grep` in a
Verify block.** Two adversarial reviews of this file found the same three bugs over and
over — greps that pass on a missing path, `grep -q "$(failed-command)"` matching
anything, and `! grep` reading an error as clean. The helpers treat "could not check"
as failure. Use them.

---

## Protocol

### Before choosing a task

1. Read the most recent files in `docs/nightly/log/`. **Never re-attempt a task a
   previous night moved to Blocked unless its stated blocking reason has demonstrably
   changed.**
2. Check `main`:
   ```bash
   source scripts/verify-lib.sh
   SHA=$(capture "origin/main sha" "git rev-parse origin/main")
   timeout 60 gh run list --branch main --limit 1 --json headSha,conclusion \
     --jq '"\(.[0].headSha) \(.[0].conclusion)"' | grep -q "$SHA success" \
     || echo "MAIN NOT VERIFIED GREEN AT $SHA"
   ```
   `gh run list` without `--json` prints rows a human eyeballs; it cannot tell red from
   *never ran*, and a stale green run on an old SHA reads as success forever.

   **If `main` is not green:** if the fix is already committed on a branch, that is not
   something you can finish — merging is a human act. Put the branch name and an explicit
   merge request as the **first line of the handoff**, then proceed to the topmost Ready
   task. Do not stall the night, and do not redo work that is already committed.
3. Take the topmost **Ready** task. If it turns out to be gated, move it to Blocked with
   the reason and take the next one.

### Definition of done

Every command in the task's Verify block exits 0, unattended, in a clean tree.

**Verify in a worktree, after committing.** `git clean -xdf` deletes untracked files —
including the new spec you just wrote and the log you are told to append to. So:
```bash
git add -A && git commit          # commit first
git worktree add /tmp/verify HEAD # verify a clean copy of what you committed
cd /tmp/verify && mise install && pnpm install --frozen-lockfile
cp apps/web/.env.local.docker apps/web/.env.local
cp packages/api/.env.docker    packages/api/.env
cp packages/db/.env.docker     packages/db/.env
```
If the task adds a dependency, the lockfile must be in that commit or
`--frozen-lockfile` fails.

**Every command that touches network, Docker, or a server gets a `timeout`.**

### A Verify block that is green before you start is a broken task

Run the Verify block **first, before changing anything.** If it already passes, the task
is mis-specified: it cannot prove its own Goal. **Record that as the finding, propose a
replacement Verify block in the handoff, and move to the next task.** Do not report it
as done.

This rule exists because it already happened: R1 was completed and committed, its five
checks passed, and it sat in Ready — a subsequent agent would have "completed" it a
second time having changed nothing.

### Assert truth, not consistency

A check that compares two documents to each other passes when both are wrong in the same
way. Assert against the thing that is actually true — `package.json`, the schema, the
running server — not against another document.

### Never do these

- Delete, skip, `.only`, `test.skip`, `test.fixme`, `describe.skip`, or comment out a
  failing test.
- Add `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, or `any` to clear an error.
- Loosen an assertion, including `expect.soft` and `toPass()` with a long timeout.
- Add `retries:` to a Playwright config — in any spelling, including
  `retries: process.env.CI ? 2 : 0` — or `--retries=` to a test script.
- Intercept the network in an end-to-end test: `page.route`, `context.route`,
  `routeFromHAR`, `route.fulfill`, or any stubbing of `/api/**`.
- Use `mock.module` outside `packages/api/test/`.
- Narrow a command **after the fact** to make it pass: adding `--filter=`, dropping a
  flag, restricting a CI `paths:` trigger, `continue-on-error`, `if: false`,
  `if: ${{ false }}`. (A `--filter=` written into a task's own Verify block is that
  task's designed scope and is fine.)
- Relax, reword, or delete a Verify block, or a helper in `scripts/verify-lib.sh`.

### Editing this file

Moving a task between Ready / Blocked / Done and appending new tasks is expected. **Any
other change must be quoted verbatim in the handoff** — especially a changed Verify
block or a changed helper.

### Batch size

Under ~300 changed lines, excluding lockfiles and generated files. Over that, split:
commit the independently-green part, append the remainder as a new Ready task with its
own Goal and Verify block, and name the new task id in the handoff. Tasks marked
**(large)** are exempt.

### Handoff

Append to `docs/nightly/log/YYYY-MM-DD.md` (`mkdir -p docs/nightly/log` first):

1. Task id and final state: `done` / `blocked` / `partial` / `mis-specified`.
2. The Verify block with its **actual output**, including the pre-change run that proved
   it was not already green.
3. Branch, commit SHA, whether it was pushed, and `git diff --stat`.
4. `main`'s verified status per Protocol step 2. If not green, this is the first line.
5. **Every human action currently blocking any task, restated in full** — including the
   exact commands. The human reads this log and nothing else; a blocker recorded only in
   `NIGHTLY.md` never reaches them.
6. Anything found but deliberately not fixed.
7. **"Passed but hollow"** — any Verify block that went green where you do not believe
   the Goal was met. This is the most valuable line in the log. Write it.
8. One sentence a human needs to decide the next move.

### Standing known defects — not covered by any check

Repeat these in every handoff until a task closes them:

- **Anglers must type a raw tournament UUID** into `apps/mobile/src/app/(tabs)/submit.tsx`
  and `leaderboard.tsx`. No harness task covers mobile end to end. See R4.
- **No web UI creates a catch.** `apps/web/src/actions/catches.ts` exports only
  `verifyCatch`, `aiVerifyCatch`, `deleteCatch`. See G4b.
- **`GET /api/public/tournaments` has no tenant filter and no `deletedAt` filter**
  (`packages/api/src/routes/public.ts`). It returns every club's tournaments. See R5.
- **No migrations exist.** Schema has only ever been `db:push`'d. See G7.

---

## Ready — no Docker required

### R3 — Stop hand-maintaining types that mirror the schema  **(large)**
Goal: `packages/types/src/index.ts` hand-writes interfaces duplicating the Drizzle
schema, labelled *"will be synced with Drizzle schema."* It never was — it silently lost
`aboutText`/`rulesText`, which is how a shipped settings editor typechecked against
columns the type did not know about.

**Direction is fixed, because the obvious approach does not compile.** `packages/db`
already depends on `@tourneyforge/types` (and on `validators`, which depends on `types`).
Adding `@tourneyforge/db` to `packages/types` creates a cycle and turbo refuses to build
the workspace at all:
```
Cyclic dependency detected: @tourneyforge/types, @tourneyforge/validators, @tourneyforge/db
```
So: **delete the DB-mirroring interfaces from `packages/types` and have consumers import
the inferred types from `@tourneyforge/db`.** Do not add a dependency to `packages/types`,
and do not break the cycle by removing `@tourneyforge/types` from `packages/db` — that is
a real change to the dependency graph made to satisfy a check.

Verify:
```bash
source scripts/verify-lib.sh
# every mirrored shape gone, as interface OR type alias:
for T in Tenant Tournament ScoringFormat User Team Registration Catch; do
  must_not_match "^export (interface|type) $T\b" packages/types/src/index.ts
done
must_not_match '"@tourneyforge/db"' packages/types/package.json   # no new cycle
timeout 600 pnpm run check                                        # all 9 packages
```
A grep can never detect drift. The real guard is that the types no longer exist to
drift: nothing to keep in sync.

---

### R4 — Kill the UUID entry in the mobile app  **(large)**
Goal: the defect this whole harness exists for. An angler in a boat cannot type
`22222222-2222-4222-8222-222222222222`. `submit.tsx` demands a tournament UUID;
`leaderboard.tsx` demands one too.

Deliver: a tournament picker on both screens, plus a jest-expo test runner
(`apps/mobile` currently has no `test` script, no jest config, no
`@testing-library/react-native` — standing that up is part of this task).

Verify:
```bash
source scripts/verify-lib.sh
S='apps/mobile/src/app/(tabs)/submit.tsx'
L='apps/mobile/src/app/(tabs)/leaderboard.tsx'
have_file "$S"; have_file "$L"
# STRUCTURAL, not cosmetic. Renaming a label to "Tournament *" and a placeholder to
# "Tournament" passes a string grep while the TextInput stays bound to setTournamentId.
must_not_match 'onChangeText=\{setTournamentId\}' "$S" "$L"
must_not_match 'onChangeText=\{setTeamId\}' "$S"
script_exists apps/mobile test
timeout 600 pnpm --filter @tourneyforge/mobile run check
timeout 600 pnpm --filter @tourneyforge/mobile test
# the mutation check — the only one that cannot be satisfied hollowly:
cp "$S" /tmp/submit.bak; trap 'cp /tmp/submit.bak "$S"' EXIT
#   delete the picker, the suite MUST go red
```
The mutation step is written out in full as part of the deliverable. Guardrail: a
component test asserting the picker renders options and that submit stays disabled until
one is chosen. No Detox, no simulator.

---

### R5 — `GET /api/public/tournaments` leaks across tenants
Goal: `packages/api/src/routes/public.ts` selects every `open|active` tournament with no
tenant filter and no `isNull(deletedAt)` filter. Every club sees every other club's
tournaments — and R4 is about to build the angler's picker on top of it.

Verify:
```bash
source scripts/verify-lib.sh
must_match 'isNull\(tournaments\.deletedAt\)' packages/api/src/routes/public.ts
must_match 'tenantId' packages/api/src/routes/public.ts
timeout 300 cd packages/api && bun test   # add a case: two tenants, each sees only its own
```

---

## Gated — a human must act first

Not "Blocked" — these are ready to run the moment someone runs two commands. Do not
retire them.

> **Human action required, must be repeated in every handoff:**
> ```bash
> sudo systemctl enable --now docker   # daemon is inactive AND disabled
> sudo usermod -aG docker $USER        # $USER is in: mark wheel
> ```
> then log out and back in. Check with `docker compose ps` before starting any G task;
> if it fails, take a Ready task instead.

### G1 — Prove the offline stack runs the product
Goal: establish the docker stack actually serves this application. Note the health
endpoint is `GET /`, not `/api/health`, and nothing starts the API server for you.

Verify:
```bash
source scripts/verify-lib.sh
timeout 300 docker compose up -d --wait      # --wait, not a grep for "healthy":
                                             # `grep -q healthy` matches "unhealthy",
                                             # and mailpit/minio-setup declare no
                                             # healthcheck at all
timeout 120 pnpm db:push --force             # drizzle-kit prompts on destructive
                                             # diffs and will hang unattended
timeout 120 pnpm db:seed
(cd packages/api && bun run src/index.ts & echo $! > /tmp/api.pid)
trap 'kill "$(cat /tmp/api.pid)" 2>/dev/null' EXIT
timeout 60 bash -c 'until curl -fsS localhost:3001/ >/dev/null 2>&1; do sleep 2; done'
must_contain_literal "health" "curl -fsS localhost:3001/" '"status":"ok"'
# the seed actually landed:
ROWS=$(capture "tournament count" "timeout 30 docker compose exec -T postgres \
  psql -U tf -d tourneyforge -tAc 'select count(*) from tournaments'")
[ "$ROWS" -ge 1 ] || fail "seed produced no tournaments"
NAME=$(capture "seeded tournament name" "timeout 30 docker compose exec -T postgres \
  psql -U tf -d tourneyforge -tAc 'select name from tournaments limit 1'")
must_contain_literal "public list" "timeout 30 curl -fsS localhost:3001/api/public/tournaments" "$NAME"
```
`capture` fails on empty output, so the name assertion can never degrade into
`grep -q ""` matching `{"data":[]}`.

---

### G2 — One command from clean checkout to running app
**Runs before G3, which depends on it.** Goal: collapse G1 into `pnpm dev:up`.

Deliver: `scripts/dev-up.sh` — start docker services, wait on real health, push schema,
seed, start web and API, print both URLs, and **return** (do not block).

Verify:
```bash
source scripts/verify-lib.sh
have_file scripts/dev-up.sh
script_exists . dev:up
timeout 60 docker compose down -v
timeout 300 pnpm dev:up                      # cold
START=$(date +%s); timeout 120 pnpm dev:up; ELAPSED=$(( $(date +%s) - START ))
[ "$ELAPSED" -lt 20 ] || fail "warm start took ${ELAPSED}s — script is sleeping, not polling health"
must_contain_literal "prints URLs" "timeout 120 pnpm dev:up" "localhost:3000"
# a sleeping script cannot notice a dead dependency:
timeout 60 docker compose stop postgres
timeout 180 pnpm dev:up && fail "dev:up succeeded with postgres down — it is not checking health"
timeout 60 docker compose start postgres
```
The warm-start timing plus the dead-postgres case are what actually distinguish polling
from `sleep`. Grepping the script for `sleep` does not: `command sleep 30` and
`/bin/sleep 30` both slip past it.

---

### G3 — Point at the offline stack
Goal: `apps/web/.env.local.docker`, `packages/api/.env.docker` and
`packages/db/.env.docker` already exist, are tracked, and are good. Nothing points at
them — `README.md` has zero occurrences of "docker", "offline", or "no cloud", so a
reader cannot tell this app runs with no accounts and no keys.

Verify:
```bash
source scripts/verify-lib.sh
must_match 'docker' README.md
must_match 'no cloud accounts' README.md
must_match '\.env\.local\.docker' README.md
must_match 'docker' .env.example
timeout 300 pnpm dev:up
SLUG=$(capture "seeded tenant slug" "timeout 30 docker compose exec -T postgres \
  psql -U tf -d tourneyforge -tAc 'select slug from tenants limit 1'")
NAME=$(capture "seeded tournament" "timeout 30 docker compose exec -T postgres \
  psql -U tf -d tourneyforge -tAc 'select name from tournaments limit 1'")
must_contain_literal "tenant page renders seeded data" \
  "timeout 60 curl -fsS -H 'Host: ${SLUG}.localhost' localhost:3000/tournaments" "$NAME"
must_not_match 'sk_live_|sk_test_[A-Za-z0-9]{20}|whsec_|pk_live_' $(git ls-files)
```
Guardrail: the marketing page at `/` renders with no database and contains the word
"TourneyForge". Asserting on it proves nothing — assert on a tenant page.

---

### G4a — The web money path, proven through the UI  **(large)**
Goal: one Playwright test: **director creates tournament -> angler registers ->
leaderboard ranks correctly**, every step reached by clicking.

**Scope honesty:** catch submission is deliberately absent — no web UI creates a catch.
This test seeds catches through a fixture, and the handoff must say so in those words.
G4b closes it. Deliverable includes installing Playwright, its browsers, and a
`test:e2e` script; none exist today.

Verify:
```bash
source scripts/verify-lib.sh
have_dir apps/web/e2e
script_exists apps/web test:e2e
must_not_match 'page\.route|context\.route|routeFromHAR|\.fulfill\(|test\.skip|test\.fixme|describe\.skip|expect\.soft' apps/web/e2e
must_not_match 'retries' apps/web/playwright.config.ts
must_not_match 'retries' apps/web/package.json
timeout 300 pnpm dev:up && timeout 900 pnpm test:e2e
# THE check that cannot be satisfied hollowly. Restart the API after mutating, or it
# keeps serving the pre-mutation module — `bun run` has no --watch.
cp packages/scoring/src/index.ts /tmp/scoring.bak
trap 'cp /tmp/scoring.bak packages/scoring/src/index.ts' EXIT
sed -i 's/b - a/a - b/' packages/scoring/src/index.ts
kill "$(cat /tmp/api.pid)" 2>/dev/null; (cd packages/api && bun run src/index.ts & echo $! > /tmp/api.pid)
timeout 60 bash -c 'until curl -fsS localhost:3001/ >/dev/null 2>&1; do sleep 2; done'
timeout 900 pnpm test:e2e && fail "inverted the leaderboard comparator and the suite still passed"
cp /tmp/scoring.bak packages/scoring/src/index.ts
```
Guardrail: register at least three teams whose totals produce an order that is neither
alphabetical nor insertion order, and assert the full ordered list of names *and*
scores. Do not construct a URL from an id: reach every page by clicking. A grep cannot
enforce that — `` page.goto(`/tournaments/${id}`) `` contains no literal UUID — so the
mutation check above is what actually carries this task.

---

### G4b — An angler can submit a catch on the web  **(large)**
Goal: close the gap G4a documents.

Verify:
```bash
source scripts/verify-lib.sh
must_match 'export async function (createCatch|submitCatch)' apps/web/src/actions/catches.ts
# repeat every G4a anti-cheat check — this task extends the same suite:
must_not_match 'page\.route|context\.route|routeFromHAR|\.fulfill\(|test\.skip|test\.fixme|describe\.skip|expect\.soft' apps/web/e2e
must_not_match 'retries' apps/web/playwright.config.ts
timeout 300 pnpm dev:up && timeout 900 pnpm test:e2e
```
The test must assert the catch row count goes 0 -> 1 **across two Playwright steps with
no non-browser write between them**, by querying Postgres directly before and after the
UI step. Do not grep the spec for the word "count" — that is satisfied by a comment.

---

### G5 — CI runs the harness
Goal: green enforced by something outside the agent's reach.

Deliver: a CI job standing up the docker services and running G4a on every PR.

**Human step, must be requested in the handoff:** making the job a *required* status
check needs repo-admin rights. Until then the job is advisory and can be merged past.
Do not claim otherwise.

Verify:
```bash
source scripts/verify-lib.sh
must_match 'e2e' .github/workflows/ci.yml
must_not_match 'continue-on-error|if: false|if: \$\{\{ false \}\}' .github/workflows/ci.yml
must_not_match 'paths:' .github/workflows/ci.yml     # no narrowed trigger
# prove the red case locally with a PRODUCT mutation, no `act` (not installed):
cp packages/scoring/src/index.ts /tmp/scoring.bak
trap 'cp /tmp/scoring.bak packages/scoring/src/index.ts' EXIT
sed -i 's/b - a/a - b/' packages/scoring/src/index.ts
must_not_match '(test|spec)' "$(git diff --name-only)"   # mutation touched no test file
timeout 900 pnpm test:e2e && fail "product mutation did not turn the harness red"
cp /tmp/scoring.bak packages/scoring/src/index.ts
```
Guardrail: a job that cannot fail is worthless. Prove red; never assume it.

---

## Backlog — after G5

- **G6 — `@types/react` is `~18.3.0` in `apps/mobile`** while `pnpm.overrides` forces
  React `19.2.4`. Needs a Goal and Verify before it is Ready. `apps/mobile/tsconfig.json`
  deliberately pins `types: ["react"]` to stop hoisted `@types/bun` clashing with React
  Native, so any Verify must include `pnpm --filter @tourneyforge/mobile run check`.
- **G7 — Migrations and a migration gate.** No `drizzle/` directory; schema has only ever
  been `db:push`'d, so no customer's data survives a schema change. Gate: every schema
  edit ships a migration applying *and* rolling back against the docker postgres in CI.
- **G8 — Delete Phase 7** (marketplace, public API v1, AI verification, SMS). **G4a
  exercises none of it**, so "G4a still green" is not proof the deletion was safe — it
  only proves the money path survived. Write a smoke check per surface before removing
  it, or state in the handoff that the deletion is unproven and reviewed by eye.

---

## Blocked

_(move tasks here with the reason they stopped and what would unblock them)_

---

## Done

- **N0 — Restore green.** `751192b`. Toolchain pinned; typecheck 9/9, lint 5/5, tests
  38/38. Root cause of 20 failing API tests: fixtures that are not valid UUIDs, against
  Zod 4's RFC 9562 enforcement. Detail in `docs/ideas/proving-harness.md`.
  **Correction:** left `bun = "latest"` in `mise.toml` while CI pinned `1.4.0`; the
  commit message and `proving-harness.md` both overstated that pin. Fixed in `32ce1ea`.
- **R2 — Seed data must not expire.** `1bd9069`. `packages/db/src/seed.ts` hard-coded
  ISO date literals, so every seeded tournament's `registrationDeadline` was in the past
  and the public registration page called `notFound()` on all of them. Dates are now
  offsets from `Date.now()` via `buildSeedTournaments(now)`; three tournaments seeded
  (`open`, `active`, `draft`), each with a pinned `scoringFormatId` that references a
  scoring format the seed itself inserts. New guard `scripts/check-seed.ts` imports the
  fixtures (no database — `postgres()` is lazy, and `seed.ts` now gates its writes on
  being the process entrypoint) and asserts deadlines, statuses, format ids that
  actually resolve, and that advancing the clock a year moves every date a year.
  `packages/db/src/simulate-leaderboard.ts` now reads the tournament name from the seed
  instead of duplicating the literal.
- **R1 — Make the documentation true.** `090a856`, completed `a86d24b`. Expo SDK 52→55
  (6 places incl. `apps/mobile/README.md`, which the original check did not look at),
  Next.js 15→16, RN 0.83.0→0.83.2, a gotcha citing a `packages/api/Dockerfile` that does
  not exist, a stale `pnpm@9.15.4` CI comment, and "all 7 phases complete" asserted while
  CI was red eight runs deep. **Correction:** R1 was first reported done while still
  listed in Ready, and its checks compared the two root docs to each other rather than to
  `package.json` — so it passed while `apps/mobile/README.md` still said SDK 52. Both the
  green-on-arrival rule and the assert-truth-not-consistency rule in the Protocol exist
  because of this task.
