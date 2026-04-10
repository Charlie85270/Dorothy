# Plan 11: Echelon — Host Runtime, Rebrand, and Team Factory Absorption

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Dorothy Electron fork (`github.com/jediswimmer/Dorothy`) into **Team Factory Echelon** — the primary host runtime for factor-echelon seasons. Absorb the `team-factory` source tree into the Echelon repo as a first-class workspace, introduce the season/character/roster model as real objects in the Electron main process, add Echelon as a third build target beside Claude Code and OpenClaw, re-skin the UI end-to-end under the Echelon brand, and park Dorothy-era features that are off-brand for Echelon. After this plan, a user launches `Echelon.app`, imports or composes a season, and watches a themed team of characters work in parallel through review gates — all from a single desktop control center.

**Architecture:** Monorepo. `src/team-factory/` remains the canonical skill source (Plan 01 layout unchanged). `build/targets/echelon.ts` is a new adapter peer to `claude-code.ts` and `openclaw.ts` that emits `dist/echelon/` season packs. The Electron main process gains a new `electron/core/season-manager.ts` that sits alongside the existing `agent-manager.ts` and composes it — a season wraps N characters, a character wraps a Dorothy-style agent plus an attached 7-file soul package. The Next.js renderer gains a `src/app/seasons/` route that mirrors the shape of `src/app/agents/`. Dorothy's existing Kanban board becomes the review-gate surface, its memory service becomes one of two KB backends behind the factor-echelon KB interface, and its Super Agent becomes the Convener character for each season. The repo, bundle ID, product name, tray icon, window chrome, and landing page are all rebranded to Echelon.

**Tech Stack:** Dorothy stack (Electron 33, Next 16, React 19, TypeScript 5.x, node-pty, better-sqlite3, Bun lockfile, electron-builder, MCP sidecar servers) **plus** team-factory's Plan 01 stack (Bun build pipeline, Zod, js-yaml, gray-matter, Biome). The two stacks are compatible — Dorothy already uses Bun lockfiles and TypeScript. New: `@factor-echelon/*` workspace packages, electron-builder rebranded to `Echelon`, bundle ID `io.tf-echelon.app`, new icon/splash assets, replacement of all user-visible "Dorothy" strings.

**Spec reference:** `docs/specs/2026-04-08-factor-echelon-design.md` §5 (Architecture), §6 (Components), §7 (OOBE / Ingestion / Expansion / Intervention), §10 (Bootstrap DAG), §12 (Multi-season operations). This plan is sequenced **after** Plans 01–04 (foundation + content + composer + OpenClaw adapter) and **in parallel with** Plans 05, 07, and 09, whose "host platform" assumptions it supersedes. It is a prerequisite for Plan 10 (integration + release) because Echelon.app is one of the v0.1 release artifacts.

---

## 0. Strategic Decision — Absorb team-factory into the Echelon repo

### 0.1 The choice

Two repos possible:

- **Option A — Dual repo:** `team-factory` stays as the skill source + build pipeline, publishes `dist/echelon/` bundles to GitHub Releases; the Echelon Electron app (separate repo) consumes those bundles.
- **Option B — Monorepo:** The Dorothy fork becomes the Echelon repo and absorbs `team-factory/` as `src/team-factory/` (and friends). One repo, one release, one CI.

**Decision: Option B — monorepo.** This plan executes the absorption.

### 0.2 Rationale

1. **Stack convergence.** Dorothy already uses Bun lockfiles, TypeScript 5, and a Next.js + Electron split. team-factory's Plan 01 locks in Bun + TypeScript + Zod. The two toolchains are the same — running them in separate repos is duplication for no gain.
2. **Echelon is not a consumer of team-factory.** The factor-echelon design spec treats the host platform as a delegate for execution. With Echelon, the host *is* the runtime for seasons, worktrees, review gates, KB, intervention, and Counselor. The source that describes those behaviors and the runtime that executes them should ship together.
3. **Single release cadence.** A season pack format change would otherwise require coordinated releases across two repos. Monorepo eliminates the lockstep problem — one tag, one CI matrix, one version number.
4. **Simpler refactoring.** Plans 05, 07, and 09 need to change their host-platform assumptions; doing that across repo boundaries is painful. In-tree refactoring is straightforward.
5. **Claude Code and OpenClaw targets are preserved.** The monorepo still builds `dist/claude-code/` and `dist/openclaw/` exactly as Plans 01 and 04 specify. Absorbing team-factory does not break the multi-target invariant — it just adds one more target (Echelon) which happens to live next door.

### 0.3 What absorption means concretely

- The entire current `team-factory/` tree (specs, plans, `src/team-factory/`, `build/`, `adapters/`, tests) moves under the Dorothy fork as-is, preserving the Plan 01 directory layout.
- The Dorothy fork is renamed to `echelon` (repo name + product name + bundle ID + package.json name).
- The monorepo gains a Bun workspace root that coordinates the skill build pipeline with the Electron app build.
- CI runs both tracks in parallel: (a) team-factory build + Plan 01–04 tests, (b) Echelon electron-builder + renderer tests.
- The existing `team-factory` repo is preserved as an archive but becomes read-only after absorption. A note in its README points at the Echelon repo.

### 0.4 Fallback

If absorption surfaces unexpected tooling conflicts (e.g. Bun workspace + Electron sandbox + Next.js 16 turbopack don't play well), the fallback is dual-repo Option A with a published `@factor-echelon/season-pack` npm package as the contract between the two. Phase A below has a mid-phase decision gate that can abort to Option A without losing work.

---

## 1. Naming & Branding

### 1.1 Names and identifiers (proposed — needs confirmation at §8 open questions)

| Surface | Current (Dorothy) | New (Echelon) |
|---|---|---|
| Product name | Dorothy | Team Factory Echelon |
| Short name | Dorothy | Echelon |
| Repo (GitHub) | `jediswimmer/Dorothy` | `jediswimmer/echelon` |
| `package.json` name | `dorothy` | `echelon` |
| Electron bundle ID | `io.dorothy.app` | `io.tf-echelon.app` |
| macOS app binary | `Dorothy.app` | `Echelon.app` |
| Tray title | `Dorothy` | `Echelon` |
| Auto-update owner | `Charlie85270/dorothy` | `jediswimmer/echelon` |
| User data dir | `~/.dorothy/` | `~/.echelon/` (with migration shim) |
| Logs dir | `~/Library/Logs/Dorothy/` | `~/Library/Logs/Echelon/` |
| Skill package (team-factory internal) | `factor-echelon` | `factor-echelon` (unchanged — this is the *skill* name) |
| Canonical source dir | N/A | `src/team-factory/` (unchanged from Plan 01) |

**Naming rationale:** "Team Factory" is the conceptual project (the portable skill). "Echelon" is the command-center application that hosts it. The full product name is "Team Factory Echelon" but everywhere tight (tray, taskbar, title bar, docs) uses "Echelon". The skill package itself retains the `factor-echelon` codename from Plan 01 because every plan, schema, and artifact already references it.

### 1.2 Visual identity

- **Palette:** Shift from Dorothy's warm-pastel palette to a muted command-center palette. Reference: amber + deep navy + slate, with accent greens for healthy seasons and amber for in-review. Avoid pure black (Dorothy doesn't use it either) to keep warmth.
- **Iconography:** Replace the Dorothy cat illustration with an Echelon mark (suggested: three stacked chevrons representing roster tiers — Medium, Large, Enterprise — over a subtle grid). Generated with Nano Banana Pro via the `compound-engineering:gemini-imagegen` skill.
- **Typography:** Keep Dorothy's existing font stack (it's already good). Tighten heading weights to evoke "operations room" rather than "hand-crafted app".
- **Screenshots:** All `screenshots/*.png` files get regenerated during Phase K after the UI retheme is done.

