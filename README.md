# Echelon

A desktop app for orchestrating AI agent teams. Deploy themed squads of specialized agents, coordinate them through review gates and a multi-model counselor, and manage everything from one interface. Built on [Dorothy](https://github.com/Charlie85270/Dorothy) by Charlie85270.

## What Echelon Adds

Echelon extends Dorothy's parallel agent management with the **factor-echelon** team-factory system:

- **Seasons** — themed team compositions (e.g., Big Bang Theory, Star Wars) that define how agents are cast, named, and coordinated
- **Characters** — specialized agent personas built from archetypes, each with a 7-file soul package (SOUL.md, AGENTS.md, HEARTBEAT.md, etc.)
- **Review Gates** — parallel quality gates (architecture, code, QA, security, adversarial, UI, refinement) that PRs must pass before merge
- **Counselor** — a 4-model consensus council (Gemini, GPT-5, Claude Opus, Grok) for high-stakes decisions
- **Knowledge Base** — persistent team memory via mempalace integration
- **Multi-target builds** — the same team definitions compile to Claude Code plugins, OpenClaw agents, or Echelon season packs

## Core Features (from Dorothy)

- **Parallel agent management** — run 10+ agents simultaneously across different projects
- **Super Agent orchestrator** — a meta-agent that delegates and coordinates work across your agent pool
- **Kanban task board** — automatic agent assignment based on skill matching
- **Automations** — poll GitHub PRs, JIRA issues, and other sources to spawn agents automatically
- **Scheduled tasks** — cron-based recurring agent work
- **Remote control** — Telegram and Slack integration for managing agents from anywhere
- **Vault** — persistent document storage accessible across all agents
- **Usage tracking** — token consumption, cost tracking, and activity patterns
- **Skills & plugins** — extend agents with skills from [skills.sh](https://skills.sh)

## Installation

### Prerequisites

- **Node.js** 20+
- **Bun** runtime (for skill pipeline builds)
- **Claude Code CLI**: `npm install -g @anthropic-ai/claude-code`

### Build from Source

```bash
git clone https://github.com/jediswimmer/Echelon.git
cd Echelon
npm install
npx @electron/rebuild        # Rebuild native modules for Electron
npm run echelon:dev           # Development mode
npm run echelon:build         # Production build (DMG)
```

### Skill Pipeline

```bash
bun run skill:build                  # Build all targets
bun run skill:build:claude-code      # Claude Code plugin
bun run skill:build:openclaw         # OpenClaw agent
bun run skill:build:echelon          # Echelon season pack
bun run skill:test                   # Run team-factory tests
```

## Architecture

```
echelon/
├── src/                       # Next.js renderer (pages, components, hooks, stores)
├── electron/                  # Electron main process (core managers, handlers, services)
├── src/team-factory/          # Factor-echelon skill content (archetypes, themes, counselor)
├── build/                     # Skill pipeline (parser, validators, per-target builders)
├── adapters/                  # Platform adapters (claude-code, openclaw, echelon)
├── mcp-orchestrator/          # MCP server: agent management, scheduling, automations
├── mcp-kanban/                # MCP server: task board
├── mcp-vault/                 # MCP server: document storage
├── mcp-telegram/              # MCP server: Telegram messaging
├── mcp-socialdata/            # MCP server: Twitter/X data
├── mcp-x/                    # MCP server: X posting
├── mcp-world/                # MCP server: generative zones (parked)
├── docs/                     # Specs, plans, guides, concepts
└── __tests__/                # Vitest test suite
```

### Data Storage

| Location | Description |
|----------|-------------|
| `~/.echelon/` | App data directory (agents, settings, vault, kanban, scheduler) |
| `~/.echelon/seasons/` | Season workspaces and character soul packages |
| `~/.claude/settings.json` | Claude Code user settings |

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **Frontend** | React 19, Tailwind CSS 4, Zustand 5 |
| **Desktop** | Electron 33 |
| **Terminal** | xterm.js + node-pty |
| **Database** | better-sqlite3 (SQLite FTS5) |
| **MCP** | @modelcontextprotocol/sdk |
| **Skill Pipeline** | Bun + TypeScript |
| **Language** | TypeScript 5 |

## Development

```bash
npm run dev              # Skill build + Electron dev
npm run echelon:dev      # Electron + Next.js dev
npm run test             # Vitest
npm run lint             # ESLint
bun run skill:build      # Build skill pipeline
```

## Upstream

Echelon is a fork of [Dorothy](https://github.com/Charlie85270/Dorothy) by [Charlie85270](https://github.com/Charlie85270). The upstream remote tracks the original repo for pulling in new features and fixes.

## Design Specification

See `docs/specs/2026-04-08-factor-echelon-design.md` for the full factor-echelon design spec, and `docs/superpowers/plans/` for the 11-plan implementation roadmap.

## License

This project is open source and available under the [MIT License](LICENSE).
