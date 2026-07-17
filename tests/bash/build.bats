#!/usr/bin/env bats
#
# tests/bash/build.bats — Tests for scripts/build.sh
#
# Requires: bats-core, esbuild installed (npx esbuild)

setup() {
  BATS_TEST_DIRNAME="$(cd "$(dirname "$BATS_TEST_FILENAME")" && pwd)"
  REPO_ROOT="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
  BUILD_SH="$REPO_ROOT/scripts/build.sh"
  TMP="$(mktemp -d)"
  export TMP
  export HOME="$TMP/fake-home"
  mkdir -p "$HOME"

  # Stage a minimal source tree so esbuild has something to bundle
  export STAGE="$TMP/stage"
  mkdir -p "$STAGE/src/bin"
  cat > "$STAGE/src/bin/cw.ts" <<'EOF'
#!/usr/bin/env node
export function main() {
  console.log("cw stub");
}
main();
EOF
  mkdir -p "$STAGE/dist"
  cat > "$STAGE/package.json" <<'EOF'
{ "name": "cw-stage", "version": "9.9.9" }
EOF
}

teardown() {
  rm -rf "$TMP"
}

# ─────────────────────────────── bundle generation ────────────────────────────
@test "build.sh: produces cw.js bundle" {
  if ! command -v npx >/dev/null 2>&1; then
    skip "npx not available"
  fi

  cd "$STAGE"
  # Symlink repo files into stage
  ln -s "$REPO_ROOT/scripts" scripts

  run env VERSION="9.9.9" TARGET_OS="linux" TARGET_ARCH="x64" \
    bash "$BUILD_SH"

  [ "$status" -eq 0 ]
  [ -f "$STAGE/dist/cw-linux-x64/cw.js" ]
}

@test "build.sh: generates Unix shim" {
  if ! command -v npx >/dev/null 2>&1; then
    skip "npx not available"
  fi

  cd "$STAGE"
  ln -s "$REPO_ROOT/scripts" scripts
  run env VERSION="9.9.9" TARGET_OS="linux" TARGET_ARCH="x64" \
    bash "$BUILD_SH"
  [ "$status" -eq 0 ]
  [ -f "$STAGE/dist/cw-linux-x64/bin/cw" ]
  [ -x "$STAGE/dist/cw-linux-x64/bin/cw" ]
}

@test "build.sh: generates Windows .cmd shim" {
  if ! command -v npx >/dev/null 2>&1; then
    skip "npx not available"
  fi

  cd "$STAGE"
  ln -s "$REPO_ROOT/scripts" scripts
  run env VERSION="9.9.9" TARGET_OS="windows" TARGET_ARCH="x64" \
    bash "$BUILD_SH"
  [ "$status" -eq 0 ]
  [ -f "$STAGE/dist/cw-windows-x64/bin/cw.cmd" ]
}

@test "build.sh: generates PowerShell shim" {
  if ! command -v npx >/dev/null 2>&1; then
    skip "npx not available"
  fi

  cd "$STAGE"
  ln -s "$REPO_ROOT/scripts" scripts
  run env VERSION="9.9.9" TARGET_OS="darwin" TARGET_ARCH="arm64" \
    bash "$BUILD_SH"
  [ "$status" -eq 0 ]
  [ -f "$STAGE/dist/cw-darwin-arm64/bin/cw.ps1" ]
}

@test "build.sh: writes package.json with version" {
  if ! command -v npx >/dev/null 2>&1; then
    skip "npx not available"
  fi

  cd "$STAGE"
  ln -s "$REPO_ROOT/scripts" scripts
  run env VERSION="1.2.3" TARGET_OS="linux" TARGET_ARCH="x64" \
    bash "$BUILD_SH"
  [ "$status" -eq 0 ]

  pkg="$STAGE/dist/cw-linux-x64/package.json"
  [ -f "$pkg" ]

  version="$(node -e "console.log(require('$pkg').version)")"
  [ "$version" = "1.2.3" ]
}

@test "build.sh: creates .tar.gz archive" {
  if ! command -v npx >/dev/null 2>&1; then
    skip "npx not available"
  fi

  cd "$STAGE"
  ln -s "$REPO_ROOT/scripts" scripts
  run env VERSION="1.2.3" TARGET_OS="linux" TARGET_ARCH="x64" \
    bash "$BUILD_SH"
  [ "$status" -eq 0 ]
  [ -f "$STAGE/dist/cw-linux-x64.tar.gz" ]

  # Verify the archive contains the expected files
  run tar -tzf "$STAGE/dist/cw-linux-x64.tar.gz"
  [ "$status" -eq 0 ]
  [[ "$output" == *"cw.js"* ]]
  [[ "$output" == *"bin/cw"* ]]
  [[ "$output" == *"package.json"* ]]
}

@test "build.sh: bundling includes shebang in cw.js" {
  if ! command -v npx >/dev/null 2>&1; then
    skip "npx not available"
  fi

  cd "$STAGE"
  ln -s "$REPO_ROOT/scripts" scripts
  run env VERSION="1.2.3" TARGET_OS="linux" TARGET_ARCH="x64" \
    bash "$BUILD_SH"
  [ "$status" -eq 0 ]

  head -n 1 "$STAGE/dist/cw-linux-x64/cw.js" | grep -q "^#!/usr/bin/env node"
}