### 1.3 What's parked (off-brand for Echelon)

The following Dorothy features are preserved on a `parked/dorothy-legacy` branch and removed from `main`:

- `mcp-world/` and `src/components/PokemonGame/` — the Pallet Town / Pokemon world feature
- `src/app/pallet-town/` — the world renderer route
- `skills/world-builder/` — the world-builder skill
- `src/components/AgentWorld/` — if it's pure world-related (keep if it's a generic agent list view)

These are fun but have no place in a command center for themed software teams. Parking them on a branch means zero loss — anyone who wants them back can cherry-pick.

### 1.4 What stays (core Dorothy that Echelon needs)

- Agent manager + PTY manager + tray manager + window manager (all of `electron/core/`)
- All seven MCP sidecars except `mcp-world/` (orchestrator, kanban, vault, telegram, x, socialdata — kanban becomes review gates, vault becomes artifact store, orchestrator becomes convener dispatcher)
- Memory service + vault-db (become KB backends)
- Telegram and Slack bots (become intervention channels per Plan 09)
- Scheduler (becomes rerun/schedule surface for Plan 09)
- Hooks manager (stays — agents still emit status hooks)
- Skills discovery from `skills/` (stays — factor-echelon skills are still skills)
- Plugin dialog + settings + usage tracking

---

## 2. File Structure (target end state)

