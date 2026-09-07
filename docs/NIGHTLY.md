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
   timeout 60 git fetch --quiet origin main   # origin/main is a stale LOCAL ref
                                              # otherwise: after a human merges the fix
                                              # this gate reports red forever
   capture_into SHA "origin/main sha" "git rev-parse origin/main"
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
is mis-specified: it cannot prove its own Goal. **Record that as the finding and move to
the next task.** Do not report it as done.

You may *propose* a replacement Verify block in the handoff, but never adopt one the same
night and never a weaker one. A proposal must quote the verbatim pre-change output proving
the block was already green, and is marked for human approval. Otherwise "mis-specified"
becomes the loophole that retires any hard task.

The pre-change run must fail on an assertion **about the product**, not on a missing
deliverable. Most tasks here gate on a file they are meant to create, so red-on-arrival is
guaranteed and proves nothing by itself — quote the specific product assertion that
failed.

This rule exists because it already happened: R1 was completed and committed, its five
checks passed, and it sat in Ready — a subsequent agent would have "completed" it a
second time having changed nothing.

**Carve-out: a task whose deliverable is evidence, not a diff.** Some tasks exist to
establish a fact rather than to change the product — their Verify block *is* the
deliverable, so green-on-arrival is success, not mis-specification. Such a task must say
so in its Goal. Task 1 is the worked example: it proves the docker stack serves the
application and changes nothing, so "already green" means the fact holds. Do not use this
carve-out on a task that ships a file or a behaviour change; for those, the rule above
stands unamended. (Added 2026-09-02 after task 1 hit it.)

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

### Batch size, and running a range

You will usually be given a **range**: *"work tasks 4-8"*. Rules:

- Tasks run **in ascending order**. Never reorder to take an easier one first.
- Each task gets its **own commit**, with its own Verify output in the handoff log.
- **Stop at the first task whose Verify block fails.** Do not attempt the rest of the
  range. A failure is usually the most valuable thing the night produced, and it is worth
  more standing alone than buried under two more tasks built on top of it. Record it,
  record which tasks were therefore not attempted, and stop.
- A task moved to Blocked also stops the range — same reasoning.
- `Blocked by:` on a task is a hard gate. If it names a task that is not Done, move it to
  Blocked and stop; do not attempt its prerequisite out of order.

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

### Docker

**Docker is available as of 2026-09-01.** The daemon is `active`/`enabled` and the user is
in the `docker` group. A shell started before that change does not carry the group and `sg`
is not installed here, so if `docker compose ps` fails with `permission denied`, wrap docker
commands:

```bash
newgrp docker <<'CMD'
  docker compose ps
CMD
```

**Never assert a blocker in prose.** Probe it and quote the real stderr:
```bash
timeout 30 docker compose ps 2>&1 | head -3   # if this works, there is no blocker
```
The human reads the log and nothing else — restating a cleared blocker wastes the one
channel you have.

Tasks 1 and up all touch Docker. There is no longer a "no Docker required" section, because
the split was wrong: task 5 sat in it while its Verify block called `pnpm dev:up`.

### Standing known defects — not covered by any check

Repeat these in every handoff until a task closes them:

- **Anglers must type a raw tournament UUID** into `apps/mobile/src/app/(tabs)/submit.tsx`
  and `leaderboard.tsx`. No harness task covers mobile end to end. See task 17.
- **No web UI creates a catch.** `apps/web/src/actions/catches.ts` exports only
  `verifyCatch`, `aiVerifyCatch`, `deleteCatch`. See task 18.
- **Only one seeded club has any tournaments.** `midwest-bass` owns all 3;
  `carolina-kayak` and `lake-norman-bass` own none. So the cross-club discovery list has
  never actually shown more than one club, and task 17's group-by-club picker has nothing to
  group. See task 4. (The `deletedAt` leak on this route is closed — R5.)
- **The tenant boundary is a header anybody can set.** `packages/api/src` authenticates
  nobody — no Clerk import, no `getAuth`, no `verifyToken` — and nothing checks
  `x-tenant-id` against `tenant_members`. See task 11.
- **RLS is decorative.** `SET LOCAL app.current_tenant_id` exists only in `CLAUDE.md`; no
  code sets it. The app connects as the table owner with `FORCE ROW LEVEL SECURITY` off, so
  policies are bypassed regardless. A bogus tenant id still returns every row. See task 12.
  **Until task 12 lands, CLAUDE.md's Multi-Tenancy section is false — do not rely on a
  database-level tenant check that is not there.**
- **No migrations exist.** Schema has only ever been `db:push`'d. See task 15.

---

## Decisions — settled, do not re-litigate

An agent with fresh context will otherwise re-open these every night.

### 2026-09-02 — Angler discovery is cross-club, and every row is club-attributed
`GET /api/public/tournaments` keeps returning open/active tournaments from **all** clubs.
There is no club-selection wall in the mobile app. In exchange, every tournament the
angler sees — list row, detail screen, and R4's picker — **must carry the club name**,
because two clubs can each run a "Spring Classic" and a bare tournament name is
ambiguous. The endpoint therefore `innerJoin`s `tenants` and returns
`tenantSlug` / `tenantName` / `tenantLogoUrl`.

Rejected: per-club discovery (angler joins a club first). It matches the white-label
positioning more exactly but adds a club-selection flow, club persistence, and a director
invite mechanism, for a product with zero users. Revisit if a real director objects to
appearing beside other clubs.

### 2026-09-02 — The baseline lives on `main`
`claude/restore-green-baseline` was fast-forwarded into `main` and pushed. CI run
`33626804701` is the **first green run** on this repo after 8 consecutive failures —
Type Check, Lint, Test/Scoring Engine and Test/API all pass. `main` is now a trustworthy
starting point; keep it that way.

---

## The queue

Tasks are numbered **1..21** and run **in order**. The number is the handle: *"work tasks
4-8"*. A task's original id (`G1`, `R3`, …) is kept in brackets because the handoff logs
in `docs/nightly/log/` refer to it.

Order is not preference. Each block can only be *proven* once the block above it exists:

| Block | Tasks | Why it comes here |
|---|---|---|
| **Harness** | 1–7 | Nothing below can be shown to work until the machine can run the product and fail loudly. |
| **Subtract** | 8–10 | Delete Phase 7 *after* the harness, so "nothing else broke" is a measurement rather than a hope — and *before* everything below, so the rest is carried over a smaller surface. |
| **Enforce the boundary** | 11–12 | Tenant isolation is currently nominal. Both tasks were found by auditing CLAUDE.md against the database, and both are measured, not asserted. |
| **Substrate** | 13–16 | Types and migrations. The migration gate needs a running database to apply against, which is task 1–2's output. |
| **Product** | 17–19 | The defects that make the app unusable by a human. Each is proven by the harness above. |
| **Close out** | 20–21 | Make the documentation true, then prove the whole thing from an empty database. |

**Dependencies that are real**, not stylistic — an agent that ignores these cannot verify
its own work:

