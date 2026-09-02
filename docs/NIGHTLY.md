# Nightly Backlog

Work queue for unattended agent runs. One task per run. Read the Protocol first.

This file is version-controlled. Its Verify blocks are the product's definition of
working. Treat an edit to one the way you would treat an edit to a test.

---

## Protocol

### Before choosing a task

1. Read the three most recent files in `docs/nightly/log/`. **Never re-attempt a task
   that a previous night moved to Blocked unless its stated blocking reason has
   demonstrably changed.** Two agents burning two nights on the same wall is the
   failure this rule exists to prevent.
2. Run `gh run list --branch main --limit 3`. If `main` is red, fixing that is the
   task, whatever this file says.
3. Take the topmost **Ready** task. If it turns out to be blocked, move it to Blocked
   with the reason and take the next one — do not stop for the night.

### Definition of done

Every command in the task's `Verify` block exits 0, from a clean checkout, unattended.

**Clean checkout** means `git clean -xdf` followed by:
```bash
mise install && pnpm install --frozen-lockfile
cp apps/web/.env.local.docker  apps/web/.env.local
cp packages/api/.env.docker    packages/api/.env
cp packages/db/.env.docker     packages/db/.env
```
`.env` files are gitignored, so a check that silently depends on one already sitting on
the machine proves nothing.

**Every command gets a timeout.** An unattended run that hangs costs the whole night.
Wrap anything touching network, Docker, or a dev server in `timeout`.

Not done: it typechecks. Not done: it looks right. Done: the commands pass.

### Never do these

Each converts a real failure into a false green, which is worse than an unfinished task.