```
echelon/                                          # was: dorothy/ (renamed)
├── package.json                                  # Bun workspace root; scripts for both tracks
├── bun.lock
├── tsconfig.json
├── tsconfig.base.json
├── biome.json                                    # NEW from team-factory Plan 01
├── .github/
│   └── workflows/
│       ├── pr.yml                                # CI: team-factory build + Echelon render + lint
│       ├── release-echelon.yml                   # electron-builder release
│       └── release-skill.yml                     # factor-echelon skill bundle release
│
├── src/                                          # Next.js renderer (existing Dorothy)
│   ├── app/
│   │   ├── seasons/                              # NEW — Echelon's primary route
│   │   │   ├── page.tsx                          # season list
│   │   │   ├── [seasonId]/
│   │   │   │   ├── page.tsx                      # season detail (roster grid)
│   │   │   │   ├── characters/[characterId]/    # character drawer / detail
│   │   │   │   ├── review-gates/                 # gate status view
│   │   │   │   ├── expansions/                   # expansion proposals
│   │   │   │   └── manifest/                     # raw roster manifest viewer
│   │   │   └── new/                              # season creation wizard (Plan 07 OOBE)
│   │   ├── agents/                               # KEPT — advanced view for power users
│   │   ├── kanban/                               # REPURPOSED as review-gate board
│   │   ├── memory/                               # EXTENDED as KB view (mempalace + local)
│   │   ├── vault/                                # KEPT as artifact store
│   │   ├── automations/                          # KEPT (Plan 09 reruns)
│   │   ├── recurring-tasks/                      # KEPT
│   │   ├── skills/                               # KEPT — shows factor-echelon skills too
│   │   ├── plugins/                              # KEPT
│   │   ├── settings/
│   │   │   ├── counselor/                        # NEW — API key entry for 4 models
│   │   │   └── ...                               # existing
│   │   ├── projects/                             # KEPT
│   │   ├── tray-panel/                           # KEPT
│   │   ├── usage/                                # KEPT
│   │   ├── support/                              # KEPT
│   │   ├── whats-new/                            # UPDATED for Echelon launch
│   │   ├── layout.tsx                            # REBRANDED
│   │   ├── page.tsx                              # NEW landing: seasons overview + CTA
│   │   ├── icon.tsx                              # NEW Echelon mark
│   │   └── globals.css                           # RETHEMED palette
│   ├── components/
│   │   ├── Echelon/                              # NEW component namespace
│   │   │   ├── SeasonCard.tsx
│   │   │   ├── SeasonDetailView.tsx
│   │   │   ├── RosterGrid.tsx
│   │   │   ├── CharacterCard.tsx
│   │   │   ├── CharacterDrawer.tsx               # soul package viewer
│   │   │   ├── ReviewGateBoard.tsx               # overlays Kanban
│   │   │   ├── ExpansionProposalCard.tsx
│   │   │   ├── CounselorVerdict.tsx
│   │   │   ├── ThemeBadge.tsx
│   │   │   └── RosterManifestViewer.tsx
│   │   ├── AgentList/                            # KEPT
│   │   ├── KanbanBoard/                          # KEPT, extended with review-gate columns
│   │   ├── Memory/                               # KEPT, extended
│   │   ├── Dashboard/                            # REBRANDED
│   │   ├── NewChatModal/                         # KEPT
│   │   ├── ObsidianVaultView/                    # KEPT
│   │   ├── PluginInstallDialog.tsx               # KEPT
│   │   ├── ProviderBadge.tsx                     # KEPT
│   │   ├── SchedulerCalendar.tsx                 # KEPT
│   │   ├── CanvasView.tsx                        # KEPT
│   │   ├── PokemonGame/                          # REMOVED (parked)
│   │   ├── AgentWorld/                           # REMOVED (parked) if world-only
│   │   └── ClientLayout.tsx                      # REBRANDED
│   ├── data/
│   ├── hooks/
│   ├── lib/
│   ├── store/
│   └── types/
│       └── echelon.ts                            # NEW — shared renderer types
│
├── electron/                                     # Main process (existing Dorothy)
│   ├── main.ts                                   # UPDATED — initializes season-manager + counselor
│   ├── preload.ts                                # EXTENDED — season:* IPC
│   ├── core/
│   │   ├── agent-manager.ts                      # KEPT
│   │   ├── season-manager.ts                     # NEW — season lifecycle
│   │   ├── character-loader.ts                   # NEW — loads 7-file soul package
│   │   ├── roster-manager.ts                     # NEW — roster manifest CRUD
│   │   ├── review-gate-runner.ts                 # NEW — parallel gate execution
│   │   ├── pty-manager.ts                        # KEPT
│   │   ├── tray-manager.ts                       # REBRANDED + season-aware menu
│   │   ├── tray-panel-manager.ts                 # REBRANDED
│   │   └── window-manager.ts                     # REBRANDED
│   ├── handlers/
│   │   ├── season-handlers.ts                    # NEW — IPC: season:list/spawn/archive/expand/import
│   │   ├── character-handlers.ts                 # NEW — IPC: character:read-soul/override/expand
│   │   ├── review-gate-handlers.ts               # NEW
│   │   ├── counselor-handlers.ts                 # NEW
│   │   ├── ipc-handlers.ts                       # KEPT, extended with season IPC registration
│   │   ├── kanban-handlers.ts                    # EXTENDED to support gate columns
│   │   ├── memory-handlers.ts                    # EXTENDED to bridge KB interface
│   │   ├── vault-handlers.ts                     # KEPT
│   │   ├── automation-handlers.ts                # KEPT
│   │   ├── scheduler-handlers.ts                 # KEPT
│   │   ├── cli-paths-handlers.ts                 # KEPT
│   │   ├── mcp-config-handlers.ts                # KEPT
│   │   ├── obsidian-handlers.ts                  # KEPT
│   │   ├── gws-handlers.ts                       # KEPT
│   │   └── world-handlers.ts                     # REMOVED (parked)
│   ├── services/
│   │   ├── api-server.ts                         # KEPT, extended with /seasons endpoints
│   │   ├── claude-service.ts                     # KEPT
│   │   ├── counselor-service.ts                  # NEW — 4-model council dispatcher
│   │   ├── kb-bridge.ts                          # NEW — factor-echelon KB interface → memory-service/vault-db
│   │   ├── mempalace-client.ts                   # NEW — optional mempalace backend
│   │   ├── memory-service.ts                     # EXTENDED
│   │   ├── vault-db.ts                           # KEPT
│   │   ├── kanban-automation.ts                  # EXTENDED — review-gate auto-assignment
│   │   ├── hooks-manager.ts                      # KEPT
│   │   ├── mcp-orchestrator.ts                   # KEPT — used as convener dispatcher
│   │   ├── telegram-bot.ts                       # KEPT — Plan 09 intervention channel
│   │   ├── slack-bot.ts                          # KEPT — Plan 09 intervention channel
│   │   ├── tasmania-client.ts                    # KEPT (local models)
│   │   ├── obsidian-service.ts                   # KEPT
│   │   └── update-checker.ts                     # REBRANDED
│   ├── types/
│   │   ├── index.ts                              # EXTENDED — Season, Character, ReviewGate types
│   │   └── echelon.ts                            # NEW — domain types
│   ├── constants/
│   │   └── index.ts                              # REBRANDED paths (~/.echelon)
│   ├── providers/                                # KEPT (claude/codex/gemini/opencode/pi/local)
│   ├── resources/                                # REBRANDED
│   └── utils/
│       └── path-builder.ts                       # EXTENDED — season + character path helpers
│
├── src/team-factory/                             # ABSORBED from team-factory repo (Plan 01 layout)
│   ├── SKILL.md
│   ├── skill.yaml
│   ├── protocols/
│   ├── archetypes/                               # from Plan 02 (43 archetypes)
│   ├── themes/                                   # from Plan 02 (TBBT + Star Wars)
│   ├── composers/                                # from Plan 03
│   ├── capabilities/
│   ├── shared-skills/
│   └── counselor/                                # from Plan 08
│
├── build/                                        # ABSORBED from team-factory (Plan 01 layout)
│   ├── build.ts
│   ├── lib/
│   │   ├── skill-parser.ts
│   │   ├── schemas.ts
│   │   └── validators.ts
│   └── targets/
│       ├── claude-code.ts                        # from Plan 01
│       ├── openclaw.ts                           # from Plan 04
│       └── echelon.ts                            # NEW — this plan
│
├── adapters/                                     # ABSORBED from team-factory
│
├── dist/                                         # gitignored; build output
│   ├── claude-code/
│   ├── openclaw/
│   └── echelon/                                  # season pack bundle format
│
├── mcp-orchestrator/                             # KEPT
├── mcp-kanban/                                   # KEPT
├── mcp-vault/                                    # KEPT
├── mcp-telegram/                                 # KEPT
├── mcp-socialdata/                               # KEPT
├── mcp-x/                                        # KEPT
├── mcp-world/                                    # REMOVED (parked)
│
├── skills/
│   ├── remember.md                               # KEPT
│   └── world-builder/                            # REMOVED (parked)
│
├── hooks/                                        # KEPT
│
├── __tests__/
│   ├── electron/                                 # existing Dorothy tests
│   ├── renderer/                                 # existing Dorothy tests
│   ├── team-factory/                             # from Plan 01 + follow-ups
│   └── echelon/                                  # NEW — season/character/gate integration tests
│
├── docs/
│   ├── specs/                                    # ABSORBED from team-factory
│   ├── superpowers/
│   │   └── plans/                                # ABSORBED from team-factory (this file lives here)
│   ├── guides/                                   # NEW — Echelon user guides
│   └── architecture/                             # NEW — monorepo architecture overview
│
├── landing/                                      # REBRANDED
├── scripts/                                      # KEPT + extended for monorepo
├── public/                                       # KEPT + new Echelon assets
├── screenshots/                                  # REGENERATED
├── README.md                                     # REWRITTEN for Echelon
├── CLAUDE.md                                     # UPDATED
└── LICENSE                                       # KEPT
```

---

## 3. Implementation Phases

Phases are ordered to minimize the "broken mid-refactor" window. Phase A is the only irreversible one (repo rename) and has its own safety gate. All other phases land on feature branches and merge independently.

### Phase A — Repo absorption + rebrand scaffold

**Goal:** One repo, one name, both trees in place, nothing broken.

- [ ] **A.1** Create a new branch `feat/echelon-absorb` on the Dorothy fork.
- [ ] **A.2** Copy the entire `team-factory/` tree into the branch at the correct target locations:
  - `team-factory/docs/` → `docs/` (merging with any existing Dorothy `docs/`)
  - `team-factory/README.md` → `docs/architecture/team-factory-overview.md`
  - `team-factory/.gitignore` → merged into root `.gitignore`
  - Future Plan 01 output (`src/team-factory/`, `build/`, `adapters/`) — scaffolded as empty dirs with placeholder README.md explaining that Plan 01 populates them
