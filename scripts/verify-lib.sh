#!/usr/bin/env bash
# Assertion helpers for docs/NIGHTLY.md Verify blocks.
#
# Hand-rolled greps in acceptance criteria fail open. Three adversarial reviews of this
# repo's own backlog found these, all live at some point:
#
#   grep -r PAT missing/dir      -> exit 2, and `! grep` turns that into a PASS
#   grep -q "$(cmd-that-failed)" -> grep -q "" matches ANY input
#   ! grep PAT file              -> a grep ERROR (binary, unreadable) reads as clean
#   grep -r PAT   (no path!)     -> scans the whole tree; passes on an unrelated file
#   grep -rqE "-i" file          -> the pattern is parsed as a grep OPTION
#   must_not_match PAT emptydir/ -> vacuous pass; `mkdir` satisfies the check
#   grep '(test|spec)' "$(git diff --name-only)" -> greps CONTENT, matches "speciesId"
#
# Every helper treats "could not check" as failure. Source it; do not hand-roll a grep.
#
#   source scripts/verify-lib.sh

set -euo pipefail

fail() { printf 'FAIL: %s\n' "$*" >&2; return 1; }
pass() { printf 'ok: %s\n' "$*"; }
die()  { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

have_file() { [ -f "$1" ] || die "expected file to exist: $1"; pass "exists: $1"; }
have_dir()  { [ -d "$1" ] || die "expected directory to exist: $1"; pass "exists: $1"; }

# Shared preflight: at least one path, every path exists, and any directory given
# actually contains a regular file (an empty dir must never satisfy an absence check).
_paths_ok() {
  local what=$1; shift
  [ "$#" -ge 1 ] || die "$what: no path arguments given — grep would scan the entire tree"
  local p
  for p in "$@"; do
    case $p in -*) die "$what: path may not begin with '-': $p" ;; esac
    [ -e "$p" ] || die "$what: path missing: $p"
    if [ -d "$p" ] && [ -z "$(find "$p" -type f -print -quit 2>/dev/null)" ]; then
      die "$what: directory is empty, nothing to check: $p"
    fi
  done
}

# must_match PATTERN PATH... — pattern must appear.
must_match() {
  local pat=$1; shift
  _paths_ok "must_match /$pat/" "$@"
  grep -rqE -- "$pat" "$@" || die "expected /$pat/ in: $*"
  pass "found /$pat/"
}

# must_not_match PATTERN PATH... — pattern must be absent. Missing path, empty dir, or
# grep error is a failure, never a pass.
must_not_match() {
  local pat=$1; shift
  _paths_ok "must_not_match /$pat/" "$@"
  local rc=0; grep -rqE -- "$pat" "$@" || rc=$?
  case $rc in
    0) die "forbidden pattern /$pat/ present in: $*" ;;
    1) pass "absent: /$pat/" ;;
    *) die "grep errored (rc=$rc) scanning: $* — cannot verify, treating as failure" ;;
  esac
}

# capture_into VAR DESC COMMAND — assign a command's output to VAR in the CALLER's
# shell. Use this, not `X=$(capture ...)`: inside $( ) a failure can only exit the
# subshell, so the caller silently continues with an empty value unless `set -e`
# happens to be on. Empty output is a hard failure.
capture_into() {
  local __var=$1 desc=$2 cmd=$3 __out
  __out=$(eval "$cmd") || die "capture failed ($desc): $cmd"
  [ -n "$__out" ] || die "capture empty ($desc) — a later check would match anything: $cmd"
  printf -v "$__var" '%s' "$__out"
}

# must_contain_literal DESC HAYSTACK_CMD NEEDLE — fixed-string, non-empty needle.
# The haystack is buffered to a file first: piping into `grep -q` kills the producer
# with SIGPIPE, and this library's own `set -o pipefail` would report that as failure
# on a passing product.
must_contain_literal() {
  local desc=$1 hay=$2 needle=$3 t
  [ -n "$needle" ] || die "empty needle ($desc) — would match anything"
  t=$(mktemp)
  eval "$hay" > "$t" 2>/dev/null || { rm -f "$t"; die "$desc: haystack command failed: $hay"; }
  if grep -qF -- "$needle" "$t"; then rm -f "$t"; pass "$desc contains '$needle'"
  else rm -f "$t"; die "$desc: expected literal '$needle'"; fi
}

# changed_files_exclude PATTERN — assert no CHANGED FILE NAME matches PATTERN.
# `must_not_match PAT "$(git diff --name-only)"` is wrong twice: it greps file
# CONTENT (so '(test|spec)' matches the identifier `speciesId`), and multiple files
# collapse into one newline-joined argument that is not a path.
changed_files_exclude() {
  local pat=$1 hits
  hits=$(git diff --name-only | grep -E -- "$pat" || true)
  [ -z "$hits" ] || die "changed files match forbidden /$pat/: $(echo "$hits" | tr '\n' ' ')"
  pass "no changed file matches /$pat/"
}

# script_exists PKG SCRIPT — a task must not depend on an unwritten npm script.
script_exists() {
  local pkg=$1 script=$2
  node -e "const s=require('./$pkg/package.json').scripts||{};process.exit(s['$script']?0:1)" \
    || die "$pkg/package.json has no \"$script\" script — the task that creates it has not run"
  pass "$pkg has script: $script"
}

tool_exists() { command -v "$1" >/dev/null 2>&1 || die "required tool not installed: $1"; pass "tool: $1"; }

# workdir — a per-run temp dir. Never hardcode /tmp/foo: a crashed previous run leaves
# stale pids and stale backups, and `git worktree add /tmp/verify` fails the second time.
workdir() { mktemp -d "${TMPDIR:-/tmp}/tf-verify.XXXXXX"; }