```
1 ──> 2 ──> 3
      └──> 5 (results archive needs `pnpm dev:up`, which task 2 creates)
      └──> 6 ──> 7 ──> 8,9 ──> 10
4,7 ──> 11 ──> 12   (RLS on an unverified header enforces nothing — 11 first)
10 ──> 13, 15 ──> 16
4 ──> 17   (a group-by-club picker needs more than one club seeded)
6 ──> 18 ──> 19 ──> 20
13,18,19 ──> 21
```

### Definition of "n"

`21` is the last task. It ends with a full tournament run from an empty database, by
clicking only. There is **no deployment task** — that was decided against on 2026-09-02
(see Decisions). When 19 is green, the next conversation is about whether this thing
should have a URL.

---

## Block 1 — Harness

### Task 1 — Prove the offline stack runs the product  `[G1]`
**Status: DONE 2026-09-02.** Green on arrival — see the measurement-task carve-out in
the Protocol. The stack serves the product: seed produced 3 tenants / 3 tournaments,
`GET /` returned `{"status":"ok"}`, and the public list contained `Lake Oahe Shootout`.

Goal: establish the docker stack actually serves this application. Note the health
endpoint is `GET /`, not `/api/health`, and nothing starts the API server for you.

Verify:
```bash
source scripts/verify-lib.sh
# --wait must NAME the long-running services. Bare `docker compose up -d --wait`
# exits 1 here: minio-setup is a one-shot `mc` container that exits 0 after creating
# the bucket, and --wait counts any exited dependency as failure. Measured.
# (`grep -q healthy` is also wrong — it matches "unhealthy".)
timeout 300 docker compose up -d --wait postgres redis minio mailpit
timeout 120 pnpm db:push --force             # drizzle-kit prompts on destructive
                                             # diffs and will hang unattended
timeout 120 pnpm db:seed
W=$(workdir)                       # never hardcode /tmp paths: a crashed run leaves
                                   # stale pids and stale backups behind
# `cd x && cmd &` backgrounds the whole AND-list, so $! is the SUBSHELL's pid and the
# trap below would kill the subshell while bun keeps holding :3001. Reproduced twice on
# 2026-09-02; the next run then hit EADDRINUSE and the STALE process answered, which
# already produced one false "fixed" result earlier in that session. Ask the kernel who
# holds the port instead of trusting $!.
( cd packages/api && exec setsid nohup bun run src/index.ts </dev/null >"$W/api.log" 2>&1 & )
timeout 60 bash -c 'until curl -fsS localhost:3001/ >/dev/null 2>&1; do sleep 2; done'
API_PID=$(ss -ltnp 2>/dev/null | grep ':3001 ' | grep -oP 'pid=\K[0-9]+' | head -1)
[ -n "$API_PID" ] || die "nothing is listening on :3001"
trap 'kill "$API_PID" 2>/dev/null; rm -rf "$W"' EXIT
timeout 60 bash -c 'until curl -fsS localhost:3001/ >/dev/null 2>&1; do sleep 2; done'
must_contain_literal "health" "timeout 30 curl -fsS localhost:3001/" '"status":"ok"'
# the seed actually landed:
capture_into ROWS "tournament count" "timeout 30 docker compose exec -T postgres \
  psql -U tf -d tourneyforge -tAc 'select count(*) from tournaments'"
[ "$ROWS" -ge 1 ] || die "seed produced no tournaments"
# ONE joined, ordered query. Two independent `limit 1` queries can pick a tenant with no
# tournaments, or a `draft` one the public endpoint filters out — the assertion then fails
# on a working product and the agent's fix is to weaken it.
capture_into NAME "publicly visible seeded tournament" "timeout 30 docker compose exec -T postgres \
  psql -U tf -d tourneyforge -tAc \"select name from tournaments where status in ('open','active') order by name limit 1\""
must_contain_literal "public list" "timeout 30 curl -fsS localhost:3001/api/public/tournaments" "$NAME"
```
`capture` fails on empty output, so the name assertion can never degrade into
`grep -q ""` matching `{"data":[]}`.

---

### Task 2 — One command from clean checkout to running app  `[G2]`
**Status: DONE 2026-09-02.** `scripts/dev-up.sh`; cold start from a wiped volume, warm
start measured at 2s against the 20s budget, and it fails in 20s on an unreachable
`DATABASE_URL`. Its dead-dependency assertion was replaced (see the block).

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
# A sleeping script cannot notice a dead dependency.
# REPLACED 2026-09-02, approved by the human. The original stopped postgres and required
# dev:up to fail — impossible, because dev:up starts docker services and therefore just
# restarts it (measured: `docker compose up -d --wait postgres` returns 0 and the
# container goes Starting -> Started -> Healthy). Point the app's own connection string
# at a closed port instead: that is a dependency the script cannot auto-heal, and it
# checks the fact that actually predicts whether the API works. A healthy container
# behind an unreachable DATABASE_URL is precisely the state a container-only check
# passes and the product fails on.
# CORRECTION 2026-09-06: an earlier note here claimed `cmd && fail ...` misreports a
# correct failure. That was WRONG, and proved wrong by running it — `set -e` does not
# abort on the left operand of `&&`, so a failing cmd short-circuits to a clean exit and
# `fail` only runs when cmd wrongly succeeds. The pattern is sound. This form is kept
# only because it is explicit and emits a `pass` line on success.
if DATABASE_URL='postgres://tf:tf@127.0.0.1:1/tourneyforge' timeout 180 pnpm dev:up >/dev/null 2>&1
then die "dev:up succeeded with no reachable database — it is not checking health"
else pass "dev:up fails when DATABASE_URL is unreachable"
fi
```
The warm-start timing plus the dead-postgres case are what actually distinguish polling
from `sleep`. Grepping the script for `sleep` does not: `command sleep 30` and
`/bin/sleep 30` both slip past it.

---

### Task 3 — Point the docs at the offline stack  `[G3]`
**Status: DONE 2026-09-02.** README leads with an offline quick-start (no cloud accounts,
service-substitute table, subdomain URLs); `.env.example` redirects to the docker
templates. Verified live: a tenant page rendered the seeded tournament, and the
committed-secret scan is clean.

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
# One joined query: the tenant MUST be the one that owns a publicly visible tournament.
capture_into SLUG "tenant owning a public tournament" "timeout 30 docker compose exec -T postgres \
  psql -U tf -d tourneyforge -tAc \"select n.slug from tenants n join tournaments t on t.tenant_id=n.id where t.status in ('open','active') order by n.slug limit 1\""
capture_into NAME "its tournament" "timeout 30 docker compose exec -T postgres \
  psql -U tf -d tourneyforge -tAc \"select t.name from tournaments t join tenants n on n.id=t.tenant_id where n.slug='\$SLUG' and t.status in ('open','active') order by t.name limit 1\""
must_contain_literal "tenant page renders seeded data" \
  "timeout 60 curl -fsS -H 'Host: ${SLUG}.localhost' localhost:3000/tournaments" "$NAME"
# Value-shaped, not bare prefixes, and excluding this file (which quotes the pattern)
# and the .env.docker templates (whose commented placeholders are the point).
SECRETS=$(git ls-files | grep -vE '^docs/NIGHTLY\.md$|\.env\.docker$' \
  | xargs grep -lE 'sk_live_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{16,}|pk_live_[A-Za-z0-9]{16,}' || true)
[ -z "$SECRETS" ] || die "possible committed secret in: $SECRETS"
```
Guardrail: the marketing page at `/` renders with no database and contains the word
"TourneyForge". Asserting on it proves nothing — assert on a tenant page.