- [ ] **A.3** Verify Dorothy still builds unchanged: `bun install && bun run electron:dev` starts the app. **This is the Phase A safety gate.** If the absorption broke anything, fix before proceeding.
- [ ] **A.4** Rebrand `package.json`: `"name": "echelon"`, `"productName": "Echelon"`, `"appId": "io.tf-echelon.app"`, `"publish.owner": "jediswimmer"`, `"publish.repo": "echelon"`.
- [ ] **A.5** Rebrand user-facing constants in `electron/constants/index.ts`: `DATA_DIR = ~/.echelon`, `AGENTS_FILE = ~/.echelon/agents.json`, etc.
- [ ] **A.6** Add a migration shim in `electron/main.ts` startup: if `~/.dorothy/` exists and `~/.echelon/` does not, copy the Dorothy data dir to Echelon and log a one-time notice. Keep the Dorothy dir intact for rollback.
- [ ] **A.7** Update `CLAUDE.md` at repo root to describe Echelon and reference `docs/specs/2026-04-08-factor-echelon-design.md`.
- [ ] **A.8** Rename the GitHub repo: `jediswimmer/Dorothy` → `jediswimmer/echelon`. (User action — see Open Questions §8.1.)
- [ ] **A.9** Update the remote in the local clone: `git remote set-url origin git@github.com:jediswimmer/echelon.git`.
- [ ] **A.10** Confirm the renamed app still launches and the Dashboard renders. Commit: `chore(echelon): absorb team-factory + rebrand`.

**Tests:** `bun run test` passes; `bun run electron:dev` launches the app and shows a window titled "Echelon".

---

### Phase B — Monorepo wiring (Bun workspaces)

**Goal:** `bun run` at the root can build any of: Echelon Electron app, factor-echelon skill bundle (Claude Code), factor-echelon skill bundle (OpenClaw), factor-echelon skill bundle (Echelon target).

- [ ] **B.1** Convert root `package.json` to a Bun workspace:
  ```json
  { "workspaces": ["build", "adapters/*", "mcp-*"] }
  ```
  The Electron renderer and main process stay rooted at the repo top (not in a workspace) because Next + electron-builder expect it.
- [ ] **B.2** Add root scripts:
  ```json
  {
    "skill:build": "bun run build/build.ts",
    "skill:build:claude-code": "bun run build/build.ts --target=claude-code",
    "skill:build:openclaw": "bun run build/build.ts --target=openclaw",
    "skill:build:echelon": "bun run build/build.ts --target=echelon",
    "skill:test": "bun test __tests__/team-factory",
    "echelon:dev": "bun run electron:dev",
    "echelon:build": "bun run electron:build",
    "dev": "bun run skill:build:echelon && bun run echelon:dev"
  }
  ```
- [ ] **B.3** Verify Plan 01 build still runs from the new root location. (If Plan 01 has not yet been executed, instead scaffold a stub `build/build.ts` that echoes its target and exits 0, so CI stays green.)
- [ ] **B.4** Add a Biome config at root that lints both `electron/`, `src/`, and `build/` under consistent rules.
- [ ] **B.5** Update `.github/workflows/pr.yml` to run three jobs in parallel: (a) skill build matrix across all targets, (b) Electron render lint + vitest, (c) electron-builder dry-run to catch packaging regressions.

**Tests:** `bun run skill:build:echelon` exits 0 (stub or real). `bun run echelon:dev` launches. CI pr.yml is green.

---

### Phase C — Season model in Electron main

**Goal:** The main process can load, spawn, persist, and archive a season.

- [ ] **C.1** Add season types to `electron/types/echelon.ts`:
  ```ts
  export interface Season {
    id: string;                    // slug: tbbt-s01
    name: string;                  // "Big Bang Alpha"
    theme: string;                 // "tbbt" | "star-wars" | custom
    status: 'spawning' | 'active' | 'paused' | 'archived' | 'restoring';
    rosterManifestPath: string;    // ~/.echelon/seasons/<id>/roster.manifest.yaml
    workspacePath: string;         // ~/.echelon/seasons/<id>/workspace
    characterIds: string[];        // references into agents map
    createdAt: string;
    archivedAt?: string;
  }
  export interface Character extends AgentStatus {
    seasonId: string;
    archetypeId: string;           // e.g. ingestion-pm
    soulPackagePath: string;       // ~/.echelon/seasons/<id>/characters/penny/
    canonName: string;             // "Penny", "Leonard"
    theme: string;
  }
  ```
- [ ] **C.2** Create `electron/core/season-manager.ts` modeled on `agent-manager.ts`:
  - In-memory map `seasons: Map<string, Season>`
  - `loadSeasons()` reads `~/.echelon/seasons/*/season.json`
  - `saveSeason(id)`, `spawnSeason(manifest)`, `archiveSeason(id)`, `restoreSeason(id)`, `expandSeason(id, archetypeId)`
  - Broadcast changes via `broadcastToAllWindows('season:updated', season)`
- [ ] **C.3** Create `electron/core/roster-manager.ts` that reads/writes the YAML roster manifest (Plan 03 schema) and is the only allowed mutator of the manifest file.
- [ ] **C.4** Create `electron/core/character-loader.ts` that, given a character directory, reads the 7-file soul package (SOUL.md, AGENTS.md, HEARTBEAT.md, MEMORY.md, USER.md, COMMITMENTS.md, DEPLOY-CHECKLIST.md) and returns a structured object. Uses `gray-matter` for frontmatter.
- [ ] **C.5** Extend `electron/core/agent-manager.ts` to accept a `seasonId` + `soulPackagePath` on spawn. When present, `character-loader` reads the soul package and injects SOUL.md + AGENTS.md into the agent's system prompt via `--append-system-prompt-file`. The existing `skills` array is augmented with the character's declared capabilities.
- [ ] **C.6** Wire `main.ts` to initialize `season-manager` after `agent-manager`. Load existing seasons at startup. Broadcast initial state.
- [ ] **C.7** Add unit tests: spawn a fixture season from a sample manifest, verify character agents are registered and soul packages load.

**Tests:** `bun test __tests__/echelon/season-manager.test.ts` green with fixture manifests.

---

### Phase D — Character = Agent++ extension & persistence

**Goal:** Characters persist across restarts carrying their soul package, and `agents.json` gains a season pointer without breaking existing Dorothy agents.

