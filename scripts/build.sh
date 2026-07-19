#!/usr/bin/env bash
# scripts/build.sh — compiles cw.ts into a standalone binary per target.
#
# Usage:
#   ./scripts/build.sh                          # current OS/arch
#   TARGET_OS=darwin TARGET_ARCH=arm64 ./scripts/build.sh
#   VERSION=1.2.3 ./scripts/build.sh
#
# Output:
#   dist/cw-<os>-<arch>[.exe]                   # single-file standalone binary

set -euo pipefail

readonly repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly dist_dir="$repo_dir/dist"
readonly version="${VERSION:-$(cat "$repo_dir/VERSION" 2>/dev/null || echo "0.0.0-dev")}"

# Short build ID: git short hash + timestamp
git_hash="$(git -C "$repo_dir" rev-parse --short HEAD 2>/dev/null || echo "unknown")"
build_ts="$(date -u +%Y%m%d%H%M)"
build_id="${git_hash}-${build_ts}"

log() { printf '[build] %s\n' "$*" >&2; }
die() { printf '[build] ERROR: %s\n' "$*" >&2; exit 1; }

# ─────────────────────────────── target ───────────────────────────────────────
target_os="${TARGET_OS:-$(uname -s | tr '[:upper:]' '[:lower:]')}"
case "$target_os" in
  linux*)                     target_os="linux" ;;
  darwin*)                    target_os="darwin" ;;
  windows|mingw*|msys*|cygwin*) target_os="windows" ;;
  *) die "Unsupported OS: $target_os" ;;
esac

target_arch="${TARGET_ARCH:-$(uname -m)}"
case "$target_arch" in
  x86_64|amd64|x64)   target_arch="x64" ;;
  aarch64|arm64)      target_arch="arm64" ;;
  *) die "Unsupported arch: $target_arch" ;;
esac

target="${target_os}-${target_arch}"
ext=""
[[ "$target_os" == "windows" ]] && ext=".exe"

# ─────────────────────────────── preconditions ───────────────────────────────
command -v bun >/dev/null 2>&1 || die "bun is required: https://bun.sh"

mkdir -p "$dist_dir"

# ─────────────────────────────── compile ─────────────────────────────────────
binary="$dist_dir/cw-${target}${ext}"
log "compiling cw v${version} (${build_id}) → ${binary}"
log "  target: bun-${target_os}-${target_arch}"
log "  entrypoint: $repo_dir/src/bin/cw.ts"

# bun build --compile produces a single-file standalone binary.
# No Node, no Bun runtime needed on the target machine.
bun build \
  --compile \
  --target="bun-${target_os}-${target_arch}" \
  --define="CW_VERSION=\"${version}\"" \
  --define="CW_BUILD_ID=\"${build_id}\"" \
  --outfile="$binary" \
  "$repo_dir/src/bin/cw.ts"

chmod +x "$binary"

size="$(du -h "$binary" | cut -f1)"
log "✓ done: $binary ($size)"

# ─────────────────────────────── version check ───────────────────────────────
# Smoke: run --version with CW_VERSION set
version_output="$("$binary" --version 2>/dev/null || echo "cw --version failed")"
log "smoke: $version_output"

log "next: ./scripts/build.sh --all   # build all 6 targets (use release.yml)"