---

### Task 4 — Seed tournaments for more than one club  `[R8]`
**Status: DONE 2026-09-02.** 3 clubs now own an open-or-active tournament. Per-tenant
pinned scoring-format ids; `check-seed.ts` extended with a cross-tenant reference check
and a two-club minimum, both mutation-tested.

Goal: `midwest-bass` owns all three seeded tournaments; `carolina-kayak` and
`lake-norman-bass` own none (verified 2026-09-02 against the docker stack). The mobile
tournaments tab is a cross-club list, so with this seed it is a cross-club list of
exactly one club — the attribution added for the discovery decision is invisible, and
R4's group-by-club picker cannot be told apart from a flat list.

Give at least two clubs an `open` or `active` tournament in `packages/db/src/seed.ts`,
reusing `buildSeedTournaments(now)` so the dates stay clock-derived (see R2). Each new
tournament needs a real `scoringFormatId` belonging to *its own* tenant — do not reuse
midwest-bass's format across tenants; `scripts/check-seed.ts` resolves the reference and
a cross-tenant one is a tenant-scope bug, not a shortcut.

Verify:
```bash
source scripts/verify-lib.sh
timeout 300 bun run scripts/check-seed.ts
# the real assertion — against the running stack, not the source:
# STRENGTHENED 2026-09-02. The line below used to run the query bare and carry the
# comment "MUST be >= 2. Assert on the number; do not eyeball it." — while asserting
# nothing: `psql -tAc "SELECT count(...)"` exits 0 whether the answer is 1 or 2, so the
# block's own instruction was the one thing it did not do. Now captured and tested.
capture_into CLUBS "distinct clubs with a public tournament" \
  "timeout 30 docker compose exec -T postgres psql -U tf -d tourneyforge -tAc \
   \"SELECT count(DISTINCT tr.tenant_id) FROM tournaments tr \
     WHERE tr.status IN ('open','active') AND tr.deleted_at IS NULL\""
[ "$CLUBS" -ge 2 ] || die "only $CLUBS club(s) own a publicly visible tournament"
pass "$CLUBS clubs own a publicly visible tournament"
curl -s localhost:3001/api/public/tournaments \
  | jq -e '[.data[].tenantSlug] | unique | length >= 2'
```
A source grep for a second tenant's name proves nothing — the row has to reach the API.

---

### Task 5 — The results archive seeds empty  `[R7]`
**Status: DONE 2026-09-06.** A completed "Fall Classic" with 3 teams and 9 catches;
`check-seed.ts` deadline rule split per status (completed exempt into a *stricter*
rule, nothing loosened), mutation-tested three ways. Archive renders the podium in
weight order.

Goal: R2 made every seeded `registrationDeadline` fall in the future, which by
construction makes a `completed` tournament unseedable — so the public `/results`
archive, `/[tenant]/results`, has nothing to show. R2's own handoff flagged this and
correctly refused to fix it by editing its own Verify block.

Deliver: seed at least one `completed` tournament with past dates and finished catches,
and split the deadline rule so it applies to open/draft tournaments only.

Verify:
```bash
source scripts/verify-lib.sh
timeout 120 bun run scripts/check-seed.ts        # must be extended, not weakened:
                                                 # every OPEN-or-DRAFT deadline future,
                                                 # AND >=1 completed with past dates
timeout 300 pnpm dev:up
capture_into SLUG "tenant with a completed tournament" "timeout 30 docker compose exec -T postgres \
  psql -U tf -d tourneyforge -tAc \"select n.slug from tenants n join tournaments t on t.tenant_id=n.id where t.status='completed' limit 1\""
must_contain_literal "results archive renders" \
  "timeout 60 curl -fsS -H \"Host: ${SLUG}.localhost\" localhost:3000/results" "Final"
# STRENGTHENED 2026-09-06. "Final" alone is HOLLOW: it is static page furniture —
# `Final standings from all completed {tenant} tournaments` — rendered whether or not a
# single result exists. Once any completed tournament exists it proves only that the page
# returned. Assert the actual podium: capture the winning team from the database and
# require the page to name it.
capture_into WINNER "top team in the completed tournament" \
  "timeout 30 docker compose exec -T postgres psql -U tf -d tourneyforge -tAc \
   \"select tm.name from catches c join teams tm on tm.id=c.team_id \
     join tournaments t on t.id=c.tournament_id \
    where t.status='completed' and c.deleted_at is null \
    group by tm.name order by sum(c.weight::int) desc limit 1\""
must_contain_literal "results archive shows real standings" \
  "timeout 60 curl -fsS -H \"Host: ${SLUG}.localhost\" localhost:3000/results" "$WINNER"
```
Guardrail: extending `check-seed.ts` to express a more precise rule is correct.
Loosening it so a past deadline stops being an error is not.

---

### Task 6 — The web money path, proven through the UI  `[G4a]` **(large)**
**Status: DONE 2026-09-06.** Playwright + chromium installed, `apps/web/e2e/`,
`test:e2e`. Director creates and publishes a tournament, three anglers register, the
director starts it, the leaderboard ranks them — every page reached by clicking.
Mutation-checked: inverting the scoring comparator turns the suite red.
**Found a real bug doing it** — on a tenant subdomain every tournament link 404'd.

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
# REPAIRED 2026-09-06. The original read:
#   kill "$(cat /tmp/api.pid)" 2>/dev/null; (cd packages/api && bun run src/index.ts & echo $! > /tmp/api.pid)
# /tmp/api.pid is created by nothing in this repo — dev-up.sh records .dev/api.pid — so
# under `set -e` the `cat` aborted the block before the mutation was ever tested. The
# same line also captured the SUBSHELL's pid rather than bun's (see task 1) and would
# have raced a second API onto an occupied :3001. (The third thing this note used to
# claim — that `pnpm test:e2e && fail ...` misreports a correct failure — was WRONG.
# Task 7's block was probed with the mutation disabled and correctly exited 1; `set -e`
# does not abort on the left operand of `&&`. The pattern is sound.) The assertion is
# unchanged and is the one that carries this task.
W=$(workdir)
cp packages/scoring/src/index.ts "$W/scoring.bak"
trap 'cp "$W/scoring.bak" packages/scoring/src/index.ts; rm -rf "$W"' EXIT
sed -i 's/b - a/a - b/' packages/scoring/src/index.ts
# Restart through dev:up, which kills nothing it does not own and refuses a foreign port.
for P in 3000 3001; do
  PID=$(ss -ltnp 2>/dev/null | grep ":$P " | grep -oP 'pid=\K[0-9]+' | head -1)
  [ -n "$PID" ] && [ -n "$(readlink /proc/$PID/cwd 2>/dev/null | grep "^$PWD")" ] && kill "$PID"
