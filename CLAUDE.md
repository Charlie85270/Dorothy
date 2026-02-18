# Dorothy — Project Instructions

Dorothy is an Electron + Next.js desktop app for managing Claude Code agents. It provides a GUI for spawning agents, monitoring their output, managing automations, and integrating with external services (Telegram, Slack, Jira, etc.).

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS, Framer Motion, Lucide icons
- **Desktop shell**: Electron (main process + preload bridge)
- **Runtime**: Bun (use `bun` not `npm`/`node` for installs and scripts)
- **Language**: TypeScript throughout

## Key Commands

```bash
bun run dev          # Start Next.js dev server only
bun run electron:dev # Start full Electron + Next.js dev environment
bun run build        # Build Next.js
bun run electron:build # Build distributable Electron app
bun run lint         # Run ESLint
bun run type-check   # TypeScript check
```

## Architecture

```
electron/
  main.ts              # Electron entry point, app lifecycle
  preload.ts           # IPC bridge (contextBridge) — all APIs exposed here
  handlers/
    ipc-handlers.ts    # Main IPC handler registry — add registerX() calls here
    memory-handlers.ts # Native Claude memory IPC
    ...
  services/
    memory-service.ts  # Reads ~/.claude/projects/*/memory/
    ...
  types.ts             # Electron-side TypeScript types

src/
  app/                 # Next.js App Router pages
    agents/            # Agent management
    memory/            # Native Claude memory viewer
    settings/          # App settings
    ...
  components/
    Sidebar.tsx        # Main navigation — add nav items here
    Settings/          # Settings section components
  hooks/
    useMemory.ts       # Memory data hook
    useSettings.ts     # Settings data hook
    useElectron.ts     # Electron API helpers + isElectron()
  types/
    electron.d.ts      # ElectronAPI interface + all data types
```

## IPC Pattern

All communication between renderer (React) and main (Electron) goes through:
1. **Service** (`electron/services/`) — pure logic, file I/O, etc.
2. **Handler** (`electron/handlers/`) — registers `ipcMain.handle()` channels
3. **Preload** (`electron/preload.ts`) — exposes `ipcRenderer.invoke()` via `contextBridge`
4. **Type** (`src/types/electron.d.ts`) — TypeScript interface for `window.electronAPI`
5. **Hook** (`src/hooks/`) — React hook consuming the API

When adding a new feature: create service → handler → preload bridge → type → hook → page.

## Memory System

Dorothy exposes Claude Code's **native memory** (`~/.claude/projects/*/memory/`) via the Memory page. No custom storage — reads real Claude Code memory files. Project dir names use path-as-folder-name encoding (slashes → dashes).

## Memory

Use auto memory (`~/.claude/projects/.../memory/`) actively on this project:
- Save architectural decisions, key file locations, and debugging insights to `MEMORY.md`
- Create topic files (e.g. `patterns.md`, `debugging.md`) for detailed notes — keep `MEMORY.md` under 200 lines
- At session start, review `MEMORY.md` for relevant context before diving in
- After any correction or new discovery, update memory so the next session benefits

## Coding Conventions

- Use `bun` not `npm`
- All new pages are `'use client'` Client Components unless clearly static
- Use `useCallback` for functions passed as props or used in effects
- Follow existing IPC handler pattern in `ipc-handlers.ts`
- Import icons from `lucide-react` only
- CSS: Tailwind utility classes + CSS variables (`bg-card`, `text-foreground`, `border-border`, `text-primary`, etc.)
- Animations: `framer-motion` (`motion.div`, `AnimatePresence`)
- No new dependencies without discussion

## Settings Section Pattern

To add a new settings section:
1. Create `src/components/Settings/MySection.tsx`
2. Export from `src/components/Settings/index.ts`
3. Add to `SECTIONS` array in `constants.ts`
4. Add `'mysection'` to `SettingsSection` type in `types.ts`
5. Add `case 'mysection':` in `settings/page.tsx` `renderContent()`