- [ ] **D.1** Migrate `AgentStatus` to be a *base type*; `Character` extends it. Dorothy agents without a `seasonId` continue to work unchanged (backward compatible).
- [ ] **D.2** Update `saveAgents()` / `loadAgents()` in `agent-manager.ts` to persist the extra character fields.
- [ ] **D.3** Update the renderer `AgentList/` component: if an agent has a `seasonId`, render it with a `ThemeBadge` and link to the season detail; otherwise render as a standalone agent.
- [ ] **D.4** Add a "Promote to season" action in the standalone agent UI for Dorothy-era agents who want to adopt a soul package retroactively.
- [ ] **D.5** Ensure the existing `worktreePath` + `branchName` fields on `AgentStatus` continue to work — they are the foundation for the per-character worktrees that Plan 05 requires.

**Tests:** Load existing Dorothy `agents.json`, verify no crash; spawn a character, verify it persists and reloads with its soul package.

---

### Phase E — Echelon build target (`build/targets/echelon.ts`)

**Goal:** `bun run skill:build:echelon` produces `dist/echelon/` that Echelon can load as a season pack.

- [ ] **E.1** Define the Echelon season pack schema in `src/team-factory/protocols/echelon-pack-schema.yaml`:
  ```
  echelon-pack/
  ├── pack.yaml                  # pack metadata (theme, version, archetypes included)
  ├── roster.manifest.yaml       # default roster for this theme (Medium tier by default)
  ├── characters/                # one subdir per character with full soul package
  ├── shared-skills/             # skills callable by any character
  ├── review-gates/              # gate definitions + scripts
  ├── counselor/                 # placement templates
  └── theme/                     # theme metadata + assets (colors, icons, character portraits)
  ```
- [ ] **E.2** Implement `build/targets/echelon.ts` mirroring the structure of `claude-code.ts` and `openclaw.ts`:
  - Read the parsed skill AST
  - For each character in a theme, copy the 7-file soul package
  - Emit `pack.yaml` with version + theme + archetype list
  - Emit `roster.manifest.yaml` from `src/team-factory/themes/<theme>/default-roster.yaml`
  - Copy shared skills, review gates, counselor templates, theme assets
- [ ] **E.3** Add parity tests in `__tests__/team-factory/target-parity.test.ts`: the three targets must ship equivalent character content (same soul packages, same capability declarations).
- [ ] **E.4** Run `bun run skill:build:echelon` locally and confirm `dist/echelon/tbbt/` is a loadable season pack.

**Tests:** Parity test green. `dist/echelon/tbbt/pack.yaml` exists and validates against `echelon-pack-schema.yaml`.

---

### Phase F — Renderer: `src/app/seasons/`

**Goal:** The Echelon UI has a Seasons-first navigation and the full season detail view.

- [ ] **F.1** Create `src/app/seasons/page.tsx` — list view: one card per season, showing theme badge, status, character count, last activity, review-gate progress bar.
- [ ] **F.2** Create `src/app/seasons/new/page.tsx` — wizard that runs the Plan 07 OOBE state machine in-app: pick theme → pick tier → drop in PRD → preview composed roster → confirm → spawn. Uses IPC `season:spawn`.
- [ ] **F.3** Create `src/app/seasons/[seasonId]/page.tsx` — detail view with tabs: Roster, Review Gates, Expansions, Manifest, Counselor, Settings.
- [ ] **F.4** Build the `RosterGrid` component: characters arranged by archetype, drag-and-drop to re-assign work, click to open `CharacterDrawer` showing the full 7-file soul package.
- [ ] **F.5** Build the `ExpansionProposalCard` component: when Leonard proposes a new archetype, user sees name, rationale, cost estimate, accept/reject buttons.
- [ ] **F.6** Build the `RosterManifestViewer` — read-only YAML render with syntax highlighting and a "download" action.
- [ ] **F.7** Add `src/app/seasons/[seasonId]/characters/[characterId]/page.tsx` as a deep-linked character detail page (for tray panel quick access).
- [ ] **F.8** Update top-level navigation in `ClientLayout.tsx`: Seasons becomes the primary tab, Agents moves into a "Power Tools" submenu.
- [ ] **F.9** Wire IPC: all season operations go through `window.api.season.*` preload bindings to `electron/handlers/season-handlers.ts`.

**Tests:** Manual smoke test in `bun run echelon:dev`: create a season from the TBBT fixture pack, verify the grid renders all characters, open a character drawer, confirm all 7 soul files display.

---

### Phase G — Review gates ↔ Kanban mapping

**Goal:** The 7 review gates from Plan 05 run in parallel and display as a Kanban board, with Leonard as the merge authority.

- [ ] **G.1** Extend `mcp-kanban/` to support a "review-gate" column type. Each gate is a column: `security`, `tests`, `design`, `performance`, `docs`, `accessibility`, `refinement`.
- [ ] **G.2** Create `electron/core/review-gate-runner.ts`: given a character's diff and the 7 gate definitions, run them in parallel via `child_process` / `bun subprocess`, collect outputs, post results to the kanban board as card comments.
- [ ] **G.3** When a character submits work, `review-gate-runner` posts a card to the "Pending Gates" column, fans out to the 6 parallel gates, then moves to "Refinement" after all pass, and finally "Merged" when Leonard executes the serialized merge.
- [ ] **G.4** Build the `ReviewGateBoard` component as a themed wrapper around the existing `KanbanBoard` that hard-codes the gate columns and color-codes failures.
- [ ] **G.5** Surface gate status on the `SeasonCard` and in the tray panel badge (red dot if any gate failed, amber if in progress, green if all clear).
- [ ] **G.6** Integration test: spawn a fixture character, submit a fixture diff, verify all 6 parallel gates run and the card advances.

**Tests:** `__tests__/echelon/review-gates.test.ts` covers happy path, one failing gate, all failing, and Leonard merge arbitration.

---

### Phase H — mempalace backend + memory dashboard retheme

**Goal:** factor-echelon's KB interface (Plan 06) is backed by mempalace (single backend, per user decision in §8.4). Dorothy's existing memory-service dashboard UI is re-skinned and re-wired to display mempalace data — the visual language Scott likes from Dorothy is preserved, but the data model underneath is entirely mempalace.

**Rationale:** Dorothy's memory page has a polished visual surface (cards, timeline, search, filter). Rather than building a new mempalace dashboard from scratch, Plan 11 re-points Dorothy's memory view at mempalace queries. The `memory-service.ts` is demoted to an internal client-style wrapper; vault-db remains for artifact storage only.