done
timeout 300 pnpm dev:up
if timeout 900 pnpm test:e2e
then die "inverted the leaderboard comparator and the suite still passed"
else pass "inverting the comparator turns the money-path suite red"
fi
cp "$W/scoring.bak" packages/scoring/src/index.ts
```
Guardrail: register at least three teams whose totals produce an order that is neither
alphabetical nor insertion order, and assert the full ordered list of names *and*
scores. Do not construct a URL from an id: reach every page by clicking. A grep cannot
enforce that — `` page.goto(`/tournaments/${id}`) `` contains no literal UUID — so the
mutation check above is what actually carries this task.

---

### Task 7 — CI runs the harness  `[G5]`
**Status: DONE 2026-09-06 (advisory only).** `Test / E2E Money Path` job added: same
docker-compose and same tracked `.env*.docker` templates a laptop uses, `pnpm dev:up`,
`pnpm test:e2e`, trace + server logs uploaded on failure. Verify exit 0, including the
product-mutation red case. **Still needs the human step below.**

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
changed_files_exclude '(test|spec)'   # by FILENAME. must_not_match on "$(git diff
                                      # --name-only)" greps file CONTENT — '(test|spec)'
                                      # matches the identifier `speciesId`.
timeout 900 pnpm test:e2e && fail "product mutation did not turn the harness red"
cp /tmp/scoring.bak packages/scoring/src/index.ts
```
Guardrail: a job that cannot fail is worthless. Prove red; never assume it.

---

## Block 2 — Subtract

### Task 8 — Delete the public API v1 and the SMS path  **(large)**
**Status: DONE 2026-09-06.** `routes/v1.ts`, `lib/sms.ts`, `routes/notifications.ts`
deleted; mounts, the web action's fire-and-forget call, the `twilio` dependency and
every `TWILIO_*` var removed. Both routes 404 against a restarted server; E2E green.

Goal: `packages/api/src/routes/v1.ts` (211 lines) is an Enterprise-plan API authenticated
by `x-api-key`, with Upstash rate limiting. `packages/api/src/lib/sms.ts` (55) and
`routes/notifications.ts` (102) are the SMS path. **No test touches any of it**, no UI
reaches it, and no user exists to call it. Deleting is settled (see Decisions, 2026-09-02).

Both surfaces are server-only, which is why they are one task: no page, component or
route in `apps/web` imports either.

Deliver: the files removed, the mounts removed from `packages/api/src/index.ts`, any
dependency that becomes unused removed from `packages/api/package.json`, and the env vars
that only fed them removed from `.env.example` and the three `.env*.docker` templates.

Verify:
```bash
source scripts/verify-lib.sh
for f in packages/api/src/routes/v1.ts packages/api/src/lib/sms.ts \
         packages/api/src/routes/notifications.ts; do
  [ ! -e "$f" ] || die "still present: $f"        # NOT `[ -e "$f" ] && die` —
done                                              # under set -e a false test exits 0
must_not_match 'v1Router|notificationRouter' packages/api/src
must_not_match 'sendSms|twilio|TWILIO' packages/api/src apps/web/src
timeout 600 pnpm run check                        # all 9 packages
timeout 600 pnpm run lint
(cd packages/api && timeout 300 bun test)
# Gone from the RUNNING server, not merely from the source tree.
# The API MUST be restarted first: `bun run` has no --watch, so a server started before
# the deletion keeps serving the deleted routes and this check reports 401 instead of
# 404 — a false FAILURE on a correct deletion. Measured 2026-09-06. dev:up cannot tell a
# stale server from a current one; it only knows the port is ours.
PID=$(ss -ltnp 2>/dev/null | grep ':3001 ' | grep -oP 'pid=\K[0-9]+' | head -1)
if [ -n "$PID" ] && readlink "/proc/$PID/cwd" 2>/dev/null | grep -q "^$PWD"; then kill "$PID"; fi
timeout 300 pnpm dev:up
capture_into CODE "GET /api/v1/tournaments" \
  "timeout 30 curl -s -o /dev/null -w '%{http_code}' localhost:3001/api/v1/tournaments"
[ "$CODE" = "404" ] || die "/api/v1 still answers $CODE — the route is still mounted"
timeout 900 pnpm test:e2e                         # the money path still works
```
Guardrail: `pnpm run check` passing is not evidence the deletion was safe — it only proves
nothing *referenced* the deleted code. The E2E run is what proves the product survived.

The original G8 asked for "a smoke check per surface before removing it." That is dropped
deliberately: a test written for code being deleted in the same commit proves nothing about
the deletion, it only proves the code worked before it went. The question that matters is
whether *everything else* survived, and tasks 6 and 7 already built the instrument that
answers it. If the E2E suite is not green before this task starts, do not start it.

---

### Task 9 — Delete AI verification and the marketplace  **(large)**
**Blocked by:** task 7

Goal: the other two Phase 7 surfaces. Unlike task 8 these have web UI, so the deletion
reaches into `apps/web`.

- **AI catch verification** — `packages/api/src/routes/ai.ts` (154),
  `apps/web/src/app/dashboard/tournaments/[id]/catches/AiVerifyButton.tsx` (115), and
  `aiVerifyCatch` + `AiVerifyResult` in `apps/web/src/actions/catches.ts`.
- **Marketplace** — `packages/api/src/routes/marketplace.ts` (132),
  `apps/web/src/app/marketplace/page.tsx` (201),
  `apps/web/src/app/dashboard/marketplace/` (2 files, 294), and the
  `marketplace_sponsors` table in `packages/db/src/schema/marketplace.ts`.

**Sponsors is NOT part of this task and must survive.** `apps/web/src/actions/sponsors.ts`,
`packages/api/src/routes/sponsors.ts` and `apps/web/src/app/dashboard/tournaments/[id]/sponsors/`
are Phase 6, they use the separate `sponsors` table, and the marketplace's own
`marketplaceSponsors` is a different table entirely. Verified 2026-09-02. Deleting sponsors
is out of scope and is a regression.

Deliver: the files above removed, `catches.ts` keeping `verifyCatch` and `deleteCatch`, the
schema table dropped, and any nav link or dashboard card pointing at `/marketplace` removed
so no page 404s.

Verify:
```bash
source scripts/verify-lib.sh
for f in packages/api/src/routes/ai.ts packages/api/src/routes/marketplace.ts \
         packages/db/src/schema/marketplace.ts \
         apps/web/src/app/marketplace/page.tsx \
         'apps/web/src/app/dashboard/tournaments/[id]/catches/AiVerifyButton.tsx'; do
  [ ! -e "$f" ] || die "still present: $f"
done
[ ! -d apps/web/src/app/dashboard/marketplace ] || die "dashboard/marketplace survives"
must_not_match 'aiVerifyCatch|AiVerifyResult|marketplaceSponsors|aiRouter|marketplaceRouter' \
  packages/api/src apps/web/src packages/db/src
# Phase 6 sponsors MUST survive — this task is not allowed to take them with it:
have_file apps/web/src/actions/sponsors.ts
have_file packages/api/src/routes/sponsors.ts
must_match 'export async function verifyCatch' apps/web/src/actions/catches.ts
must_match 'export async function deleteCatch' apps/web/src/actions/catches.ts
timeout 600 pnpm run check && timeout 600 pnpm run lint
# No dangling link: every internal href still resolves. A deleted page reached by a
# surviving nav item is a 404 the typechecker cannot see.
must_not_match '"/marketplace"|href=\{?"/marketplace' apps/web/src
timeout 300 pnpm dev:up && timeout 900 pnpm test:e2e
```

