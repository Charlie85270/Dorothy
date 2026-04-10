# factor-echelon

Themed AI agent software development team factory. Drop in a PRD, pick a theme, get a live team ready to build.

## Quickstart

See [docs/quickstart.md](docs/quickstart.md) — 15 minutes from install to your first team.

```bash
git clone https://github.com/jediswimmer/factor-echelon.git
cd factor-echelon/build && bun install
bun run build.ts          # builds 3 targets: Claude Code, OpenClaw, Echelon
bun test                  # 158+ tests, 0 failures
```

## What you get

- **43 pre-authored archetype roles** spanning Medium, Large, and Enterprise tiers
- **42 TBBT characters** (plus Young Sheldon expansion) with full soul packages
- **12-character advisory board** of tech giant SMEs for cross-season consultation
- **Multi-model Counselor** (Gemini, GPT-5, Opus 4.6, Grok) at 4 high-leverage decision points
- **Worktree-per-agent execution** with 7 review gates + 5-star rating system
- **mempalace-backed knowledge base** with solo (v0.1) and team (v0.5) modes
- **8-step resumable OOBE** with OS keychain integration
- **Full CLI intervention layer** for cancel, override, rerun, and uninstall
- **Multi-season isolation** — run concurrent projects without cross-contamination
- Runs on **Claude Code**, **OpenClaw**, and **Echelon.app** (3 build targets)

## Architecture

```
Content Layer        43 archetypes + themed characters + advisory board
Composition Layer    Roster composer + theme engine + scope estimator
Runtime Layer        Seasons + worktrees + review gates + merge authority
Cross-cutting        Counselor + knowledge base + CLI intervention
Build Targets        Claude Code plugin | OpenClaw bundle | Echelon season pack
```

## Documentation

- [Quickstart](docs/quickstart.md) — 15-minute walkthrough
- [Concepts](docs/concepts/) — architecture, flywheel, safety nets, seasons, KB, counselor
- [Guides](docs/guides/) — writing archetypes/characters, platform setup
- [Examples](docs/examples/) — worked PRDs with expected teams
- [Full design spec](docs/specs/2026-04-08-factor-echelon-design.md)

## Status

**v0.1 Alpha** — all 10 implementation plans complete. 158+ tests passing across 3 build targets.

## Contributing

Contributions welcome. See [docs/guides/writing-an-archetype.md](docs/guides/writing-an-archetype.md) for adding new archetypes and [docs/guides/writing-a-character.md](docs/guides/writing-a-character.md) for new characters.

## License

MIT
