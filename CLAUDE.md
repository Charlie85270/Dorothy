# Echelon

Echelon is an Electron + Next.js desktop app that hosts the **factor-echelon** team-factory skill system. It manages AI agent teams organized into **seasons** (themed team compositions), each containing **characters** (specialized agent personas). Characters are cast from archetypes, equipped with soul packages, and coordinated through review gates and a multi-model counselor.

## Architecture

- **Renderer**: Next.js 16 app in `src/` (pages, components, hooks, stores)
- **Main process**: Electron 33 in `electron/` (core managers, handlers, services, providers)
- **Team factory**: Skill content pipeline in `src/team-factory/` + `build/` + `adapters/`
- **MCP servers**: `mcp-orchestrator/`, `mcp-kanban/`, `mcp-vault/`, `mcp-telegram/`, `mcp-socialdata/`, `mcp-x/`
- **Data dir**: `~/.echelon/` (agents, settings, vault, kanban, scheduler)

## Key References

- **Design spec**: `docs/specs/2026-04-08-factor-echelon-design.md`
- **Implementation plans**: `docs/superpowers/plans/`
- **Constants**: `electron/constants/index.ts` (DATA_DIR, paths, config)
- **Entry point**: `electron/main.ts`

## Memory

Use auto memory (`~/.claude/projects/.../memory/`) actively on this project:
- Save architectural decisions, key file locations, and debugging insights to `MEMORY.md`
- Create topic files (e.g. `patterns.md`, `debugging.md`) for detailed notes — keep `MEMORY.md` under 200 lines
- At session start, review `MEMORY.md` for relevant context before diving in
- After any correction or new discovery, update memory so the next session benefits

## Autonomy

When you are delegated a task by Echelon or an orchestrator agent, **always act autonomously**:
- Do NOT ask for confirmation before proceeding — just do the work and report results
- Do NOT ask "Would you like me to continue?" or "Shall I proceed?" — the answer is always yes
- If a task is ambiguous, make reasonable assumptions and state them in your report
- Complete the full task and return your findings/output directly
# currentDate
Today's date is 2026-04-10.