---

### Task 10 — Prove the subtraction was clean
**Blocked by:** tasks 8, 9

Goal: deletions leave orphans, and orphans are invisible to `pnpm run check` — an unused
dependency still installs, a dead env var still gets copied into a template, a dropped
table still sits in a migration, and a doc still promises a feature that is gone. This task
is the sweep, and it exists separately because it is the step that always gets skipped.

Deliver:
- Dependencies that tasks 8 and 9 orphaned removed from every `package.json`, lockfile
  regenerated in the same commit.
- Env vars that only fed the deleted code removed from `.env.example`, `apps/web/.env.local.docker`,
  `packages/api/.env.docker`, `packages/db/.env.docker`.
- `CLAUDE.md` Phase 7 claims removed — the phase list, the "Public API v1, AI catch
  verification (Claude Haiku), marketplace, SMS" line, and the tech-stack rows that only
  existed for them.
- `README.md` likewise.
- The `marketplace_sponsors` table gone from a freshly pushed schema.

Verify:
```bash
source scripts/verify-lib.sh
# Nothing anywhere in TRACKED files still names a deleted surface. git ls-files, not a
# bare grep: node_modules contains the word "marketplace" in unrelated packages.
HITS=$(git ls-files | grep -vE '^docs/(NIGHTLY\.md|nightly/)' \
  | xargs grep -lE 'ANTHROPIC_API_KEY|TWILIO|marketplace|/api/v1|aiVerify' 2>/dev/null || true)
[ -z "$HITS" ] || die "deleted surfaces still referenced in: $HITS"
timeout 300 pnpm install --frozen-lockfile   # lockfile matches the pruned manifests
# The table is actually gone from a real database, not just from the schema source:
timeout 60 docker compose down -v
timeout 300 pnpm dev:up
capture_into T "marketplace_sponsors relation count" "timeout 30 docker compose exec -T postgres \
  psql -U tf -d tourneyforge -tAc \"select count(*) from information_schema.tables \
   where table_name='marketplace_sponsors'\""
[ "$T" = "0" ] || die "marketplace_sponsors still exists in the pushed schema"
timeout 900 pnpm test:e2e
```
Guardrail: `git ls-files | xargs grep` excludes this backlog and the nightly logs, which
legitimately name the deleted things. It must not exclude anything else — widening that
exclusion to make the check pass is the failure mode this task is guarding against.

---

## Block 3 — Enforce the boundary

Found by an audit of CLAUDE.md's claims on 2026-09-02, not by any task. Both were
measured against the running stack; the evidence is quoted inside each task.

### Task 11 — The tenant boundary is an unauthenticated header  **(large)**
**Blocked by:** tasks 4, 7

Goal: **the tenant boundary is a header anybody can set.** Every scoped route in
`packages/api/src/routes/` reads `c.req.header("x-tenant-id")` and trusts it. Measured
2026-09-02:

- `packages/api/src` contains no Clerk import, no `getAuth`, no `verifyToken`, and no
  `Authorization` handling. The API authenticates nobody.
- Nothing anywhere joins `tenant_members` to check the caller belongs to the tenant they
  named.

So `curl -H "x-tenant-id: <any tenant uuid>" localhost:3001/api/catches` reads and writes
that tenant's data. CLAUDE.md describes the current state as a security *fix* — "all
catches and registrations endpoints now require `x-tenant-id` and scope every DB operation
to that tenant" — and it was a real improvement over accepting any `tournamentId`. But
scoping to an attacker-supplied value is not a boundary.

**This task must land before task 12.** RLS keyed off an unverified header enforces
nothing; doing them in the other order produces a system that looks enforced and is not.

Deliver: `packages/api/src/middleware/tenant.ts` — verify the caller's session, resolve
their tenant from `tenant_members`, and put it on the Hono context. Routes read it from
context; no route reads the header for scoping. Under `LOCAL_DEV=true` a fixed dev identity
may be assumed (the web app already does this across 10 files) but the tenant must **still**
be resolved from membership, never from the request.

Verify:
```bash
source scripts/verify-lib.sh
have_file packages/api/src/middleware/tenant.ts
# STRUCTURAL: no route may derive tenant scope from the request any more.
must_not_match 'req\.header\("x-tenant-id"\)' packages/api/src/routes
must_match 'tenantMembers' packages/api/src/middleware/tenant.ts
timeout 600 pnpm run check && (cd packages/api && timeout 300 bun test)
# LIVE, and the only check that matters. Needs two tenants (task 4).
timeout 300 pnpm dev:up
capture_into A "tenant A id" "timeout 30 docker compose exec -T postgres psql -U tf -d tourneyforge -tAc \
  \"select id from tenants order by slug limit 1\""
capture_into B "tenant B id" "timeout 30 docker compose exec -T postgres psql -U tf -d tourneyforge -tAc \
  \"select id from tenants order by slug offset 1 limit 1\""
[ "$A" != "$B" ] || die "only one tenant seeded — task 4 has not run, this cannot be tested"
capture_into CODE "cross-tenant read with a forged header" \
  "timeout 30 curl -s -o /dev/null -w '%{http_code}' -H 'x-tenant-id: $B' localhost:3001/api/registrations"
case "$CODE" in 401|403) pass "forged tenant header rejected ($CODE)" ;;
  *) die "forged x-tenant-id returned $CODE — the header is still trusted" ;; esac
```
Guardrail: returning `200` with an empty array is **not** a pass. An empty result is what a
tenant with no rows looks like; it does not distinguish "denied" from "nothing there". The
check asserts on the status code for that reason.

---

### Task 12 — Make RLS actually enforce  **(large)**
**Blocked by:** task 11 — RLS keyed off an unverified header enforces nothing.

Goal: defense in depth behind task 11. `pgPolicy()` definitions exist on every tenant-scoped
table and RLS is switched on — and **none of it runs.** Measured against the live stack
2026-09-02:

- `SET LOCAL app.current_tenant_id` appears in exactly one file in this repo: `CLAUDE.md`.
  No middleware sets it. `packages/api/src` has zero occurrences of `current_tenant_id`,
  `SET LOCAL` or `set_config`.
- The app connects as `tf`; `tf` owns every table; `relforcerowsecurity` is `f` on all of
  them. **A table owner bypasses RLS.** Proof:
  ```
  set app.current_tenant_id = '00000000-0000-4000-8000-000000000000';
  select count(*) from tournaments;   ->  3
  ```
  A tenant id belonging to nobody returns every row.

**The hazard that makes this task large.** `packages/db/src/index.ts` exports a single
module-level `drizzle()` over a postgres.js pool, shared by the API, the web app's server
actions and every script — and `db.transaction` is called **nowhere in this repo**. That
matters twice over:

- `SET LOCAL` outside a transaction is a no-op. Adding it as-is changes nothing.
- Plain `SET` (no `LOCAL`) on a pooled connection **persists onto that connection** and the
  next request to borrow it inherits the previous tenant's context. That is a cross-tenant
  read introduced by the security fix. Do not do it.

So the deliverable includes changing the db access shape: a per-request transaction (or a
reserved connection) that sets the tenant and runs the request's queries inside it.

