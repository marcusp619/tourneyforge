#!/usr/bin/env bash
# dev-up.sh — clean checkout (or warm tree) to a running app, then RETURN.
#
# Idempotent. On a warm tree where everything is already answering, it re-checks
# real health and returns in a couple of seconds; it never sleeps a fixed interval.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)

API_PORT=${API_PORT:-3001}
WEB_PORT=${WEB_PORT:-3000}
RUN_DIR=${RUN_DIR:-.dev}
mkdir -p "$RUN_DIR"

log() { printf '  %s\n' "$*"; }
die() { printf 'dev:up FAILED: %s\n' "$*" >&2; exit 1; }

# Poll a condition until it holds. Never `sleep N` and hope: every wait here is a
# poll with a deadline, which is what makes a warm start fast and a broken
# dependency loud instead of slow.
wait_for() {
  local desc=$1 deadline=$2 cmd=$3 start
  start=$(date +%s)
  until eval "$cmd" >/dev/null 2>&1; do
    [ $(( $(date +%s) - start )) -lt "$deadline" ] || die "timed out after ${deadline}s waiting for $desc"
    sleep 1
  done
}

listening() { timeout 2 bash -c "</dev/tcp/127.0.0.1/$1" 2>/dev/null; }

# WHO holds the port, not merely whether something does.
#
# "Port occupied" is not "our server is running". Measured on 2026-09-06: another
# project on this machine (a different Next app, a different Next version) was serving
# :3000, and because this script only checked that the port answered, it skipped
# starting web, printed "Ready  Web http://localhost:3000" and handed every downstream
# check a foreign application to assert against. Every tenant route 404'd and it looked
# exactly like a regression in this repo.
port_owner_pid() {
  ss -ltnp 2>/dev/null | grep ":$1 " | grep -oP 'pid=\K[0-9]+' | head -1
}
port_is_ours() {
  local pid cwd
  pid=$(port_owner_pid "$1"); [ -n "$pid" ] || return 1
  cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null) || return 1
  case "$cwd" in "$ROOT"|"$ROOT"/*) return 0 ;; *) return 1 ;; esac
}

# ---------------------------------------------------------------- services
# --wait must NAME the long-running services: minio-setup is a one-shot `mc`
# container that exits 0, and --wait counts an exited dependency as failure.
log "docker services..."
timeout 300 docker compose up -d --wait postgres redis minio mailpit \
  || die "docker compose could not bring up postgres redis minio mailpit"

# Health of the DATABASE, not merely of the container. A running postgres that
# is still recovering will accept a TCP connection and refuse queries.
wait_for "postgres to accept queries" 60 \
  "docker compose exec -T postgres pg_isready -U tf -d tourneyforge"
wait_for "redis" 30 "docker compose exec -T redis redis-cli ping"

# ...and reachable AT DATABASE_URL, which is a different fact. The two checks above ask
# Docker whether the container is well; this asks whether the string the app actually
# connects with resolves to a database that answers. A healthy container behind a wrong
# or unreachable DATABASE_URL is exactly the state that looks fine here and fails at the
# first request.
if [ -z "${DATABASE_URL:-}" ] && [ -f packages/api/.env ]; then
  DATABASE_URL=$(grep -h "^DATABASE_URL=" packages/api/.env | head -1 | cut -d= -f2- | tr -d "\"'")
  export DATABASE_URL
fi
[ -n "${DATABASE_URL:-}" ] || die "DATABASE_URL is unset and packages/api/.env does not define it"
wait_for "database reachable at DATABASE_URL" 20 "bun run \"$ROOT/scripts/db-ping.ts\""
log "services healthy"

# ---------------------------------------------------------------- schema + seed
# Only when the schema is actually absent. Re-pushing on every warm start is what
# would put a warm start over its budget.
TABLES=$(docker compose exec -T postgres psql -U tf -d tourneyforge -tAc \
  "select count(*) from information_schema.tables where table_schema='public'" 2>/dev/null || echo 0)
if [ "${TABLES:-0}" -lt 1 ]; then
  log "pushing schema..."
  timeout 300 pnpm db:push --force >/dev/null || die "db:push failed"
  log "seeding..."
  timeout 300 pnpm db:seed >/dev/null || die "db:seed failed"
else
  log "schema present ($TABLES tables), skipping push/seed"
fi

# ---------------------------------------------------------------- servers
start_bg() { # start_bg NAME PORT DIR CMD...
  local name=$1 port=$2 dir=$3; shift 3
  if listening "$port"; then
    if port_is_ours "$port"; then log "$name already on :$port"; return 0; fi
    local pid cwd
    pid=$(port_owner_pid "$port"); cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null || echo "?")
    die ":$port is held by pid $pid from a DIFFERENT project ($cwd).
       Starting $name here would be skipped and every check would then assert against
       that application instead of this one. Stop it, or re-run with ${name^^}_PORT set:
         ${name^^}_PORT=3100 pnpm dev:up"
  fi
  local logf="$ROOT/$RUN_DIR/$name.log"
  log "starting $name..."
  # Absolute log path: the `cd` happens in the backgrounded subshell, so a relative
  # path here resolves against the CALLER's cwd, not $dir.
  # </dev/null and both streams redirected: a child that inherits this script's stdout
  # holds the write end of any pipe we are in, and `pnpm dev:up | tail` then never
  # returns even though every server is up. Measured — that is why this script hung.
  # Pass the port THROUGH to the server. Both `next dev` and the Hono/Bun entrypoint
  # read PORT; without this, overriding WEB_PORT only moved the port this script waits
  # on while the server still bound 3000 — the override the failure message suggests
  # would have timed out instead of working.
  ( cd "$dir" && PORT="$port" exec setsid nohup "$@" </dev/null >"$logf" 2>&1 & ) 
  wait_for "$name on :$port" 120 "timeout 2 bash -c '</dev/tcp/127.0.0.1/$port'"
  # $! would be setsid's pid, not the server's. Ask the kernel who actually holds the port.
  ss -ltnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K[0-9]+' | head -1 \
    > "$ROOT/$RUN_DIR/$name.pid" || true
}
start_bg api "$API_PORT" packages/api bun run src/index.ts
start_bg web "$WEB_PORT" apps/web pnpm run dev

# The API answering is not the same as the API working: assert the health payload.
wait_for "api health" 60 "curl -fsS localhost:$API_PORT/ | grep -q '\"status\":\"ok\"'"

printf '\nReady.\n'
printf '  Web  http://localhost:%s\n' "$WEB_PORT"
printf '  API  http://localhost:%s\n' "$API_PORT"
printf '  Logs %s/{api,web}.log\n\n' "$RUN_DIR"