- Delete, skip, `.only`, `test.skip`, `test.fixme`, or comment out a failing test.
- Add `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, or `any` to clear an error.
- Loosen an assertion. This includes `expect.soft` and `toPass()` with a long timeout.
- Add `retries:` to `playwright.config.ts`. A flaky test that passes on attempt 3 is a
  red test wearing a disguise.
- Intercept the network in an end-to-end test — `page.route`, `route.fulfill`, or any
  stubbing of `/api/**`. E2E runs against a live server or it is not E2E.
- Use `mock.module` anywhere outside `packages/api/test/`. It is the house style for
  unit tests and a lie in an integration test.
- Narrow a command's scope to make it pass — adding `--filter=`, dropping a flag,
  restricting a `paths:` trigger in CI, `continue-on-error: true`, or `if: false`.
- Relax, reword, or delete a `Verify` block.

### Editing this file

You will need to move tasks between Ready / Blocked / Done, and may append new tasks.
That is expected. **Any other change to this file must be quoted verbatim in the
handoff** — especially a changed Verify block.

If a Verify block genuinely cannot prove its Goal, say so, and in the handoff supply a
**proposed replacement Verify block** plus whatever work you completed. "The task was
badly written" is a valid finding; it is not a valid reason to end the night empty.

### Batch size

Target under ~300 changed lines, excluding lockfiles and generated files. If a task
runs over, do not abandon it — split it:

1. Commit the part that is independently green.
2. Append the remainder as a new Ready task, with its own Goal and Verify block.
3. Name the new task id in the handoff.

Tasks marked **(large)** are exempt; they cannot be usefully split.

### Handoff

Append to `docs/nightly/log/YYYY-MM-DD.md` (`mkdir -p docs/nightly/log` first):

1. Task id and final state: `done` / `blocked` / `partial`.
2. The Verify block, pasted with its **actual output**.
3. Branch, commit SHA, whether it was pushed, and `git diff --stat`.
4. Output of `gh run list --branch main --limit 3`. **If `main` is red, that is the
   first line of the log**, ahead of everything else.
5. Anything found but deliberately not fixed.
6. One sentence a human needs in order to decide the next move.

### Standing known defects — not covered by any check

State these in every handoff until a task closes them. They are the things a green
night does *not* prove:

- **Anglers must paste a raw tournament UUID and team UUID** into
  `apps/mobile/src/app/(tabs)/submit.tsx` (and a tournament UUID in
  `leaderboard.tsx`). No harness task covers mobile. See R4.
- **No web UI creates a catch.** `apps/web/src/actions/catches.ts` exports only
  `verifyCatch`, `aiVerifyCatch`, `deleteCatch`. See D4b.
- **No migrations exist.** Schema has only ever been `db:push`'d. See D7.

---

## Ready — no Docker required

### R1 — Make the documentation true
Goal: every factual claim in `README.md` and `CLAUDE.md` is either correct or deleted.
This file's whole premise is that written claims must be checkable; the repo's own docs
are currently the largest pile of unchecked claims in it.

Known false claims (find others; this list is not exhaustive):
- README and CLAUDE.md say Expo SDK 52 in the structure section and SDK 55 in the
  gotchas. One is wrong.
- CLAUDE.md gotcha #8 instructs building `packages/api/Dockerfile`. That file does not
  exist.
- CLAUDE.md records "28 tests" as a completed win. 20 of them were failing until
  commit `751192b`.
- `.github/workflows/ci.yml` carries the comment `reads "packageManager" from
  package.json (pnpm@9.15.4)`. `package.json` says `pnpm@10.30.1`.
- `docs/ideas/proving-harness.md` claims `mise.toml` pins bun 1.4.0. It said
  `bun = "latest"` until this was corrected — verify it now reads `1.4.0`.

Verify:
```bash
test -f packages/api/Dockerfile || ! grep -rn "packages/api/Dockerfile" CLAUDE.md
test "$(grep -roE 'Expo SDK [0-9]+' README.md CLAUDE.md | grep -oE '[0-9]+$' | sort -u | wc -l)" = 1
! grep -n "pnpm@9" .github/workflows/ci.yml
grep -q "$(grep -oE 'bun-version: [0-9.]+' .github/workflows/ci.yml | grep -oE '[0-9.]+$')" mise.toml
grep -q "$(grep -oE 'node-version: [0-9]+' .github/workflows/ci.yml | grep -oE '[0-9]+$' | head -1)" mise.toml
```
Guardrail: correct or delete a claim. Do not soften it into something unfalsifiable.

---

### R2 — Seed data must not expire
Goal: `packages/db/src/seed.ts` hard-codes `registrationDeadline: new Date(
"2026-04-10T23:59:59Z")` and similar. Today is past those dates, so
`apps/web/src/app/[tenant]/tournaments/[id]/register/page.tsx` calls `notFound()` on
every seeded tournament — the registration page 404s. Seeded tournaments also have
`scoringFormatId` unset, so `packages/api/src/routes/leaderboards.ts` takes its
no-format branch and "ranks correctly" is undefined for seed data.

Deliver: dates computed relative to `now()`; one tournament `open` with a future
deadline, one `active`; every seeded tournament assigned a real `scoringFormatId`.

Verify:
```bash
! grep -nE 'new Date\("20[0-9]{2}-' packages/db/src/seed.ts
grep -q "scoringFormatId" packages/db/src/seed.ts
pnpm --filter @tourneyforge/db exec tsc --noEmit
```
Guardrail: relative dates, not dates further in the future. A 2027 literal is the same
bug with a longer fuse.

---

### R3 — Derive shared types from the schema
Goal: `packages/types/src/index.ts` hand-maintains interfaces duplicating the Drizzle
schema, labelled *"will be synced with Drizzle schema."* It never was — it silently
lost `aboutText`/`rulesText`, which is how a shipped settings editor typechecked
against columns the type did not know about. Replace with `typeof x.$inferSelect`.

`apps/mobile/package.json` already depends on `@tourneyforge/db`, so the import path
exists; confirm it resolves without `DATABASE_URL` set, since `packages/db` throws at
import time without one. If it does not, that is the finding — report it and stop.

Verify:
```bash
! grep -nE "^export interface (Tenant|Tournament|ScoringFormat|User)\b" packages/types/src/index.ts
pnpm run check                                    # all 9 packages
# drift guard: adding a column must not require editing packages/types
grep -q '\$inferSelect' packages/types/src/index.ts
```

---

### R4 — Kill the UUID paste in the mobile app  **(large)**
Goal: the defect that motivated this entire harness. An angler standing in a boat
cannot paste `22222222-2222-4222-8222-222222222222` into a text field.
`apps/mobile/src/app/(tabs)/submit.tsx` demands a tournament UUID and a team UUID;
`leaderboard.tsx` demands a tournament UUID.

Deliver: a picker on both screens listing tournaments from
`GET /api/public/tournaments` (the endpoint already exists and the tournaments tab
already calls it), and a team picker scoped to the chosen tournament. Free-text UUID
entry is removed, not merely hidden behind a toggle.

Verify:
```bash
! grep -rniE "paste (tournament|team)|Tournament ID \*|Team ID \*" apps/mobile/src
pnpm --filter @tourneyforge/mobile run check
pnpm --filter @tourneyforge/mobile test        # component test: picker renders
                                               # options fetched from the endpoint,
                                               # and submit stays disabled until one
                                               # is selected
```
Guardrail: no Detox, no simulator. A component-level test that renders the picker
against a stubbed endpoint response is sufficient and is the point — this task exists
because the E2E harness will never reach mobile.

---

## Blocked — needs the Docker daemon (human step)

**Unblock recipe**, requires root, then a re-login for group membership:
```bash
sudo systemctl enable --now docker      # daemon is currently inactive AND disabled
sudo usermod -aG docker $USER           # $USER is in: mark wheel
```
Every task below needs this. Do not attempt them until `docker compose ps` succeeds;
verify that first and move straight on to a Ready task if it fails.

### D1 — Prove the offline stack runs the product
Goal: establish that `docker-compose.yml` (postgres, redis, minio, mailpit) actually
serves this application, rather than merely starting containers. Note the API server
does not start itself — the health endpoint is `GET /`, not `/api/health`.

Verify:
```bash
timeout 300 docker compose up -d
timeout 120 bash -c 'until docker compose ps --format json | grep -q healthy; do sleep 2; done'
timeout 120 pnpm db:push --force        # non-interactive: drizzle-kit prompts on
                                        # destructive diffs and will hang otherwise
timeout 120 pnpm db:seed
(cd packages/api && timeout 600 bun run src/index.ts &) 
timeout 60 bash -c 'until curl -fsS localhost:3001/ >/dev/null 2>&1; do sleep 2; done'
curl -fsS localhost:3001/ | grep -q '"status":"ok"'
# the seed actually landed — not merely that a route is mounted:
docker compose exec -T postgres psql -U tf -d tourneyforge -tAc \
  'select count(*) from tournaments' | grep -qE '^[1-9]'
curl -fsS localhost:3001/api/public/tournaments | grep -q "$(
  grep -oE '"[A-Za-z0-9 ]+ (Classic|Open|Championship|Series)[^"]*"' packages/db/src/seed.ts | head -1 | tr -d '"')"
```
Guardrail: `{"data":[]}` contains `"data"`. Assert on seeded content, never on the
shape of an empty response. If `db:push` or `db:seed` fails, that failure is the
finding — fix the code, never weaken the check, and never add a route just to satisfy
a URL written here.

---

### D2 — Point at the offline stack
Goal: `apps/web/.env.local.docker`, `packages/api/.env.docker` and
`packages/db/.env.docker` already exist, are tracked, and are good — they set
`LOCAL_DEV=true` and every local endpoint. Nothing points at them. `README.md` contains
zero occurrences of "docker", "offline", or "no cloud", so a reader cannot tell this
app runs with no accounts and no keys.

Deliver: a README section stating that plainly, with the three `cp` commands; and a
header in `.env.example` pointing to the `.docker` variants.

Verify:
```bash
grep -qi "docker" README.md && grep -qi "no cloud accounts" README.md
grep -q ".env.local.docker" README.md
grep -qi "docker" .env.example
# proves the documented path works, against a page that needs the database:
timeout 300 pnpm dev:up
trap 'kill %1 2>/dev/null' EXIT
timeout 600 pnpm turbo run dev --filter=@tourneyforge/web &
timeout 90 bash -c 'until curl -fsS localhost:3000 >/dev/null 2>&1; do sleep 2; done'
curl -fsS -H "Host: $(grep -oE "slug: \"[a-z-]+\"" packages/db/src/seed.ts | head -1 | \
  grep -oE '"[a-z-]+"' | tr -d '"').localhost" localhost:3000/tournaments | grep -q "Classic"
# no real secret ever committed:
! git ls-files -z | xargs -0 grep -lE "sk_live_|sk_test_[A-Za-z0-9]{20}|whsec_|pk_live_"
```
Guardrail: the marketing page at `/` renders with no database and contains the word
"TourneyForge" — asserting on it proves nothing. Assert against a tenant page.

---

### D3 — One command from clean checkout to running app
Goal: collapse D1 into `pnpm dev:up`. Every manual step is one an overnight agent gets
wrong and a human forgets.

Deliver: `scripts/dev-up.sh` — start docker services, wait on real health checks, push
schema, seed, start web and API, print both URLs. Idempotent.

Verify:
```bash
! grep -qE '^\s*sleep' scripts/dev-up.sh   # "wait on health, not a fixed delay"
docker compose down -v && timeout 300 pnpm dev:up    # cold start, bounded
timeout 120 pnpm dev:up                              # warm start must be fast —
                                                     # this is what proves it polls
                                                     # health rather than sleeping
pnpm dev:up | grep -q "localhost:3000"               # "print the URLs", made real
curl -fsS localhost:3001/ | grep -q '"status":"ok"'
```

---

### D4a — The web money path, proven through the UI  **(large)**
Goal: one Playwright test covering **director creates tournament -> angler registers ->
leaderboard ranks correctly**, every step reached by clicking what a human would click.

**Scope honesty:** the catch-submission step is deliberately absent. No web UI creates
a catch — `apps/web/src/actions/catches.ts` exports only `verifyCatch`,
`aiVerifyCatch`, `deleteCatch`. This test seeds catches through a fixture, and the
handoff must say so in those words. D4b closes the gap.

The test may not navigate by building a URL from an id, and may not type an id into a
field. This is not style: an API-level test would have sailed straight over the
paste-UUID defect. If the test cannot reach something by clicking, a human cannot
either — report that as a finding.

Verify:
```bash
test -d apps/web/e2e || { echo "e2e dir missing"; exit 1; }   # a missing dir must
                                                              # FAIL, not pass
timeout 300 pnpm dev:up && timeout 600 pnpm test:e2e
# no ids typed or pasted, by any Playwright method:
! grep -rniE "goto\(|fill\(|type\(|pressSequentially\(|insertText\(" apps/web/e2e \
    | grep -qE "[0-9a-f]{8}-[0-9a-f]{4}"
# no stubbing, no softening:
! grep -rnE "page\.route|\.fulfill\(|test\.skip|test\.fixme|expect\.soft" apps/web/e2e
! grep -qE "retries:\s*[1-9]" apps/web/playwright.config.*
# THE test that cannot be satisfied hollowly — break scoring, the suite must go red:
sed -i 's/b - a/a - b/' packages/scoring/src/index.ts
! timeout 600 pnpm test:e2e
git checkout packages/scoring/src/index.ts
timeout 600 pnpm test:e2e
```
Guardrail: register at least three teams whose totals produce an order that is neither
alphabetical nor insertion order, and assert the full ordered list of team names *and*
their displayed scores. A one-team leaderboard "ranks correctly" trivially.

---

### D4b — An angler can submit a catch on the web  **(large)**
Goal: close the gap D4a documents. Build the route that lets a registered angler submit
a catch from a browser, then extend the D4a test to cover it by clicking.

Verify:
```bash
grep -qE "export async function (createCatch|submitCatch)" apps/web/src/actions/catches.ts
timeout 300 pnpm dev:up && timeout 600 pnpm test:e2e
# the catch must be created BY THE BROWSER: count rows before and after the UI step,
# with no non-browser write in between. Assert 0 -> 1 across those two Playwright steps.
grep -q "catches.*count" apps/web/e2e/*.spec.ts
```

---

### D5 — CI runs the harness
Goal: green enforced by something outside the agent's reach.

Deliver: a CI job that stands up the docker services and runs D4a on every PR, keeping
the existing typecheck/lint/test jobs.

**Human step, must be requested in the handoff:** making the job a *required* status
check needs repo-admin rights. Until that is done the job is advisory — an agent can
merge past it. Do not claim otherwise.

Verify:
```bash
# reproduce the CI job locally first, so this is checkable without network:
act -j e2e || docker compose -f .github/ci-local.yml up --exit-code-from runner
# prove the red case with a PRODUCT mutation, not a test edit:
sed -i 's/b - a/a - b/' packages/scoring/src/index.ts
git diff --name-only | grep -qv test        # the mutation must not touch a test file
! timeout 900 <the same CI job command>
git checkout packages/scoring/src/index.ts
! grep -rnE "continue-on-error|if: false" .github/workflows/
```
Guardrail: a job that cannot fail is worthless. Prove red; never assume it.

---

## Backlog — sequence after D5

- **D6 — `@types/react` is `~18.3.0` in `apps/mobile`** while `pnpm.overrides` forces
  React `19.2.4`. (`apps/web` is `^19.2.14` and is fine.) Needs a Goal and a Verify
  before it is Ready. Note: `apps/mobile/tsconfig.json` deliberately pins
  `types: ["react"]` to stop hoisted `@types/bun` clashing with React Native — a bump
  can reintroduce that, so the Verify must include `pnpm --filter @tourneyforge/mobile
  run check`.
- **D7 — Migrations and a migration gate.** No `drizzle/` directory; schema has only
  ever been `db:push`'d, so no customer's data survives a schema change. Gate: every
  schema edit ships a migration that applies *and* rolls back against the docker
  postgres in CI. Needs D1.
- **D8 — Delete Phase 7** (marketplace, public API v1, AI catch verification, SMS):
  built for a product with zero users, and surface area the harness must keep green
  forever. **D4a exercises none of it**, so "D4a still green" is not proof the deletion
  was safe — it only proves the money path survived. Either write a smoke check per
  deleted surface before removing it, or state in the handoff that the deletion is
  unproven and reviewed by eye.

---

## Blocked

_(move tasks here with the reason they stopped, and what would unblock them)_

---

## Done

- **N0 — Restore green.** `751192b`. Toolchain pinned in `mise.toml`; typecheck 9/9,
  lint 5/5, tests 38/38. Root cause of the twenty failing API tests: fixtures that are
  not valid UUIDs, against Zod 4's RFC 9562 enforcement. Findings in
  `docs/ideas/proving-harness.md`. **Correction:** the commit left `bun = "latest"` in
  `mise.toml` while CI pinned `1.4.0` — bun was unpinned, and both the commit message
  and `proving-harness.md` overstated this. Corrected in a follow-up; see R1.