Deliver: a non-owner `tf_app` role with the grants the app needs; `FORCE ROW LEVEL SECURITY`
on the tenant-scoped tables; the app's `DATABASE_URL` pointing at `tf_app` while drizzle-kit
and the seed keep the owner; and a `withTenant(tenantId, fn)` helper that opens the
transaction and issues `SET LOCAL`.

Verify:
```bash
source scripts/verify-lib.sh
must_not_match 'SET  *app\.current_tenant_id' packages/api/src   # must be SET LOCAL
must_match 'set_config|SET LOCAL' packages/db/src
timeout 300 pnpm dev:up
# 1. FORCE is on, so even the owner cannot bypass:
capture_into F "tables without FORCE RLS" "timeout 30 docker compose exec -T postgres \
  psql -U tf -d tourneyforge -tAc \"select count(*) from pg_class c join pg_namespace n \
   on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' \
   and c.relrowsecurity and not c.relforcerowsecurity\""
[ "$F" = "0" ] || die "$F RLS tables still let their owner bypass"
# 2. The exact query that returns 3 today MUST return 0:
capture_into R "rows visible under a bogus tenant" "timeout 30 docker compose exec -T postgres \
  psql -U tf -d tourneyforge -tAc \"set app.current_tenant_id = \
   '00000000-0000-4000-8000-000000000000'; select count(*) from tournaments\""
[ "$R" = "0" ] || die "bogus tenant still sees $R tournaments — RLS is not enforcing"
# 3. THE POOLING CHECK. Two sequential requests for different tenants on the same pool.
#    A plain SET would leak tenant A's context into tenant B's request; this catches it.
for i in 1 2 3 4 5 6; do
  timeout 30 curl -fsS localhost:3001/api/public/tournaments > /dev/null
done
must_contain_literal "tenant B still isolated after repeated pooled requests" \
  "timeout 30 curl -fsS localhost:3001/api/public/tournaments" "tenantSlug"
timeout 900 pnpm test:e2e
```
Guardrail: check 2 is the whole task — it is the literal command that returns `3` today,
recorded so the before/after is not a matter of opinion. If the E2E suite goes red because
the app role lacks a grant, **fix the grant**; widening `tf_app` back to ownership, or
pointing the app at `tf` again, retires the task without doing it.

---

## Block 4 — Substrate

### Task 13 — Stop hand-maintaining types that mirror the schema  `[R3]` **(large)**
**Blocked by:** task 10

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
for T in Tenant Tournament ScoringFormat User Theme Team Registration Catch; do
  must_not_match "^export (interface|type) $T\b" packages/types/src
done
must_not_match '"@tourneyforge/db"' packages/types/package.json   # no new cycle
timeout 600 pnpm run check                                        # all 9 packages
```
A grep can never detect drift. The real guard is that the types no longer exist to
drift: nothing to keep in sync.

**Correction to this task's original Verify block (2026-09-02).** The loop read
`for T in Tenant Tournament ScoringFormat User Team Registration Catch`. Checked against
the file: `Team`, `Registration` and `Catch` **are not in `packages/types/src/index.ts`**,
so those three assertions pass without the task doing anything — and `Theme`, which *is* a
schema mirror (`themes` is a system table), was missing from the list and would have
survived the task while it reported success. `Theme` is now in the loop; the three vacuous
names stay as regression guards.

`ApiResponse`, `SubscriptionTier`, `SubscriptionLimits` and `LeaderboardEntry` are **not**
schema mirrors — they are shapes this codebase computes, not tables it stores. Do not
delete them. `LeaderboardEntry` in particular is a scoring-engine output; if it duplicates
a type in `packages/scoring`, that is a separate finding for the handoff, not this task.

---

### Task 14 — `@types/react` is two majors behind the installed React  `[G6]`

Goal: `apps/mobile/package.json` pins `@types/react` at `~18.3.0` while `pnpm.overrides`
in the root forces `react` to `19.2.4`. The types describe a React two majors older than
the React actually installed — every hook signature, every `ReactNode`, every ref type is
being checked against the wrong contract.

`apps/mobile/tsconfig.json` deliberately sets `"types": ["react"]` to stop hoisted
`@types/bun` clashing with React Native's `fetch` overloads (see the 2026-09-01 findings).
So any fix must keep the mobile typecheck green — that pin is load-bearing, not incidental.

Deliver: `@types/react` moved to the 19.x line matching `react@19.2.4`, with the mobile
typecheck still passing.

Verify:
```bash
source scripts/verify-lib.sh
must_not_match '"@types/react": *"[~^]?18' apps/mobile/package.json
# Assert against what is INSTALLED, not what is written — the override is what bites:
capture_into RT "installed react version" \
  "node -p \"require('./node_modules/react/package.json').version\""
capture_into TT "installed @types/react version" \
  "node -p \"require('./node_modules/@types/react/package.json').version\""
[ "${RT%%.*}" = "${TT%%.*}" ] || die "react $RT vs @types/react $TT — majors still differ"
must_match '"types": *\[' apps/mobile/tsconfig.json     # the @types/bun guard survives
timeout 600 pnpm --filter @tourneyforge/mobile run check
timeout 600 pnpm run check
```
Guardrail: bumping the version string and adding a `@ts-expect-error` anywhere in
`apps/mobile` to absorb the fallout is a Protocol violation, not a fix.

---

### Task 15 — Generate the initial migration, and make it the default path  `[G7a]`
**Blocked by:** task 10 — generating before the Phase 7 tables are dropped bakes them in.

Goal: **there are no migrations.** `packages/db/drizzle/` does not exist; the schema has
only ever been `db:push`'d. `drizzle.config.ts` is already correct (`out: "./drizzle"`) and
`db:generate` / `db:migrate` scripts already exist — nobody has ever run them. Today a
schema change is applied by diffing against whatever the database happens to contain, which
works exactly until a database has data somebody wants to keep.

Deliver: an initial migration generated from the current schema and committed, and
`pnpm dev:up` switched from `db:push` to `db:migrate` so the migration path is the one
exercised every day rather than a ceremony nobody runs.

**Sequencing note:** run this *after* tasks 8–10. Generating the initial migration first
would bake `marketplace_sponsors` into it and then need a second migration to drop it.

Verify:
```bash
source scripts/verify-lib.sh
have_dir packages/db/drizzle
capture_into N "migration files" "ls packages/db/drizzle/*.sql | wc -l"
[ "$N" -ge 1 ] || die "no .sql migration was generated"
must_not_match 'db:push' scripts/dev-up.sh          # dev:up now migrates
must_match 'db:migrate' scripts/dev-up.sh
# From genuinely empty — the only state that proves a migration, not a diff:
timeout 60 docker compose down -v
timeout 300 docker compose up -d --wait postgres redis minio mailpit
timeout 120 pnpm db:migrate
timeout 120 pnpm db:seed
capture_into ROWS "tournament count after migrate+seed" "timeout 30 docker compose exec -T postgres \
  psql -U tf -d tourneyforge -tAc 'select count(*) from tournaments'"
