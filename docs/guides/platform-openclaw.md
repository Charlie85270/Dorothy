# Platform Guide: OpenClaw

How to install and use factor-echelon as an OpenClaw bundle.

---

## Prerequisites

- OpenClaw installed and configured
- factor-echelon built for the OpenClaw target (`bun run build` produces `dist/openclaw/`)

---

## Installation

### Using the install script

The OpenClaw bundle includes an `install.sh` script that handles everything:

```bash
# Build the OpenClaw bundle
cd factor-echelon
bun install && bun run build

# Run the installer
cd dist/openclaw
bash install.sh
```

The installer:
1. Copies the skill files to `~/.openclaw/workspace/factor-echelon/` (or `$OPENCLAW_INSTALL_DIR` if set).
2. Copies the `openclaw.json` configuration file.
3. Optionally registers the mempalace MCP server (if mempalace is installed on the system).

### Custom install path

Set `OPENCLAW_INSTALL_DIR` to install to a different location:

```bash
OPENCLAW_INSTALL_DIR=/path/to/custom/dir bash install.sh
```

### From a GitHub release

Download the `openclaw` artifact from the [latest release](https://github.com/your-org/factor-echelon/releases), extract it, and run `bash install.sh`.

---

## Starting factor-echelon

After installation, start OpenClaw with the factor-echelon config:

```bash
openclaw start --config ~/.openclaw/workspace/factor-echelon/openclaw.json
```

The first run triggers the OOBE flow (theme selection, advisory board provisioning, user profile interview) as channel-based prompts.

---

## What ships in the bundle

- `openclaw.json` -- bundle configuration with MCP server declarations
- `install.sh` -- installation script (idempotent, safe to re-run)
- `skill/` -- full skill tree (archetypes, themes, characters, protocols, shared skills)
- `character-index.json` -- fast character lookup by name and archetype

---

## Configuration

### openclaw.json

The OpenClaw configuration file defines how factor-echelon integrates with the OpenClaw runtime:

```json
{
  "name": "factor-echelon",
  "version": "0.0.1",
  "skill_root": "./skill/",
  "mcp_servers": {
    "mempalace": {
      "enabled": true,
      "auto_register": true
    }
  }
}
```

### factor-echelon config

Platform-independent configuration lives at `~/.factor-echelon/config/`:

```yaml
# ~/.factor-echelon/config/platform.yaml
platform: openclaw
bundle_path: ~/.openclaw/workspace/factor-echelon
```

Counselor API keys are set via environment variables:

```bash
export GEMINI_API_KEY=...
export OPENAI_API_KEY=...
export ANTHROPIC_API_KEY=...
export XAI_API_KEY=...
```

---

## MCP server integration

factor-echelon uses mempalace as an MCP (Model Context Protocol) server for knowledge base operations. If mempalace is installed on your system, the install script registers it automatically. If not, the knowledge base falls back to file-based storage with git mirroring.

To manually register mempalace after install:

```bash
mempalace mcp register
```

---

## Limitations vs Echelon

| Feature | OpenClaw | Echelon |
|---|---|---|
| Core team factory | Full | Full |
| Review gates | Full | Full |
| Knowledge base | Solo mode only | Solo + team mode |
| Visual dashboard | No (channel-based) | Yes (Electron UI) |
| MCP server support | Native | Native |
| Worktree management | Via CLI | Via UI + CLI |
| Season management | Via channels | Via UI + CLI |
| OOBE | Channel prompts | Guided wizard |
| API key storage | Environment variables | OS keychain |
| Desktop notifications | No | Yes (tray panel) |

The OpenClaw bundle is a good fit for teams already using OpenClaw as their agent orchestration platform.

---

## Uninstalling

To remove factor-echelon from OpenClaw:

```bash
rm -rf ~/.openclaw/workspace/factor-echelon
```

To also remove factor-echelon's configuration and knowledge base (export first to preserve learnings):

```bash
# Export KB first (recommended)
factor-echelon export-kb ~/kb-backup.tar.gz

# Remove all factor-echelon data
rm -rf ~/.factor-echelon
```

---

## See also

- [Platform: Claude Code](platform-claude-code.md) -- alternative platform
- [Quickstart](../quickstart.md) -- first-time setup
- [Architecture](../concepts/architecture.md) -- how adapters relate to the core
