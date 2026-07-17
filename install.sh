#!/usr/bin/env bash
# install.sh — installs `cw` (claude-code-wrappers) globally.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/fdorantesm/claude-code-wrappers/main/install.sh | bash
#   curl -fsSL ... | CW_VERSION=v1.2.3 bash
#   curl -fsSL ... | bash -s -- --uninstall
#   curl -fsSL ... | bash -s -- --prefix ~/.local
#
# Resolution order:
#   1. Download the prebuilt standalone binary from the GitHub Release.
#   2. If no release has been published yet for this tag, fall back to
#      `git clone` at the tag + `bun build --compile` (requires git + bun).
#   3. Verify SHA-256 when checksums.txt is available.
#
# Uninstall mode removes the binary and any claude-<provider> symlinks
# pointing at it. Config in ~/.config/claude-wrappers/ is preserved.

set -euo pipefail

readonly REPO="${CW_REPO:-fdorantesm/claude-code-wrappers}"
readonly BINARY_NAME="cw"
readonly CHECKSUMS_FILE="checksums.txt"

log()  { printf '[install] %s\n' "$*" >&2; }
err()  { printf '[install] ERROR: %s\n' "$*" >&2; }
die()  { err "$@"; exit 1; }

# ─────────────────────────────── platform ─────────────────────────────────────
detect_target() {
  local os arch
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"

  case "$os" in
    linux*)  os="linux" ;;
    darwin*) os="darwin" ;;
    mingw*|msys*|cygwin*) os="windows" ;;
    *) die "Unsupported OS: $os" ;;
  esac

  case "$arch" in
    x86_64|amd64)   arch="x64" ;;
    aarch64|arm64)  arch="arm64" ;;
    i386|i686)      arch="x86" ;;
    *) die "Unsupported architecture: $arch" ;;
  esac

  echo "${os}-${arch}"
}

# ─────────────────────────────── install dir ──────────────────────────────────
resolve_install_dir() {
  local prefix="${CW_INSTALL_PREFIX:-}"
  if [[ -n "$prefix" ]]; then
    echo "$prefix"
    return
  fi

  case "$(uname -s | tr '[:upper:]' '[:lower:]')" in
    linux*|darwin*)
      for dir in "$HOME/.local/bin" "$HOME/bin" "/usr/local/bin"; do
        if [[ -d "$dir" ]] && [[ -w "$dir" ]]; then
          echo "$dir"
          return
        fi
      done
      mkdir -p "$HOME/.local/bin"
      echo "$HOME/.local/bin"
      ;;
    mingw*|msys*|cygwin*)
      local user_bin="$HOME/bin"
      mkdir -p "$user_bin"
      echo "$user_bin"
      ;;
    *) die "Unsupported OS for auto install dir" ;;
  esac
}

# ─────────────────────────────── HTTP helpers ──────────────────────────────────
http_get() {
  # http_get <url> — prints body to stdout. Returns non-zero on HTTP error.
  if command -v curl >/dev/null 2>&1; then
    curl --silent --fail --location --show-error "$1"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- "$1"
  else
    die "curl or wget is required"
  fi
}

http_download() {
  # http_download <url> <out> — true if the file was downloaded, false if 404.
  if command -v curl >/dev/null 2>&1; then
    curl --silent --fail --location --show-error "$1" -o "$2"
  else
    wget --quiet -O "$2" "$1"
  fi
}

# ─────────────────────────────── version ──────────────────────────────────────
get_latest_version() {
  # Try in order:
  #   1. /releases/latest  (preferred — fast, has metadata)
  #   2. /tags              (works once a tag exists, even before release)
  #   3. git ls-remote      (final fallback; requires git)
  local tag

  # 1. Latest published release
  tag="$(http_get "https://api.github.com/repos/${REPO}/releases/latest" \
         | grep '"tag_name":' | sed -E 's/.*"v?([^"]+)".*/\1/' || true)"

  # 2. Most recent v* tag
  if [[ -z "$tag" ]]; then
    tag="$(http_get "https://api.github.com/repos/${REPO}/tags?per_page=100" \
           | grep -E '"name":[[:space:]]*"v' | head -1 \
           | sed -E 's/.*"v?([^"]+)".*/\1/' || true)"
  fi

  # 3. git ls-remote as last resort
  if [[ -z "$tag" ]] && command -v git >/dev/null 2>&1; then
    tag="$(git ls-remote --tags --sort=-v:refname "https://github.com/${REPO}.git" 2>/dev/null \
           | grep -E 'refs/tags/v[0-9]' | head -1 \
           | sed -E 's/.*refs/tags/v?([^[:space:]]+).*/\1/' || true)"
  fi

  [[ -n "$tag" ]] || die "Could not fetch latest version (no release, no tags, no git)"
  echo "$tag"
}

# ─────────────────────────────── checksum ─────────────────────────────────────
verify_checksum() {
  local file="$1" expected="$2"
  local actual
  if command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "$file" | awk '{print $1}')"
  elif command -v sha256sum >/dev/null 2>&1; then
    actual="$(sha256sum "$file" | awk '{print $1}')"
  else
    err "no sha256 tool found; skipping verification"
    return 0
  fi
  [[ "$actual" == "$expected" ]] || die "checksum mismatch: expected $expected, got $actual"
}

# ─────────────────────────────── install strategies ───────────────────────────
download_release_binary() {
  # download_release_binary <tag> <binary_name> <out_path> — true on success.
  local tag="$1" binary_name="$2" out_path="$3"
  local url="https://github.com/${REPO}/releases/download/${tag}/${binary_name}"
  if http_download "$url" "$out_path"; then
    return 0
  fi
  return 1
}

