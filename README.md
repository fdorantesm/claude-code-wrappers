# `cw` — claude-code-wrappers

> Use [Claude Code](https://claude.com/code) with multiple backends (Anthropic, AWS Bedrock, GCP Vertex, Azure Foundry, OpenCode, OpenRouter, LiteLLM, Ollama, …) from a single CLI. Per-provider env isolation, shared login session, type-safe provider definitions.

---

## Install

### One-liner (recommended)

```sh
curl -fsSL https://raw.githubusercontent.com/fdorantesm/claude-code-wrappers/main/install.sh | bash
```

Pin a version:

```sh
curl -fsSL https://raw.githubusercontent.com/fdorantesm/claude-code-wrappers/main/install.sh | CW_VERSION=v1.2.3 bash
```

Custom prefix:

```sh
CW_INSTALL_PREFIX=$HOME/bin curl -fsSL .../install.sh | bash
```

The installer:

1. Detects your OS/arch.
2. Verifies `bun` ≥ 1.2 is present (required by the `cw` binary at runtime).
3. Downloads the standalone binary + SHA-256 checksum for your target.
4. Installs `cw` to `~/.local/bin/cw` (Unix) or `~/bin/cw.cmd` (Windows).
5. Falls back to `sudo` if the install dir isn't writable.

Verify:

```sh
cw --version
```

### From source

```sh
git clone https://github.com/fdorantesm/claude-code-wrappers
cd claude-code-wrappers
bun install
bun run build
./dist/cw-$(uname -s | tr A-Z a-z)-$(uname -m | sed 's/x86_64/x64/;s/aarch64/arm64/') --version
```

---

## Quick start

```sh
# 1. Initialize ~/.config/claude-wrappers/
cw init

# 2. Configure your first provider (interactive)
cw add minimax
# → Enter endpoint, token, models

# 3. Use it
claude-minimax --print "hello"

# 4. Configure a second provider
cw add bedrock
# → Asks for AWS profile, region, ARNs

# 5. List & diagnose
cw list
cw doctor

# 6. Re-generate after changing .env
cw reset minimax
```

---

## Providers

### Builtin

| ID           | Backend                        | Credential mode | Notes                               |
| ------------ | ------------------------------ | --------------- | ----------------------------------- |
| `anthropic`  | Anthropic API direct           | anthropic-token | Default                             |
| `bedrock`    | AWS Bedrock                    | bedrock         | ARNs, SSO refresh pre-exec          |
| `vertex`     | Google Vertex AI               | vertex          | Service account, regional endpoints |
| `foundry`    | Azure AI Foundry               | foundry         | Azure AD or API key                 |
| `opencode`   | OpenCode Zen                   | anthropic-token | Token rotation pre-exec             |
| `openrouter` | OpenRouter                     | anthropic-token | Multi-provider router               |
| `litellm`    | LiteLLM (self-hosted)          | anthropic-token | Local proxy                         |
| `ollama`     | Ollama local daemon            | ollama-native   | No auth, native `/v1/messages`      |
| `minimax`    | MiniMax (Anthropic-compatible) | anthropic-token | Regional provider                   |

### Multiple instances of the same provider

You can have multiple configurations of the same provider (e.g., work vs personal Bedrock):

```sh
# Create a clone
cw add bedrock --as bedrock-work

# Configure the clone
# → Edit ~/.config/claude-wrappers/env/bedrock-work.env with your values

# Install
cw install --provider bedrock-work

# Use it
claude-bedrock-work --print "hello"

# Rename a provider
cw rename bedrock-work bedrock-personal
```

Clones are saved in `~/.config/claude-wrappers/cw.json`:

```json
{
  "clones": {
    "bedrock-work": { "extends": "bedrock" },
    "bedrock-personal": { "extends": "bedrock", "label": "Bedrock Personal" }
  }
}
```

---

## Configuration

Config lives at `~/.config/claude-wrappers/`:

```
~/.config/claude-wrappers/
├── cw.json                        # main config (providers, clones, plugins)
├── env/
│   ├── minimax.env                # per-provider env vars
│   └── bedrock.env
├── homes/
│   ├── minimax/.claude/
│   │   ├── settings.json          # generated from preset + .env
│   │   ├── .credentials.json → ~/.claude/.credentials.json
│   │   ├── CLAUDE.md → ~/.claude/CLAUDE.md
│   │   ├── agents/ → ~/.claude/agents/
│   │   ├── commands/ → ~/.claude/commands/
│   │   └── skills/ → ~/.claude/skills/
│   └── bedrock/.claude/...
└── providers/                     # drop-in providers (auto-discovered)
    └── mycorp.ts
```

### `cw.json`

```json
{
  "providers": ["minimax", "bedrock", "ollama"],
  "clones": {
    "bedrock-work": { "extends": "bedrock" }
  },
  "plugins": [{ "name": "claude-wrappers-provider-mycorp", "enabled": true }],
  "defaults": {
    "sandbox": false,
    "logLevel": "info"
  }
}
```

### `.env` (per-provider)

```sh
# MiniMax
MINIMAX_BASE_URL=https://api.minimax.chat/v1
MINIMAX_TOKEN=sk-...
MINIMAX_DEFAULT_MODEL=MiniMax-M3

# Bedrock
AWS_PROFILE=my-sso-profile
AWS_REGION=us-east-1
BEDROCK_SONNET_MODEL_ARN=arn:aws:bedrock:us-east-1:123:inference-profile/...
BEDROCK_HAIKU_MODEL_ARN=arn:aws:bedrock:us-east-1:123:inference-profile/...
```

---

## Commands

| Command                         | Purpose                                                 |
| ------------------------------- | ------------------------------------------------------- |
| `cw init`                       | First-time setup: creates config dir, `.env`, `cw.json` |
| `cw install`                    | Generate homes, symlinks, validate `.env`. Idempotent.  |
| `cw add <provider>`             | Interactive: configure a new provider                   |
| `cw add <provider> --as <name>` | Clone a provider with a custom id                       |
| `cw rename <old> <new>`         | Rename a provider instance (home, env, shim, clones)    |
| `cw config <provider>`          | Edit `.env` for a provider in `$EDITOR`                 |
| `cw reset <provider>`           | Regenerate homes for one provider                       |
| `cw reset --all`                | Regenerate all homes                                    |
| `cw list [--json]`              | Tabulate providers with status                          |
| `cw show <provider>`            | Detail view: source, credentials, hooks, checks         |
| `cw doctor [provider]`          | Health check per provider                               |
| `cw env <provider>`             | Print merged env without running Claude                 |
| `cw models <provider>`          | List available models (via models.dev)                  |
| `cw sync`                       | Re-sync symlinks after Claude Code update               |
| `cw rm <provider>`              | Remove a provider's home, env, shims, and clone entry   |
| `claude-<provider> [...]`       | Symlink that runs Claude with this provider's env       |

### Examples

```sh
# Run a one-shot Claude prompt
claude-bedrock --print "summarize this codebase"

# Override model for one invocation
ANTHROPIC_MODEL=claude-opus-4-8 claude-minimax --print "think hard about X"

# Inspect what env Claude will see
cw env bedrock

# Check all providers
cw doctor
```

---

## Security

### Credential tiers

| Tier                                  | Where                                                   | When to use         |
| ------------------------------------- | ------------------------------------------------------- | ------------------- |
| 1. Plaintext `.env`                   | `~/.config/claude-wrappers/env/<id>.env`, chmod 600     | Dev / throwaway     |
| 2. **Keychain (default recommended)** | macOS Keychain / libsecret / Windows Credential Manager | Production personal |
| 3. External command                   | `op read ...`, `pass show ...`                          | Teams / enterprise  |
| 4. Interactive prompt                 | TTY input, never persisted                              | CI / one-off        |

### Always-on mitigations

- **Blocklist env filtering**: `AWS_*`, `ANTHROPIC_*`, `*_TOKEN`, `*_KEY`, `*_SECRET`, `*_PASSWORD` are stripped from the child.
- **Log redaction**: secrets are redacted as `<redacted len=N>` in output.
- **`CLAUDE_CONFIG_DIR` per provider**: each provider's settings.json is isolated.

---

## Adding custom providers

Three tiers, in order of simplicity:

### Tier 1 — Drop-in (no repo changes)

Create `~/.config/claude-wrappers/providers/mycorp.ts`:

```ts
import { z } from "zod";
import { defineProvider } from "claude-code-wrappers";

export default defineProvider({
  id: "mycorp",
  label: "MyCorp Internal",
  group: "anthropic-compatible",
  envSchema: z.object({
    ANTHROPIC_BASE_URL: z.string().url(),
    ANTHROPIC_AUTH_TOKEN: z.string().min(10),
    ANTHROPIC_MODEL: z.string().default("mycorp-claude-opus"),
  }),
  settingsTemplate: "mycorp/settings.template.json",
  realHome: true,
});
```

Drop the matching template at `~/.config/claude-wrappers/presets/mycorp/settings.template.json`:

```jsonc
{
  "env": {
    "ANTHROPIC_BASE_URL": "${ANTHROPIC_BASE_URL}",
    "ANTHROPIC_AUTH_TOKEN": "${ANTHROPIC_AUTH_TOKEN}",
  },
  "model": "${ANTHROPIC_MODEL}",
  "theme": "${CLAUDE_THEME:-dark}",
}
```

Run `cw install` — your provider is now first-class.

### Tier 2 — Builtin preset (PR to this repo)

Same shape, but lives in `src/providers/presets/mycorp.ts` + `presets/mycorp/settings.template.json`.

### Tier 3 — npm plugin

Publish `claude-wrappers-provider-mycorp`. Add to `cw.json`:

```json
{ "plugins": [{ "name": "claude-wrappers-provider-mycorp", "enabled": true }] }
```

---

## Cross-platform

| OS          | Install dir                                      | Bin dir             | Credentials                | Sandbox        |
| ----------- | ------------------------------------------------ | ------------------- | -------------------------- | -------------- |
| **macOS**   | `~/Library/Application Support/claude-wrappers/` | `~/.local/bin`      | Keychain                   | `sandbox-exec` |
| **Linux**   | `~/.config/claude-wrappers/` (XDG)               | `~/.local/bin`      | libsecret (Secret Service) | bubblewrap     |
| **Windows** | `%APPDATA%\claude-wrappers\`                     | `%USERPROFILE%\bin` | Credential Manager         | Job Objects    |

Override any path:

```sh
export CLAUDE_WRAPPERS_BIN_DIR=/opt/cw-bin   # custom bin dir
export XDG_CONFIG_HOME=/custom/config         # standard XDG override
```

---

## FAQ

### Why a single binary instead of one wrapper script per provider?

Atomic versioning, less duplication, easier to extend. A provider is a `defineProvider({...})` call, not 80 lines of bash.

### Why Bun and not Node?

Bun's `build --compile` produces a single-file standalone binary (~30 MB) with no runtime dependencies. Cold start is ~30 ms (vs ~110 ms with Node).

### Can I use `cw` with claude-code-router or similar proxies?

Yes. Set `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN` exactly like any other Anthropic-compatible backend. Add as a custom provider (Tier 1 drop-in).

### How does this interact with Claude Code's auto-update?

`cw` spawns the real `claude` binary, so auto-update works as usual.

### Will Claude Code's new env vars break `cw`?

No. We use a blocklist (deny known credential patterns) instead of a whitelist. New Claude Code env vars pass through automatically.

### Does `cw` send telemetry?

No. The wrapper itself sends nothing. Claude Code's own telemetry is governed by `DISABLE_NONESSENTIAL_TRAFFIC` which `cw` passes through.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  $ cw  (Node bundle, single binary)                         │
│                                                              │
│  1. Load registry (builtin + drop-ins + plugins + clones)   │
│  2. Validate .env against provider's zod schema             │
│  3. Resolve credentials (keyring / .env / exec / prompt)    │
│  4. Expand settings.template.json → isolated/settings.json  │
│  5. Link real ~/.claude/{credentials,hooks,agents,...} →     │
│     isolated home (auto-discovered)                         │
│  6. Run provider.hooks.preExec (token rotation, etc.)       │
│  7. spawn(claude_bin, args, { env: filteredEnv })           │
│     - HOME = isolatedHome                                    │
│     - REAL_HOME = os.homedir()                              │
│     - CLAUDE_CONFIG_DIR = isolatedHome/.claude              │
│  8. Run provider.hooks.postExec on exit                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Development

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- `bats-core` for bash tests (optional): `brew install bats-core`

### Setup

```sh
bun install
```

### Build

```sh
bun run build                  # compiles standalone binary for current OS/arch
./scripts/dev-install.sh       # build + install to ~/.local/bin/cw
```

### Test

```sh
bun test                # unit tests
bun run test:bash       # bash tests (requires bats-core)
bun run lint            # biome check
bun run typecheck       # tsc --noEmit
```

### Release

The release chain runs three workflows in sequence — there's nothing manual to do beyond merging to `main`:

1. **`ci.yml`** — runs the test matrix on ubuntu/macos/windows. If anything fails, the chain stops here.
2. **`tag.yml`** — fires on CI success, computes the next semver from the latest tag + commit body (`#major` / `#minor` / default patch), creates a signed tag, and pushes it. Skip the auto-tag by setting the `TAG_SIGNING_KEY` secret (see [`.github/SIGNING.md`](.github/SIGNING.md)).
3. **`release.yml`** — fires on the tag push, rebuilds binaries for all OS/arch combos, and publishes the GitHub Release with checksums.

```sh
git commit -m "feat: add openrouter provider"    # default: patch bump
git commit -m "feat: rewrite env loader #minor"  # explicit minor bump
git commit -m "BREAKING: drop node 18 #major"   # explicit major bump
git push origin main                             # ci.yml → tag.yml → release.yml
```

Need to re-run a release without pushing a new tag? **Actions → Release → Run workflow** (uses `workflow_dispatch`).

Need to cut a release outside the chain (hotfix, off-cycle)? Push the tag manually and `release.yml` will pick it up:

```sh
git tag -s v0.1.1 <sha>
git push origin v0.1.1
```

---

## License

MIT — see [LICENSE](LICENSE).
