#!/usr/bin/env bats
#
# tests/bash/install.bats — Tests for install.sh
#
# Run with:
#   bats tests/bash/install.bats
#
# Requires: bats-core (https://github.com/bats-core/bats-core)

setup() {
  BATS_TEST_DIRNAME="$(cd "$(dirname "$BATS_TEST_FILENAME")" && pwd)"
  REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
  INSTALL_SH="$REPO_ROOT/install.sh"
  TMP="$(mktemp -d)"
  export TMP
  export HOME="$TMP/fake-home"
  mkdir -p "$HOME"
}

teardown() {
  rm -rf "$TMP"
}

# ─────────────────────────────── help ────────────────────────────────────────
@test "install.sh --help prints usage" {
  run "$INSTALL_SH" --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "install.sh -h prints usage" {
  run "$INSTALL_SH" -h
  [ "$status" -eq 0 ]
  [[ "$output" == *"Usage:"* ]]
}

# ─────────────────────────────── target detection ────────────────────────────
@test "detect_target: linux x86_64" {
  run bash -c "source '$INSTALL_SH' --detection-only 2>/dev/null; detect_target" 2>/dev/null || true
  # detect_target is not exported; instead test by stubbing uname
  run env -i PATH="/usr/bin:/bin" bash -c '
    uname() {
      case "$1" in
        -s) echo "Linux" ;;
        -m) echo "x86_64" ;;
      esac
    }
    export -f uname
    source "'"$INSTALL_SH"'" 2>/dev/null || true
    # detect_target runs in subshell; use a direct extraction instead
    sed -n "/^detect_target/,/^}/p" "'"$INSTALL_SH"'" | tail -n +2 | head -n -1 | bash
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"linux-x64"* ]]
}

@test "detect_target: darwin arm64 (macOS Apple Silicon)" {
  run env -i PATH="/usr/bin:/bin" bash -c '
    uname() {
      case "$1" in
        -s) echo "Darwin" ;;
        -m) echo "arm64" ;;
      esac
    }
    export -f uname
    sed -n "/^detect_target/,/^}/p" "'"$INSTALL_SH"'" | tail -n +2 | head -n -1 | bash
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"darwin-arm64"* ]]
}

@test "detect_target: linux aarch64" {
  run env -i PATH="/usr/bin:/bin" bash -c '
    uname() {
      case "$1" in
        -s) echo "Linux" ;;
        -m) echo "aarch64" ;;
      esac
    }
    export -f uname
    sed -n "/^detect_target/,/^}/p" "'"$INSTALL_SH"'" | tail -n +2 | head -n -1 | bash
  '
  [ "$status" -eq 0 ]
  [[ "$output" == *"linux-arm64"* ]]
}

# ─────────────────────────────── install dir resolution ──────────────────────
@test "resolve_install_dir: respects CW_INSTALL_PREFIX" {
  run env -i HOME="$HOME" CW_INSTALL_PREFIX="$TMP/custom-bin" bash -c '
    sed -n "/^resolve_install_dir/,/^}/p" "'"$INSTALL_SH"'" | tail -n +2 | head -n -1 | bash
  '
  [ "$status" -eq 0 ]
  [ "$output" = "$TMP/custom-bin" ]
}

@test "resolve_install_dir: creates ~/.local/bin if none exists" {
  run env -i HOME="$HOME" bash -c '
    sed -n "/^resolve_install_dir/,/^}/p" "'"$INSTALL_SH"'" | tail -n +2 | head -n -1 | bash
  '
  [ "$status" -eq 0 ]
  [ "$output" = "$HOME/.local/bin" ]
  [ -d "$HOME/.local/bin" ]
}

# ─────────────────────────────── node version check ──────────────────────────
@test "ensure_node: fails when node is missing" {
  run env -i PATH="/nonexistent" HOME="$HOME" bash -c '
    sed -n "/^ensure_node/,/^}/p" "'"$INSTALL_SH"'" | tail -n +2 | head -n -1 | bash
  '
  [ "$status" -ne 0 ]
  [[ "$output" == *"Node"* ]]
}

@test "ensure_node: passes when node >= 20 is present" {
  if ! command -v node >/dev/null 2>&1; then
    skip "node not installed"
  fi
  run env -i PATH="$(dirname "$(command -v node)")" HOME="$HOME" bash -c '
    sed -n "/^ensure_node/,/^}/p" "'"$INSTALL_SH"'" | tail -n +2 | head -n -1 | bash
  '
  [ "$status" -eq 0 ]
}

# ─────────────────────────────── checksum verification ──────────────────────
@test "verify_checksum: rejects mismatched hash" {
  run env -i bash -c '
    sed -n "/^verify_checksum/,/^}/p" "'"$INSTALL_SH"'" | tail -n +2 | head -n -1 | bash | bash -s -- "'"$INSTALL_SH"'" "0000000000000000000000000000000000000000000000000000000000000000"
  ' 2>&1 || true
  # Source verify_checksum and call it directly
  fake_file="$TMP/file.txt"
  echo "hello" > "$fake_file"
  run bash -c '
    source <(sed -n "/^verify_checksum/,/^}/p" "'"$INSTALL_SH"'" | head -n -1)
    verify_checksum "'"$fake_file"'" "0000000000000000000000000000000000000000000000000000000000000000"
  '
  [ "$status" -ne 0 ]
  [[ "$output" == *"checksum mismatch"* ]]
}

@test "verify_checksum: accepts correct sha256" {
  fake_file="$TMP/file.txt"
  echo "hello" > "$fake_file"
  expected="$(sha256sum "$fake_file" | awk '{print $1}')"
  run bash -c '
    source <(sed -n "/^verify_checksum/,/^}/p" "'"$INSTALL_SH"'" | head -n -1)
    verify_checksum "'"$fake_file"'" "'"$expected"'"
  '
  [ "$status" -eq 0 ]
}

# ─────────────────────────────── uninstall ───────────────────────────────────
@test "install.sh --uninstall removes binary and lib dir" {
  # Setup: fake install
  fake_install_dir="$HOME/.local/bin"
  mkdir -p "$fake_install_dir" "$HOME/lib/cw-linux-x64"
  echo "fake binary" > "$fake_install_dir/cw"
  chmod +x "$fake_install_dir/cw"
  echo "fake payload" > "$HOME/lib/cw-linux-x64/cw.js"

  run env -i PATH="/usr/bin:/bin" HOME="$HOME" bash "$INSTALL_SH" --uninstall
  [ "$status" -eq 0 ]
  [ ! -f "$fake_install_dir/cw" ]
  [ ! -d "$HOME/lib/cw-linux-x64" ]
}

# ─────────────────────────────── integration: full install ───────────────────
@test "integration: install.sh installs cw into a mocked release" {
  skip "requires network access to GitHub releases; enable manually"

  # This test would:
  # 1. Mock GitHub API to return a known tag
  # 2. Mock the tarball URL to serve a fixture
  # 3. Run install.sh
  # 4. Assert cw binary is in $HOME/.local/bin and is executable
}