[ "$ROWS" -ge 1 ] || die "migrate+seed produced no tournaments"
# The migration and the schema source agree. This is the assertion that matters: a
# migration that applies but drifts from the schema is worse than no migration.
timeout 120 pnpm db:push --force 2>&1 | tee /tmp/push.out
must_not_match 'CREATE TABLE|ALTER TABLE|DROP TABLE' /tmp/push.out
timeout 900 pnpm test:e2e
```
Guardrail: the last check is the real one. If `db:push` against a migrated database still
wants to change something, the migration does not describe the schema and the task is not
done — regenerating until push is a no-op is the work.

---

### Task 16 — A migration gate that can go red  `[G7b]`
**Blocked by:** task 15

Goal: task 15 creates migrations; nothing stops the next schema edit from skipping one.
This is the gate.

**Scope correction to the original G7 text.** G7 asked for a migration that applies *and
rolls back*. `drizzle-kit generate` emits forward-only SQL — there is no `down` file to run,
so "rolls back" cannot be verified as written and a task that demands it would be failed by
an honest agent every night. The achievable, and actually more useful, gate is:

1. a commit touching `packages/db/src/schema/` must contain a new file under
   `packages/db/drizzle/`, and
2. every migration applies in order from an empty database, and
3. after applying them, `db:push` is a no-op (no drift).

Whether to hand-write `down` migrations is a real question, but it is a **decision, not a
task** — leave it in Open Questions below rather than inventing an answer here.

Deliver: a CI job enforcing 1–3 on every PR, against the docker postgres.

Verify:
```bash
source scripts/verify-lib.sh
must_match 'drizzle|migrat' .github/workflows/ci.yml
must_not_match 'continue-on-error|if: false|if: \$\{\{ false \}\}' .github/workflows/ci.yml
# Prove the gate can go RED. A gate that has never failed is not known to work.
W=$(workdir); trap 'git checkout -- packages/db/src/schema/ 2>/dev/null; rm -rf "$W"' EXIT
cat >> packages/db/src/schema/tenants.ts <<'MUT'
// migration-gate mutation probe
MUT
printf '\nexport const gateProbe = { x: 1 };\n' >> packages/db/src/schema/tenants.ts
bash scripts/check-migrations.sh && die "schema changed with no new migration and the gate passed"
git checkout -- packages/db/src/schema/
bash scripts/check-migrations.sh || die "gate is red on a clean tree — it cannot be trusted"
```
Guardrail: the mutation probe must change the schema **directory**, since that is what the
gate keys on. Appending a comment to an unrelated file proves nothing.

---

## Block 5 — Product

### Task 17 — Kill the UUID entry in the mobile app  `[R4]` **(large)**
**Blocked by:** task 4 — with one seeded club a grouped picker is indistinguishable from a flat one.

Goal: the defect this whole harness exists for. An angler in a boat cannot type
`22222222-2222-4222-8222-222222222222`. `submit.tsx` demands a tournament UUID;
`leaderboard.tsx` demands one too.

Deliver: a tournament picker on both screens, plus a jest-expo test runner
(`apps/mobile` currently has no `test` script, no jest config, no
`@testing-library/react-native` — standing that up is part of this task).

**The picker groups by club and shows the club name on every option.** Discovery is
cross-club (see Decisions, 2026-09-02) and `GET /api/public/tournaments` already returns
`tenantSlug` / `tenantName` / `tenantLogoUrl` for exactly this purpose. A flat list of
bare tournament names is not an acceptable outcome of this task.

**Do R8 first, or this task cannot be verified.** With one seeded club there is nothing
to group and a grouped picker is indistinguishable from a flat one.

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

### Task 18 — An angler can submit a catch on the web  `[G4b]` **(large)**
**Blocked by:** task 6

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

### Task 19 — A tournament can be finished, and the archive proves it
**Blocked by:** task 18

Goal: task 6 proves the money path up to a ranked leaderboard. It stops there. A
tournament that can never be *finished* has no results, which is why the public
`/results` archive exists and why task 5 had to seed a completed tournament by hand.
This task closes the loop through the UI.

Deliver: the E2E suite extended so a director takes one tournament from `draft` to
`completed` by clicking — open registration, run it, close it, publish results — and the
public `/[tenant]/results` page then shows that tournament with its final standings.

Verify:
```bash
source scripts/verify-lib.sh
must_not_match 'page\.route|context\.route|routeFromHAR|\.fulfill\(|test\.skip|test\.fixme|describe\.skip|expect\.soft' apps/web/e2e
must_not_match 'retries' apps/web/playwright.config.ts
timeout 300 pnpm dev:up && timeout 900 pnpm test:e2e
# The status transition happened through the UI, not through a fixture INSERT. Assert the
# row moved, and that no seeded tournament was already `completed` when the test began.
must_not_match "status: *'completed'|status: *\"completed\"" apps/web/e2e
```
Guardrail: the archive assertion must name the tournament the test itself created and
assert its final standings in order — not merely that `/results` returns 200. A page that
renders "No results yet" is also a 200. Reach the archive by clicking from the tenant
homepage; do not navigate to a constructed `/results` URL.

---

## Block 6 — Close out

### Task 20 — Make the documentation true again
**Blocked by:** task 19

Goal: the documentation has been wrong at every checkpoint of this project — SDK 52 vs 55
in the same file, a `packages/api/Dockerfile` cited in a gotcha that has never existed,
"all 7 phases complete" asserted while CI was red eight runs deep, "28 tests" counted as a
win while 20 of them failed. Tasks 8–10 have just deleted a whole phase. Every claim needs
re-checking against the thing that is actually true.

Deliver: `CLAUDE.md` and `README.md` describing this repo as it is after tasks 1–19 — the
phase list, the tech-stack table, the gotchas, the "Known Gaps" section, and the test
counts.

Verify:
```bash
source scripts/verify-lib.sh
# Assert against package.json and the filesystem — NEVER against the other document.
# R1 passed by comparing the two root docs to each other while apps/mobile/README.md
# still said SDK 52.
capture_into EXPO "installed expo version" \
  "node -p \"require('./apps/mobile/package.json').dependencies.expo\""
for d in README.md CLAUDE.md apps/mobile/README.md; do
  [ ! -e "$d" ] || must_not_match 'SDK 5[0-4]\b' "$d"
done
# Every gotcha that names a path must name a path that exists:
grep -oE '`[a-z0-9_./-]+\.(ts|tsx|js|json|toml|yml)`' CLAUDE.md | tr -d '`' | sort -u \
  | while read -r p; do [ -e "$p" ] || die "CLAUDE.md cites a path that does not exist: $p"; done