- [ ] **H.1** Consume the KB interface contract from `src/team-factory/shared-skills/kb-interface/interface.ts` (authored in Plan 06).
- [ ] **H.2** Create `electron/services/mempalace-client.ts` — thin wrapper around the mempalace Python CLI / MCP with process supervision, health checks, and reconnect on failure. This is the **only** KB backend.
- [ ] **H.3** Create `electron/services/kb-bridge.ts` — implements the KB interface on top of `mempalace-client.ts`. Single backend, no selection logic. Exposes `query(tags, semantic)`, `write(entry)`, `promote(skillId)`, `audit(event)`.
- [ ] **H.4** Retire the legacy Dorothy `memory-service.ts` KV store: either delete or reduce it to a deprecated passthrough that warns on use. Existing `~/.dorothy/memory/` data is read-only imported into mempalace during the migration shim (Phase A.6).
- [ ] **H.5** Reskin `src/app/memory/`:
  - Rename route display to "Knowledge Base" (internal route stays `/memory` for backward compat)
  - Rewire the existing card grid, timeline, and search UI to call `window.api.kb.*` instead of `window.api.memory.*`
  - Add mempalace-native affordances to the existing UI: tag filter chips (mempalace tags), semantic search bar (ChromaDB-backed), skill-promotion badge overlay, audit-log tab
  - Preserve Dorothy's card component visual language (spacing, typography, color) — only swap the data shape
  - Add a "backend status" indicator in the header showing mempalace connection health
- [ ] **H.6** Rewire `electron/handlers/memory-handlers.ts` to `kb:query`, `kb:write`, `kb:promote-skill`, `kb:audit` IPC routes that route through `kb-bridge.ts`. Keep the old `memory:*` IPC names as deprecated aliases for one release cycle.
- [ ] **H.7** Settings page: add `src/app/settings/kb/page.tsx` to configure the mempalace instance (local process path, optional remote URL for team mode v0.5), test the connection, and show chromadb stats.
- [ ] **H.8** Update `src/components/Memory/` components (cards, timeline, search) to accept mempalace's richer data model (tags, embeddings score, skill promotion state, audit metadata). Old Dorothy-style string-only entries gracefully degrade.

**Tests:**
- mempalace backend conforms to the KB interface contract suite
- Memory/KB dashboard renders mempalace fixtures end-to-end
- Migration shim: importing a fixture `~/.dorothy/memory/` dir into mempalace produces queryable results
- Backend status indicator correctly reports connect/disconnect/reconnect cycles

---

### Phase I — Counselor service (`counselor-service.ts`)

**Goal:** A character can invoke the 4-model Counselor council and get a consensus verdict stored in the KB.

- [ ] **I.1** Create `electron/services/counselor-service.ts` that takes a placement (`skill-promotion` | `design-review` | `deadlock-escalation` | `adversarial`), a context bundle, and the keychain-stored API keys, then fans out to Gemini Pro, GPT-5, Claude Opus 4.6, and Grok in parallel.
- [ ] **I.2** Store API keys via Electron's `safeStorage` API (macOS Keychain-backed). Add `src/app/settings/counselor/page.tsx` for entry + validation.
- [ ] **I.3** Apply placement-specific consensus rules from Plan 08 (e.g. design-review = majority, adversarial = any red flag vetoes).
- [ ] **I.4** Write the verdict to the KB bridge (Phase H) tagged with the placement and the originating character.
- [ ] **I.5** Surface the verdict in the UI as a `CounselorVerdict` component on the season detail "Counselor" tab.
- [ ] **I.6** Wire the IPC: `counselor:invoke` → `counselor-handlers.ts` → `counselor-service.ts`.

**Tests:** Mock API responses, verify parallel dispatch, verify consensus rules per placement, verify KB write.

---

### Phase J — Convener (Super Agent repurpose)

**Goal:** Dorothy's Super Agent becomes the per-season Convener character (Stephen Hawking for TBBT, Yoda for Star Wars), with authority to dispatch the Counselor.

- [ ] **J.1** Tag the existing Super Agent archetype with a `role: convener` capability in its soul package.
- [ ] **J.2** On season spawn, instantiate the convener automatically from the theme's designated character (TBBT → Stephen Hawking, Star Wars → Yoda, custom → user picks).
- [ ] **J.3** Extend `mcp-orchestrator` with a `counselor:invoke` tool that the convener can call. The existing Super Agent Telegram/Slack integration carries Counselor verdicts back to the user verbatim.
- [ ] **J.4** Update the Super Agent system prompt template to include the convener runbook: when to convene (from Plan 08 triggers), how to build the context bundle, how to present the verdict.
- [ ] **J.5** UI: the season detail view shows a "Convener" panel that displays the active convener and a "Invoke Counselor" button gated by placement.

**Tests:** Spawn a TBBT fixture season, verify Stephen Hawking is instantiated as convener, trigger a mock skill-promotion event, verify Counselor is invoked and verdict surfaces.

---

### Phase K — UI retheme (Echelon brand)

**Goal:** Every user-visible surface says Echelon, looks like Echelon, and has no trace of the Dorothy brand.

