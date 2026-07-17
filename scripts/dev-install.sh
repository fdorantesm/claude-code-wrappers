#!/usr/bin/env bash
set -euo pipefail

readonly repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly install_dir="${INSTALL_DIR:-$HOME/.local/bin}"

log() { printf '[dev-install] %s\n' "$*" >&2; }

# Build
"$repo_dir/scripts/build.sh"

# Detect binary
target_os="$(uname -s | tr '[:upper:]' '[:lower:]')"
target_arch="$(uname -m)"
[[ "$target_os" == "darwin"* ]] && target_os="darwin"
[[ "$target_arch" == "aarch64" ]] && target_arch="arm64"
binary="$repo_dir/dist/cw-${target_os}-${target_arch}"

[[ -f "$binary" ]] || { log "ERROR: binary not found: $binary"; exit 1; }

# Install
mkdir -p "$install_dir"
cp "$binary" "$install_dir/cw"
chmod +x "$install_dir/cw"

log "✓ installed to $install_dir/cw"
"$install_dir/cw" --version 2>/dev/null || true
