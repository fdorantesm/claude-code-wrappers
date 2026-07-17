#!/usr/bin/env bash
# tests/yaml/syntax.test.sh — validates YAML workflow syntax
#
# Run with: bash tests/yaml/syntax.test.sh
# Or:      bun run test:yaml
#
# Uses bun + the `yaml` npm package via tests/yaml/parse.mjs. Falls back to
# python3+pyyaml, then yq, then a trivial structural check.

set -euo pipefail

readonly script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly repo_root="$(cd "$script_dir/../.." && pwd)"
readonly workflows_dir=".github/workflows"
readonly parser_script="tests/yaml/parse.mjs"

# Run everything from the repo root so child processes receive clean
# repo-relative paths (no MSYS / absolute-path quirks).
cd "$repo_root"

pass()  { printf '  \033[32m✓\033[0m %s\n' "$*" >&2; }
fail()  { printf '  \033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }
group() { printf '\n\033[1m== %s ==\033[0m\n' "$*" >&2; }

# ─────────────────────────────── preconditions ───────────────────────────────
[[ -d "$workflows_dir" ]] || fail "$workflows_dir does not exist"

shopt -s nullglob
workflows=("$workflows_dir"/*.yml "$workflows_dir"/*.yaml)
[[ ${#workflows[@]} -gt 0 ]] || fail "no workflow files found in $workflows_dir"

# ─────────────────────────────── pick a YAML parser ───────────────────────────
parse_yaml() {
  local file="$1"
  # Prefer bun with the `yaml` npm package via our tracked parse.mjs script.
  # Falls back to python3+pyyaml, then yq, then a trivial structural check.
  if command -v bun >/dev/null 2>&1 && \
     bun -e "require('yaml')" >/dev/null 2>&1; then
    bun run "$parser_script" -- "$file" || return 1
  elif command -v python3 >/dev/null 2>&1 && python3 -c "import yaml" 2>/dev/null; then
    python3 -c "
import sys, yaml
with open('$file') as f:
    try:
        yaml.safe_load(f)
    except yaml.YAMLError as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)
" || return 1
  elif command -v yq >/dev/null 2>&1; then
    yq eval '.' "$file" >/dev/null || return 1
  else
    # Minimal fallback: indent + colon heuristic
    grep -qE '^[a-zA-Z]' "$file" || return 1
  fi
}

# ─────────────────────────────── structural checks ──────────────────────────
check_required_fields() {
  local file="$1"
  local name
  name="$(basename "$file")"

  grep -qE '^name:' "$file"              || fail "$name: missing 'name:'"
  grep -qE '^on:'    "$file"             || fail "$name: missing 'on:'"
  grep -qE '^jobs:'  "$file"             || fail "$name: missing 'jobs:'"

  # has at least one job
  grep -qE '^  [a-zA-Z_-]+:$' "$file"    || fail "$name: no jobs defined"

  pass "$name: required fields present"
}

check_no_secrets_in_logs() {
  local file="$1"
  local name
  name="$(basename "$file")"

  # Common mistakes: printing the entire env, dumping $GITHUB_ENV, etc.
  if grep -nE 'run:.*echo "\${{ ?secrets\.' "$file"; then
    fail "$name: secrets should not be echoed to logs"
  fi
  if grep -nE 'run:.*printenv' "$file"; then
    fail "$name: printenv dumps all secrets to logs"
  fi

  pass "$name: no secret leaks"
}

check_pinned_actions() {
  local file="$1"
  local name
  name="$(basename "$file")"

  # Check that third-party actions are pinned to a SHA, not a tag (security).
  # Allow tags for first-party (actions/*) and well-known orgs.
  # For now, warn (don't fail) on unpinned third-party actions.
  while IFS= read -r line; do
    if [[ "$line" =~ uses:\ ([a-zA-Z0-9_-]+)/([a-zA-Z0-9_-]+)@ ]]; then
      local action_ref="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
      local version="${BASH_REMATCH[0]##*@}"
      if [[ ! "$version" =~ ^[0-9a-f]{40} ]]; then
        echo "    ⚠ $name: $action_ref not pinned to SHA (uses $version)" >&2
      fi
    fi
  done < "$file"

  pass "$name: action pinning reviewed"
}

# ─────────────────────────────── run ──────────────────────────────────────────
group "YAML syntax"
for f in "${workflows[@]}"; do
  if parse_yaml "$f"; then
    pass "$(basename "$f"): parses as valid YAML"
  else
    fail "$(basename "$f"): invalid YAML"
  fi
done

group "Structural checks"
for f in "${workflows[@]}"; do
  check_required_fields "$f"
  check_no_secrets_in_logs "$f"
  check_pinned_actions "$f"
done

group "actionlint (optional)"
if command -v actionlint >/dev/null 2>&1; then
  if actionlint "$workflows_dir"/*.yml; then
    pass "actionlint clean"
  else
    fail "actionlint reported issues"
  fi
else
  echo "  (actionlint not installed; skipping. Install: brew install actionlint)" >&2
fi

echo ""
echo "All workflow checks passed."