- [ ] **K.1** Generate Echelon icon set (square + rounded + monochrome tray) via `compound-engineering:gemini-imagegen`. Store in `public/brand/`.
- [ ] **K.2** Run `generate-icon.js` (exists in Dorothy) adapted for the new mark.
- [ ] **K.3** Replace splash screen, landing page assets, and hero images in `landing/`.
- [ ] **K.4** Update `src/app/globals.css` palette to the Echelon colors defined in §1.2. Provide both light and dark themes; default to dark.
- [ ] **K.5** Find/replace all user-visible "Dorothy" strings across `src/`, `electron/`, `README.md`, `landing/`, `slide-deck/`. Preserve the `Charlie85270` git history attribution via a NOTICE file.
- [ ] **K.6** Rebrand `CLAUDE.md` files throughout the tree.
- [ ] **K.7** Regenerate `screenshots/*.png` after the retheme lands. Automated via Playwright MCP capturing seed seasons.
- [ ] **K.8** Update `whats-new/` with an Echelon launch note.
- [ ] **K.9** Update `README.md` top-to-bottom to describe Echelon (keeping parity of coverage with Dorothy's original — feature list, installation, architecture, screenshots).

**Tests:** Grep for case-insensitive "dorothy" in all user-visible code paths yields only git history / attribution. Manual visual inspection of every route in the app.

---

### Phase L — Park unused features

**Goal:** Clean removal with zero loss.

- [ ] **L.1** Create branch `parked/dorothy-legacy` from the pre-absorption commit.
- [ ] **L.2** On `main`: delete `mcp-world/`, `src/components/PokemonGame/`, `src/app/pallet-town/`, `skills/world-builder/`, `electron/handlers/world-handlers.ts`, and wire removals out of `main.ts` + IPC registration + preload.
- [ ] **L.3** Update `package.json` scripts that referenced removed directories.
- [ ] **L.4** Document the parking in `docs/architecture/parked-features.md` with cherry-pick instructions for anyone who wants them back.

**Tests:** `bun run test` + `bun run echelon:dev` both pass; no dangling imports.

---

### Phase M — Amendments to existing plans

**Goal:** Plans 05, 07, 08, 09, and 10 reference Echelon as the host platform, not generic Claude Code slash commands. This phase **does not modify those plans directly** — it produces a diff/amendment document that the next session can apply.

- [ ] **M.1** Write `docs/superpowers/plans/2026-04-08-plan-11-amendments.md` listing per-plan the sections that change:
  - Plan 05 §X (Season runtime): replace "host platform channel posts" with "Echelon `season:spawn` IPC"
  - Plan 06 §Y (KB): mempalace becomes one of two backends behind `kb-bridge.ts`
  - Plan 07 §Z (OOBE): the state machine runs in `src/app/seasons/new/` wizard instead of CLI prompts
  - Plan 08 §W (Counselor): API keys come from Electron `safeStorage`
  - Plan 09 §V (Intervention): CLI commands become IPC + tray menu + Telegram/Slack handlers that already exist in Dorothy
  - Plan 10 §U (Release): electron-builder produces `Echelon.app` as a v0.1 artifact in addition to the skill bundles
- [ ] **M.2** Open a tracking issue on the repo referencing each amendment.
- [ ] **M.3** Leave the original plan files untouched — the amendments document is additive so nothing is lost.

**Tests:** Amendments doc renders in markdown, all cross-references resolve.

---

## 4. Impact on Existing Plans (summary)

| Plan | Status after Plan 11 |
|---|---|
| 01 Foundation | **Unchanged.** Lives in `src/team-factory/` + `build/` at the monorepo root. |
| 02 Content Library | **Unchanged.** Populates `src/team-factory/themes/` + `src/team-factory/archetypes/`. |
| 03 Composition Engine | **Unchanged.** Composer runs the same way; Echelon consumes its output. |
| 04 OpenClaw Adapter | **Unchanged.** OpenClaw target continues to build to `dist/openclaw/`. |
| 05 Season Runtime | **Amended (Phase M).** Season lifecycle moves into `electron/core/season-manager.ts`; worktrees reuse Dorothy's existing worktree support; gates run via `review-gate-runner.ts`. |
| 06 Knowledge Base | **Amended (Phase M).** mempalace is one of two KB backends behind `kb-bridge.ts`; the other is Dorothy's memory-service + vault-db. |
| 07 OOBE + Ingestion | **Amended (Phase M).** State machine runs as an Electron wizard route, not CLI prompts. Penny's PRD ingestion unchanged. |
| 08 Counselor | **Amended (Phase M).** API keys via Electron `safeStorage`; dispatch from `counselor-service.ts`. Logic unchanged. |
| 09 User Intervention | **Amended (Phase M).** CLI commands become IPC + tray + chat bot channels. Audit logging via KB bridge. |
| 10 Integration + Release | **Amended (Phase M).** electron-builder adds `Echelon.app` to the v0.1 release matrix. Skill bundle releases unchanged. |

---

## 5. Tests & Validation

### 5.1 Unit tests

- `__tests__/echelon/season-manager.test.ts` — spawn, archive, restore, expand
- `__tests__/echelon/character-loader.test.ts` — reads 7-file soul packages, validates frontmatter
- `__tests__/echelon/roster-manager.test.ts` — manifest CRUD, schema validation
- `__tests__/echelon/review-gates.test.ts` — parallel dispatch, failure handling, Leonard arbitration
- `__tests__/echelon/kb-bridge.test.ts` — both backends conform to the KB interface
- `__tests__/echelon/counselor-service.test.ts` — placement-specific consensus rules
- `__tests__/team-factory/target-parity.test.ts` — Echelon target matches Claude Code and OpenClaw content

### 5.2 Integration tests

- **End-to-end fixture season:** Create a minimal TBBT season from a fixture manifest, spawn 3 characters, have one submit a diff, run all 6 gates, merge via Leonard, verify the KB captured the learning.
- **OOBE wizard:** Run through `src/app/seasons/new/` with a canned PRD, verify Penny ingestion and initial roster composition.
- **Counselor invocation:** Mock the 4 model APIs, trigger a skill-promotion event, verify consensus and KB write.
- **Migration shim:** Copy a fixture `~/.dorothy/` dir, launch Echelon, verify it migrates to `~/.echelon/` and the existing agents load.

### 5.3 Smoke matrix

| Target | Command | Pass condition |
|---|---|---|
| Claude Code skill bundle | `bun run skill:build:claude-code` | Exits 0, `dist/claude-code/` validates |
| OpenClaw skill bundle | `bun run skill:build:openclaw` | Exits 0, `dist/openclaw/` validates |
| Echelon season pack | `bun run skill:build:echelon` | Exits 0, `dist/echelon/tbbt/` loads in app |
| Echelon dev launch | `bun run echelon:dev` | Window opens, Seasons tab renders |
| Echelon packaged build | `bun run echelon:build` | Produces signed `Echelon.app` |

### 5.4 Manual QA

A checklist run on a fresh macOS user account covering: first-run OOBE, TBBT fixture spawn, character drawer interaction, review gate failure visualization, Counselor invocation with real keys, Telegram intervention, archive + restore.

---

## 6. Risks & Rollback

### 6.1 Risks

1. **Bun workspace + Next 16 + Electron 33 toolchain conflict.** Mitigation: Phase A safety gate (A.3) catches this before absorption commits; fallback to Option A (dual repo).
2. **electron-builder packaging breaks after rebrand.** Mitigation: CI `release-echelon.yml` runs a dry-run on every PR.
3. **Migration shim loses user data.** Mitigation: shim copies, never moves; Dorothy dir stays intact until the user explicitly deletes it; a "revert to Dorothy" escape hatch is documented.
4. **Scope creep into UI perfectionism.** Mitigation: Phase K has a hard checklist; retheme lands as a single PR, no unbounded iteration.
5. **Mid-refactor main branch breakage.** Mitigation: every phase lands on its own feature branch, gated by the Phase A safety gate.
6. **Plans 05/06/07/09 still assume the old host.** Mitigation: Phase M produces the amendments doc; the next execution session reads it alongside the original plans.

### 6.2 Rollback strategy

- Phase A through L all live on `feat/echelon-*` branches. Any phase can be reverted with `git revert` without affecting the others.
- `parked/dorothy-legacy` branch preserves every Dorothy feature at the pre-absorption commit.
- The `~/.dorothy/` data dir is never mutated — users can reinstall Dorothy and pick up where they left off if they abandon Echelon.
- The GitHub repo rename is reversible within 90 days via GitHub's UI.

---

## 7. Acceptance Criteria (for plan completion)

- [ ] `github.com/jediswimmer/echelon` exists, contains the absorbed monorepo, and has green CI.
- [ ] `bun run dev` produces a running `Echelon.app` dev instance that loads a fixture TBBT season.
- [ ] `bun run skill:build:echelon` produces a valid `dist/echelon/tbbt/` season pack.
- [ ] The Seasons tab is the primary navigation; the character drawer shows all 7 soul files.
- [ ] The Review Gates board runs all 6 parallel gates on a fixture diff.
- [ ] A mocked Counselor invocation dispatches 4 calls and records a verdict in the KB.
- [ ] Telegram and Slack intervention still works end-to-end (regression parity with Dorothy).
- [ ] No user-visible string says "Dorothy" outside of git history / attribution.
- [ ] Amendments doc for Plans 05/06/07/08/09/10 is written and merged.
- [ ] README is rewritten for Echelon and screenshots are regenerated.

---

## 8. Open Questions — Resolved 2026-04-09

All blocking questions resolved by Scott on 2026-04-09. Non-blocking questions remain as noted.

### 8.1 Repo rename on GitHub — ✅ RESOLVED
**Decision:** Rename `jediswimmer/Dorothy` → `jediswimmer/echelon` as part of Phase A. Full brand alignment.

### 8.2 Bundle ID — ✅ RESOLVED
**Decision:** `io.tf-echelon.app` (short for "team factory echelon"). This is now reflected throughout the plan.

### 8.3 Auto-update publisher + signing — ✅ RESOLVED
**Decision:** Cloud builder setup. v0.1 macOS builds are **signed and notarized** via a cloud builder (electron-builder CI workflow). Publisher: `jediswimmer/echelon`. Implies Apple Developer ID setup, notarization credentials in GitHub Actions secrets. Phase A includes the cloud-builder scaffold; signing keys are added as a Phase A follow-up before first release.

### 8.4 mempalace — ✅ RESOLVED
**Decision:** mempalace is the **single KB backend**. Phase H is simplified to: `kb-bridge.ts` wraps only `mempalace-client.ts`; Dorothy's existing `memory-service.ts` is demoted and its data imported into mempalace via the Phase A migration shim. **However**, Dorothy's visual memory dashboard UI (cards, timeline, search) is **re-skinned and re-wired** to display mempalace data — the UI Scott likes from Dorothy is preserved, only the data model underneath becomes mempalace. See updated Phase H for details.

### 8.5 Counselor API access — ⏳ DEFERRED
Scott will provision API keys for Gemini Pro, GPT-5, Claude Opus 4.6, and Grok before Plan 07 OOBE Step 4 (Counselor key entry). Any missing key at execution time → that model falls back to a stub that logs and returns a pass-through vote, so the other three can still reach consensus. Not blocking for Phases A–L.

### 8.6 Parking scope — ✅ RESOLVED
**Decision:** Park all as proposed: `mcp-world/`, `src/components/PokemonGame/`, `src/app/pallet-town/`, `skills/world-builder/`, `electron/handlers/world-handlers.ts`. Scott confirmed he doesn't use these. For the record:

- **`mcp-world/`** — MCP sidecar exposing a generative Pokemon-style overworld (zones, NPCs, signs). Game content only.
- **`src/app/pallet-town/`** — Next.js route rendering the overworld with a Pokemon-inspired viewport.
- **`src/components/PokemonGame/`** — the React components that power the overworld (canvas, sprites, interactions).
- **`skills/world-builder/`** — a Claude skill that lets an agent design new zones via the `mcp-world` tools.
- **`electron/handlers/world-handlers.ts`** — IPC glue connecting the renderer to `mcp-world`.

These are charming but unrelated to operating a software development team. Parking them on `parked/dorothy-legacy` preserves them for cherry-pick if Scott ever wants a game mode back.

### 8.7 Sequencing with team-factory Plans 01–10 — ✅ RESOLVED
**Decision:** Path (b) — **Plan 11 Phase A–B first, then Plans 01–04 inside the monorepo, then Plan 11 Phase C–M.** This gives the cleanest monorepo home for every subsequent plan and lets the Echelon shell come to life before deep content work begins. See §9 for the final sequencing.

### 8.8 Custom theme content — ⏳ DEFERRED (not blocking)
TBBT + Young Sheldon remain the v0.1 headline theme per Plan 02. Star Wars stays stub. No change.

### 8.9 Tasmania / local models — ⏳ DEFERRED (not blocking)
Dorothy's `tasmania-client.ts` stays in the codebase and continues to work. Whether any v0.1 characters route to local models is a content decision made during Plan 02 execution — not a Plan 11 scope question.

### 8.10 Multi-user / team mode — ⏳ DEFERRED (v0.5)
Single-user desktop for v0.1 per Plan 06. Team mode + Azure backend is v0.5. Unchanged.

---

## 9. Sequencing summary

Assuming path (b) from §8.7:

```
Phase A  (absorb + rebrand scaffold)
  ↓
Phase B  (monorepo wiring)
  ↓
[Execute team-factory Plans 01–04 inside the monorepo]
  ↓
Phase C  (season model in Electron)
  ↓
Phase D  (character = agent extension)
  ↓
Phase E  (Echelon build target)  ─┐
Phase F  (renderer: seasons)      ├── can run in parallel
Phase G  (review gates)           │
Phase H  (KB bridge)              │
Phase I  (counselor service)     ─┘
  ↓
Phase J  (convener repurpose)
  ↓
Phase K  (UI retheme)
  ↓
Phase L  (park unused)
  ↓
Phase M  (plan amendments)
  ↓
[Execute team-factory Plan 05–10 with amendments]
  ↓
Echelon v0.1 alpha
```

---

## 10. Definition of Done

This plan is complete when:

1. `github.com/jediswimmer/echelon` hosts the absorbed monorepo.
2. `bun run dev` produces a running Echelon.app with a TBBT fixture season and all Phase C–J functionality working end-to-end.
3. All unit + integration tests in §5 are green in CI.
4. The amendments document for Plans 05–10 is merged.
5. The README, CLAUDE.md, and landing page describe Echelon, not Dorothy.
6. The Phase A safety gate, parked branch, and migration shim are all in place as rollback insurance.
7. Every open question in §8 has a recorded answer in a follow-up commit.

After Done, execution of the v0.1 alpha release waits only on Plans 05–10 running against the amended specs inside the Echelon monorepo.
