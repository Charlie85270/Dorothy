# Platform Guide: Claude Code

How to install and use factor-echelon as a Claude Code plugin.

---

## Prerequisites

- Claude Code v2.0.0 or later ([claude.com/claude-code](https://claude.com/claude-code))
- factor-echelon built for the Claude Code target (`bun run build` produces `dist/claude-code/`)

---

## Installation

### From a local build

```bash
# Build the Claude Code plugin
cd factor-echelon
bun install && bun run build

# Copy to your Claude Code plugins directory
cp -r dist/claude-code ~/.claude/plugins/factor-echelon
```

### From a GitHub release

Download the `claude-code` artifact from the [latest release](https://github.com/your-org/factor-echelon/releases) and extract it to `~/.claude/plugins/factor-echelon`.

---

## How the plugin works

### plugin.json

The plugin manifest tells Claude Code how to load factor-echelon:

```json
{
  "name": "factor-echelon",
  "version": "0.0.1",
  "description": "Themed AI agent development team factory",
  "author": "Scott Newmann",
  "license": "MIT",
  "main": "SKILL.md",
  "claudeCode": {
    "minVersion": "2.0.0",
    "type": "skill"
  }
}
```

- `main` points to the root SKILL.md, which is the orchestrator entrypoint.
- `type: "skill"` tells Claude Code this is a skill package (not a tool or extension).
- `minVersion` ensures compatibility with the required Claude Code features.

### What ships in the plugin

- `plugin.json` -- plugin manifest
- `skill/` -- full skill tree (archetypes, themes, characters, protocols, shared skills)
- `character-index.json` -- fast lookup of characters by name and archetype

### Skill loading

When Claude Code starts a session with the plugin installed, it loads `SKILL.md` as the root orchestrator. This gives Claude Code access to the full team factory: Penny's ingestion, Leonard's coordination, all character soul packages, shared skills (source control, file ops, KB, review gates), season lifecycle management, and Counselor invocation.

---

## Slash commands

factor-echelon registers these commands in Claude Code:

| Command | Description |
|---|---|
| `/new-season` | Start a new season with a PRD |
| `/team` | Show the current season's roster |
| `/task` | Assign a task to a character |
| `/status` | Show season status and active tasks |
| `/expand` | Trigger mid-season expansion |
| `/advisory` | Consult the advisory board |
| `/counselor` | Invoke the Counselor for a specific placement |

---

## Configuration

factor-echelon stores configuration at `~/.factor-echelon/config/`. Claude Code-specific settings:

```yaml
# ~/.factor-echelon/config/platform.yaml
platform: claude-code
plugin_path: ~/.claude/plugins/factor-echelon
```

Counselor API keys are stored via environment variables in the Claude Code context (no OS keychain integration in the plugin -- use Echelon for keychain support):

```bash
export GEMINI_API_KEY=...
export OPENAI_API_KEY=...
export ANTHROPIC_API_KEY=...
export XAI_API_KEY=...
```

---

## Limitations vs Echelon

The Claude Code plugin is a portable adapter. Some features are reduced compared to the full Echelon desktop app:

| Feature | Claude Code | Echelon |
|---|---|---|
| Core team factory | Full | Full |
| Review gates | Full | Full |
| Knowledge base | Solo mode only | Solo + team mode |
| Visual dashboard | No (text-based) | Yes (Electron UI) |
| Worktree management | Via CLI | Via UI + CLI |
| Season management | Via slash commands | Via UI + CLI |
| OOBE | CLI prompts | Guided wizard |
| API key storage | Environment variables | OS keychain |
| Desktop notifications | No | Yes (tray panel) |

The Claude Code plugin is ideal for developers who prefer a CLI-first workflow and already use Claude Code as their primary development tool.

---

## See also

- [Platform: OpenClaw](platform-openclaw.md) -- alternative platform
- [Quickstart](../quickstart.md) -- first-time setup
- [Architecture](../concepts/architecture.md) -- how adapters relate to the core
