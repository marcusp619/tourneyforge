#!/usr/bin/env bash
# Assertion helpers for docs/NIGHTLY.md Verify blocks.
#
# Hand-rolled greps in acceptance criteria fail open in at least three ways, all
# of which were found in this repo's own backlog by adversarial review:
#
#   grep -r PAT missing/dir     -> exit 2, and `! grep` turns that into a PASS
#   grep -q "$(cmd-that-failed)" -> grep -q "" matches ANY input
#   ! grep PAT file             -> a grep ERROR (binary, unreadable) reads as clean
#
# Every helper below treats "could not check" as failure, never as success.
# Source it and use it; do not hand-roll a grep in a Verify block.
#
#   source scripts/verify-lib.sh

set -euo pipefail

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
pass() { printf 'ok: %s\n' "$*"; }

have_file() { [ -f "$1" ] || fail "expected file to exist: $1"; pass "exists: $1"; }
have_dir()  { [ -d "$1" ] || fail "expected directory to exist: $1"; pass "exists: $1"; }

# must_match PATTERN PATH... — pattern must appear. Missing path = failure.
must_match() {
  local pat=$1; shift
  local p; for p in "$@"; do [ -e "$p" ] || fail "cannot check /$pat/: path missing: $p"; done
  grep -rqE "$pat" "$@" || fail "expected /$pat/ in: $*"
  pass "found /$pat/"
}

# must_not_match PATTERN PATH... — pattern must be absent. Missing path or grep
# error = failure, NOT a pass. This is the helper that fixes `! grep`.
must_not_match() {
  local pat=$1; shift
  local p; for p in "$@"; do [ -e "$p" ] || fail "cannot check /$pat/: path missing: $p"; done
  local rc=0; grep -rqE "$pat" "$@" || rc=$?
  case $rc in
    0) fail "forbidden pattern /$pat/ present in: $*" ;;
    1) pass "absent: /$pat/" ;;
    *) fail "grep errored (rc=$rc) scanning: $* — cannot verify, treating as failure" ;;
  esac
}

# capture DESC COMMAND — run a command whose output a later check depends on.
# Empty output is a hard failure, so no check can degrade into grep -q "".
capture() {
  local desc=$1 cmd=$2 out
  out=$(eval "$cmd") || fail "capture failed ($desc): $cmd"
  [ -n "$out" ] || fail "capture empty ($desc) — a later check would match anything: $cmd"
  printf '%s' "$out"
}

# must_contain_literal DESC HAYSTACK_CMD NEEDLE — fixed-string, non-empty needle.
must_contain_literal() {
  local desc=$1 hay=$2 needle=$3
  [ -n "$needle" ] || fail "empty needle ($desc) — would match anything"
  eval "$hay" | grep -qF -- "$needle" || fail "$desc: expected literal '$needle'"
  pass "$desc contains '$needle'"
}

# script_exists PKG SCRIPT — a task must not depend on an unwritten npm script.
script_exists() {
  local pkg=$1 script=$2
  node -e "const s=require('./$pkg/package.json').scripts||{};process.exit(s['$script']?0:1)" \
    || fail "$pkg/package.json has no \"$script\" script — the task that creates it has not run"
  pass "$pkg has script: $script"
}

# tool_exists BIN — fail loudly rather than silently skipping a check.
tool_exists() { command -v "$1" >/dev/null 2>&1 || fail "required tool not installed: $1"; pass "tool: $1"; }