# Phase 7 is gone from the code, so it must be gone from the docs:
must_not_match 'marketplace|AI catch verification|SMS|Public API v1' CLAUDE.md README.md
# Test counts are asserted, not claimed:
capture_into SC "scoring test count" "(cd packages/scoring && bun test 2>&1 | grep -oE '[0-9]+ pass' | head -1)"
capture_into AC "api test count" "(cd packages/api && bun test 2>&1 | grep -oE '[0-9]+ pass' | head -1)"
echo "scoring: $SC   api: $AC — these numbers must appear in CLAUDE.md or not be stated at all"
timeout 600 pnpm run check && timeout 600 pnpm run lint
```
Guardrail: the honest move when a number is hard to keep current is to **delete the claim**,
not to update it. A doc that does not state a test count cannot be wrong about one.

---

### Task 21 — A whole tournament from an empty database  **(large)**
**Blocked by:** tasks 15, 18, 19

Goal: the capstone, and the only task that answers the original question — *can a machine
establish that this product works?* Everything above proves a piece against seeded
fixtures. This proves the whole thing against **nothing at all**.

Deliver: one test that starts from an empty database — no `db:seed`, no fixtures — and
drives a complete tournament through the browser: a director signs up, creates a club,
creates a tournament, opens registration; an angler registers a team; catches are submitted
through the web UI (task 18); the leaderboard ranks them correctly; the director completes
the tournament; the public results archive shows the final standings.

Deliberately in scope: **no `db:seed`.** If the product only works on seeded data, it does
not work.

Verify:
```bash
source scripts/verify-lib.sh
have_file apps/web/e2e/full-tournament.spec.ts
script_exists apps/web test:e2e:cold
must_not_match 'db:seed|dbSeed' apps/web/e2e/full-tournament.spec.ts
timeout 60 docker compose down -v
timeout 300 docker compose up -d --wait postgres redis minio mailpit
timeout 120 pnpm db:migrate                      # migrate only. NO seed.
capture_into ROWS "tournaments before the test" "timeout 30 docker compose exec -T postgres \
  psql -U tf -d tourneyforge -tAc 'select count(*) from tournaments'"
[ "$ROWS" = "0" ] || die "database is not empty — this test must build its own world"
timeout 1200 pnpm test:e2e:cold
capture_into AFTER "tournaments after the test" "timeout 30 docker compose exec -T postgres \
  psql -U tf -d tourneyforge -tAc \"select count(*) from tournaments where status='completed'\""
[ "$AFTER" -ge 1 ] || die "the test did not complete a tournament"
# The mutation check. Invert the leaderboard comparator; this suite MUST go red.
cp packages/scoring/src/index.ts "$(workdir)/scoring.bak" 2>/dev/null || true
cp packages/scoring/src/index.ts /tmp/scoring.bak
trap 'cp /tmp/scoring.bak packages/scoring/src/index.ts' EXIT
sed -i 's/b - a/a - b/' packages/scoring/src/index.ts
timeout 300 pnpm dev:up
timeout 1200 pnpm test:e2e:cold && fail "inverted the comparator and the cold suite still passed"
cp /tmp/scoring.bak packages/scoring/src/index.ts
```
Guardrail: every step reached by clicking. No constructed URLs, no ids typed into inputs,
no direct database writes between browser steps. If the test needs to know a UUID to
proceed, a human would have needed to know it too — and that is the bug this whole harness
was built to catch.

---

## Open Questions — decisions, not tasks

Do not resolve these in an unattended run. Raise them in the handoff and let a human answer.

- **Down migrations.** `drizzle-kit generate` is forward-only. Task 14's gate deliberately
  does not require rollback because it cannot be verified as specified. Whether to
  hand-write `down` SQL, rely on restore-from-backup, or accept forward-only is unanswered.
- **Does red block the morning merge?** The harness is worthless as a referee if a red run
  can be merged past. Task 7 delivers an *advisory* job; making it a required status check
  needs repo-admin rights and is a human act.
- **The shelf life of "no users."** Deployment is deliberately absent from tasks 1–19
  (decided 2026-09-02). That decision is correct today and becomes wrong silently. Set a
  date to revisit it, or it becomes permanent by default.
- **Phase 7 is being deleted, not archived.** Tasks 8–10 remove the marketplace, the v1
  API, AI verification and SMS. The git history keeps them; nothing else will.

---

## Blocked

_(move tasks here with the reason they stopped and what would unblock them)_

---

## Done

- **R5 — Soft-deleted tournaments were publicly visible; discovery is now
  club-attributed.** `GET /api/public/tournaments`, `/tournaments/:id` and
  `/tenants/:slug/tournaments` now filter `isNull(tournaments.deletedAt)`, and the two
  cross-club routes `innerJoin` `tenants` to return `tenantSlug` / `tenantName` /
  `tenantLogoUrl`. Mobile list and detail screens render the club.
  **Correction to this task's original text:** it claimed the same omission existed in
  `GET /api/public/teams`. It does not — the `teams` table has no `deletedAt` column
  (`packages/db/src/schema/teams-catches.ts:8`); soft deletes landed on catches,
  tournaments, scoringFormats, sponsors and tournamentDivisions only. Writing
  `isNull(teams.deletedAt)` would not typecheck. `packages/api/test/public.test.ts` now
  pins that asymmetry so nobody "fixes" it by symmetry.
  Proven against the docker stack, not just asserted: with the pre-fix code a
  soft-deleted tournament still appeared in the list and its detail route returned
  **200**; with the fix it disappears and returns **404**. Both new unit tests were
  mutation-checked (strip the `isNull`, strip the `innerJoin` — each turns one red),
  because the mocked db ignores WHERE clauses and a naive "row is absent" assertion
  would pass with the filter deleted.

- **R6 — Tenant routing never worked.** `bd71194`. `resolveTenant()` read
  `req.nextUrl.hostname`, which is the server's *bind address*, not the request host.
  The dev script runs `next dev --hostname 0.0.0.0`, so a probe showed
  `hostname:"0.0.0.0"` against `host:"midwest-bass.localhost"` — every `.localhost` and
  `.{rootDomain}` comparison fell through, the rewrite never fired, and every tenant page
  404'd. The Redis custom-domain lookup was dead for the same reason. Now reads
  `x-forwarded-host` then `Host`. Verified live against the seeded stack: subdomain root
  renders "Midwest Bass Trail", `/tournaments` lists both public tournaments, a second
  tenant is isolated, and plain `localhost` still serves marketing. Found while closing
  R2's self-reported hollow spot.
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
- **R2 — Seed data must not expire.** `1bd9069`. Dates now derived from `Date.now()`;
  every tournament gets a real `scoringFormatId`; `scripts/check-seed.ts` asserts values
  (not spelling) and was proven non-hollow against five mutations. Seed verified against
  live Postgres afterwards: 3 tournaments, 0 FK violations, and the registration page
  returns HTTP 200 with a real form where it previously 404'd. **Correction:** an earlier
  note in tonight's log called the register page "STILL BROKEN" — that was a stale
  `next-server` squatting on :3000 while the app had moved to :3002. R2's fix was correct.
- **R1 — Make the documentation true.** `090a856`, completed `a86d24b`. Expo SDK 52→55
  (6 places incl. `apps/mobile/README.md`, which the original check did not look at),
  Next.js 15→16, RN 0.83.0→0.83.2, a gotcha citing a `packages/api/Dockerfile` that does
  not exist, a stale `pnpm@9.15.4` CI comment, and "all 7 phases complete" asserted while
  CI was red eight runs deep. **Correction:** R1 was first reported done while still
  listed in Ready, and its checks compared the two root docs to each other rather than to
  `package.json` — so it passed while `apps/mobile/README.md` still said SDK 52. Both the
  green-on-arrival rule and the assert-truth-not-consistency rule in the Protocol exist
  because of this task.