download_checksums() {
  # download_checksums <tag> <binary_name> — echoes the expected sha, or empty.
  local tag="$1" binary_name="$2"
  local tmpdir="$3"
  local url="https://github.com/${REPO}/releases/download/${tag}/${CHECKSUMS_FILE}"
  if http_download "$url" "$tmpdir/$CHECKSUMS_FILE"; then
    grep "  ${binary_name}\$" "$tmpdir/$CHECKSUMS_FILE" 2>/dev/null \
      | head -1 | awk '{print $1}' || true
  fi
}

build_from_source() {
  # build_from_source <tag> <target> <out_path> — true on success.
  # Requires git + bun. Compiles src/bin/cw.ts at the given tag.
  local tag="$1" target="$2" out_path="$3"
  local tmpdir="$4"
  command -v git >/dev/null 2>&1  || { err "git is required for source builds"; return 1; }
  command -v bun >/dev/null 2>&1  || { err "bun is required for source builds"; return 1; }

  log "cloning ${REPO}@${tag} (shallow)"
  if ! (cd "$tmpdir" && git clone --depth 1 --branch "$tag" --quiet \
         "https://github.com/${REPO}.git" src); then
    err "git clone failed"
    return 1
  fi

  log "running bun install"
  if ! (cd "$tmpdir/src" && bun install --frozen-lockfile); then
    err "bun install failed"
    return 1
  fi

  log "compiling with bun build --target=bun-${target}"
  if ! (cd "$tmpdir/src" && bun build --compile \
         --target="bun-${target}" \
         --outfile "$out_path" \
         src/bin/cw.ts); then
    err "bun build failed"
    return 1
  fi

  chmod +x "$out_path"
  return 0
}

# ─────────────────────────────── install ──────────────────────────────────────
do_install() {
  local target version tag install_dir tmpdir
  target="$(detect_target)"
  version="${CW_VERSION:-$(get_latest_version)}"
  tag="v${version#v}"

  log "target: $target"
  log "version: $version"

  local ext=""
  [[ "$target" == windows-* ]] && ext=".exe"
  local binary_name="${BINARY_NAME}-${target}${ext}"
  local install_name="${BINARY_NAME}${ext}"

  install_dir="$(resolve_install_dir)"
  log "install dir: $install_dir"

  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' EXIT

  local binary_path="$tmpdir/$binary_name"
  local used_source_build=false

  # Strategy 1: download prebuilt binary from the release.
  log "trying release: $tag/$binary_name"
  if download_release_binary "$tag" "$binary_name" "$binary_path"; then
    log "downloaded prebuilt binary"
    # Optional: verify checksum if the release ships checksums.txt
    local expected
    expected="$(download_checksums "$tag" "$binary_name" "$tmpdir" || true)"
    if [[ -n "$expected" ]]; then
      log "verifying SHA-256"
      verify_checksum "$binary_path" "$expected"
    fi
  else
    # Strategy 2: build from source at the tag.
    log "no prebuilt binary for $tag; falling back to source build"
    if ! build_from_source "$tag" "$target" "$binary_path" "$tmpdir"; then
      die "failed to obtain a $binary_name (tried release download + source build)"
    fi
    used_source_build=true
    log "built from source"
  fi

  log "installing"
  if [[ -w "$install_dir" ]]; then
    mv "$binary_path" "$install_dir/$install_name"
    chmod +x "$install_dir/$install_name"
  else
    sudo mv "$binary_path" "$install_dir/$install_name"
    sudo chmod +x "$install_dir/$install_name"
  fi

  log ""
  log "✓ ${BINARY_NAME} ${version} installed to ${install_dir}/${install_name}"
  if [[ "$used_source_build" == true ]]; then
    log "  (built from source — set up a release workflow to ship prebuilt binaries next time)"
  fi
  log ""
  if ! command -v cw >/dev/null 2>&1; then
    log "NOTE: ${install_dir} is not on your PATH. Add it:"
    log "  export PATH=\"${install_dir}:\$PATH\""
    log ""
  fi
  log "Next: run \`cw install\` to create provider symlinks and homes."
}

# ─────────────────────────────── uninstall ────────────────────────────────────
do_uninstall() {
  local install_dir
  install_dir="$(resolve_install_dir)"
  local ext=""
  [[ "$(uname -s | tr '[:upper:]' '[:lower:]')" == mingw* ]] && ext=".exe"
  local bin="$install_dir/${BINARY_NAME}${ext}"

  [[ -f "$bin" ]] && {
    if [[ -w "$install_dir" ]]; then rm -f "$bin"; else sudo rm -f "$bin"; fi
    log "removed $bin"
  }

  # Remove all claude-<provider> symlinks that point to cw
  for link in "$install_dir"/claude-*; do
    [[ -L "$link" ]] || continue
    local target
    target="$(readlink "$link" 2>/dev/null || true)"
    if [[ "$(basename "$target")" == "cw" ]] || [[ "$(basename "$target")" == "cw.exe" ]]; then
      if [[ -w "$install_dir" ]]; then rm -f "$link"; else sudo rm -f "$link"; fi
      log "removed $link"
    fi
  done

  log "✓ uninstalled (config in ~/.config/claude-wrappers/ was preserved)"
  log "  Run 'rm -rf ~/.config/claude-wrappers/' to also purge config."
}

# ─────────────────────────────── main ─────────────────────────────────────────
case "${1:-}" in
  --uninstall|-u) do_uninstall ;;
  --help|-h)
    sed -n '2,28p' "$0"
    ;;
  *) do_install ;;
esac