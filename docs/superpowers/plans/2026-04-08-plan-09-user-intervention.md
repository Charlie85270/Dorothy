# Plan 09: User Intervention + Multi-Season Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development or superpowers:executing-plans.

> **⚠ Plan 11 reconciliation note (added 2026-04-09):** Intervention surfaces are **Echelon IPC + tray menu + renderer actions** first, with Telegram and Slack bots as remote channels. Concretely: every intervention action is an IPC route under `electron/handlers/season-handlers.ts` or `electron/handlers/character-handlers.ts` (Plan 11 Phase C), exposed in the UI via `src/app/seasons/[seasonId]/` actions, the tray panel, and the Telegram/Slack bridges that already exist in Dorothy. Multi-season isolation is enforced by the Echelon season-manager (character-to-season binding) plus existing Dorothy per-agent project-path scoping. Audit logging routes through `electron/services/kb-bridge.ts` to mempalace (see Plan 06 + Plan 11 Phase H). Read Plan 11 Phase C, F, and H before executing Plan 09.

**Goal:** Ship the user intervention surface (§7.8), season teardown flows (§7.7), and multi-season operational model (§12.1 channel-per-season). After this plan, users can cancel/override/re-run operations from the Echelon UI or remote channels, uninstall cleanly, and run multiple seasons concurrently without cross-contamination.

**Architecture:** An **Electron IPC + renderer action + tray + remote-channel** layer that exposes every intervention point as a user action. Each action produces an audit log entry in mempalace via `kb-bridge.ts`. Multi-season isolation is enforced by the season-manager's capability binding (a character in Season 01 cannot touch Season 02's files). Telegram and Slack bridges carry the same intervention vocabulary for remote operation.

**Tech Stack:** Bun + TypeScript, **Electron IPC (`electron/handlers/`)**, Dorothy's existing Telegram + Slack bots (`electron/services/`), mempalace for audit logging via `kb-bridge.ts`.

**Spec reference:** §7.7 Uninstall/teardown/archival, §7.8 User intervention catalog, §12.1 multi-season multiplexing.

**Dependencies:** Plans 01-08 complete.

---

## File Structure

```
src/team-factory/
├── cli/
│   ├── SKILL.md                          # command dispatch
│   ├── commands/
│   │   ├── cancel.md
│   │   ├── override.md
│   │   ├── rerun.md
│   │   ├── scope.md
│   │   ├── kb.md
│   │   ├── season.md
│   │   ├── character.md
│   │   ├── counselor.md
│   │   └── uninstall.md

build/
├── cli/
│   ├── dispatch.ts                       # main entry point
│   ├── audit-log.ts                      # every intervention logged
│   └── commands/
│       ├── cancel.ts
│       ├── override.ts
│       ├── rerun.ts
│       ├── scope.ts
│       ├── kb.ts
│       ├── season.ts
│       ├── character.ts
│       ├── counselor.ts
│       └── uninstall.ts
│
└── multi-season/
    ├── channel-multiplex.ts              # per-season channel sets
    ├── isolation-enforcer.ts             # cross-season access prevention
    └── context-switcher.ts               # user's active-season state

tests/
└── integration/
    ├── intervention-cancel.test.ts
    ├── intervention-override.test.ts
    ├── intervention-rerun.test.ts
    ├── uninstall.test.ts
    └── multi-season.test.ts
```

---

## Task 1: CLI dispatch + audit log

**Files:**
- Create: `src/team-factory/cli/SKILL.md`
- Create: `build/cli/dispatch.ts`
- Create: `build/cli/audit-log.ts`

- [ ] **Step 1: Write `dispatch.ts`**

```typescript
// build/cli/dispatch.ts
export interface CLICommand {
  name: string;
  subcommand?: string;
  args: string[];
  flags: Record<string, string | boolean>;
  reason?: string;  // for override/force operations
}

export interface CLIResult {
  success: boolean;
  output: string;
  auditId: string;
}

type CommandHandler = (cmd: CLICommand) => Promise<CLIResult>;

const HANDLERS: Record<string, CommandHandler> = {
  "cancel": handleCancel,
  "override": handleOverride,
  "rerun": handleRerun,
  "season": handleSeason,
  "character": handleCharacter,
  "kb": handleKB,
  "counselor": handleCounselor,
  "uninstall": handleUninstall,
};

export async function dispatch(cmd: CLICommand): Promise<CLIResult> {
  const handler = HANDLERS[cmd.name];
  if (!handler) {
    return { success: false, output: `unknown command: ${cmd.name}`, auditId: "" };
  }
  const result = await handler(cmd);
  await logAudit(cmd, result);
  return result;
}

async function handleCancel(cmd: CLICommand): Promise<CLIResult> { /* implemented in Task 2 */ throw new Error("TBD"); }
async function handleOverride(cmd: CLICommand): Promise<CLIResult> { /* Task 3 */ throw new Error("TBD"); }
async function handleRerun(cmd: CLICommand): Promise<CLIResult> { /* Task 4 */ throw new Error("TBD"); }
async function handleSeason(cmd: CLICommand): Promise<CLIResult> { /* Task 5 */ throw new Error("TBD"); }
async function handleCharacter(cmd: CLICommand): Promise<CLIResult> { /* Task 6 */ throw new Error("TBD"); }
async function handleKB(cmd: CLICommand): Promise<CLIResult> { /* Task 7 */ throw new Error("TBD"); }
async function handleCounselor(cmd: CLICommand): Promise<CLIResult> { /* Task 8 */ throw new Error("TBD"); }
async function handleUninstall(cmd: CLICommand): Promise<CLIResult> { /* Task 9 */ throw new Error("TBD"); }
```

- [ ] **Step 2: Write `audit-log.ts`** — every intervention writes to mempalace audit hall

- [ ] **Step 3: Commit** — `feat(cli): add dispatch layer and audit log`

---

## Task 2: Cancel commands

Implements §7.8 cancellation/abort row:

- [ ] **Step 1: `cancel season <season-slug>`** — abort an in-progress season spawn, rollback any partial state
- [ ] **Step 2: `cancel task <task-id>`** — close worktree, mark task cancelled
- [ ] **Step 3: `cancel expansion`** — abort a pending mid-season expansion proposal
- [ ] **Step 4: `character pause <name>`** — halt a character's heartbeat

Each command is implemented, tested, committed separately.

---

## Task 3: Override commands

Implements §7.8 override/force row:

- [ ] **Step 1: `review override <task-id> <gate> --reason "..."`** — force-pass a review gate (requires reason, logged heavily in audit)
- [ ] **Step 2: `merge force <task-id> --reason "..."`** — bypass gates entirely
- [ ] **Step 3: `counselor override <verdict-id> --reason "..."`** — user decision wins over Counselor verdict
- [ ] **Step 4: `roster assign <character> <secondary-archetype>`** — add secondary role, shows warning if violates Wil-only exception

Each command tested + committed separately.

---

## Task 4: Re-run commands

- [ ] **Step 1: `season reingest <season>`** — re-run Penny's ingestion with updated PRD
- [ ] **Step 2: `review rerun <task-id> <gate>`** — re-execute a single gate, preserve other results
- [ ] **Step 3: `character recast <season> <archetype> <new-character>`** — swap character mid-season, preserve MEMORY/COMMITMENTS

---

## Task 5: Season commands

- [ ] **Step 1: `season new <description>`** — trigger Penny ingestion from CLI
- [ ] **Step 2: `season list`** — list active + archived seasons with state
- [ ] **Step 3: `season use <slug>`** — set default context for subsequent commands
- [ ] **Step 4: `season archive <slug>`** — move to archive (per §7.7 season archival)
- [ ] **Step 5: `season restore <slug>`** — reactivate archived season
- [ ] **Step 6: `season set-tier <slug> <tier>`** — adjust tier, triggers re-composition

---

## Task 6: Character commands

- [ ] **Step 1: `character add <season> <archetype>`** — manual roster addition
- [ ] **Step 2: `character remove <season> <character>`** — per §7.7 single-character removal flow with reassignment prompt

---

## Task 7: KB commands

- [ ] **Step 1: `kb delete <room-id> --reason "..."`** — quarantine a poisoned learning
- [ ] **Step 2: `kb promote <room-id>`** — private → team (team mode, v0.5+ but stub in v0.1)
- [ ] **Step 3: `kb demote <room-id>`** — team → private
- [ ] **Step 4: `kb export <path>`** — export to tar.gz
- [ ] **Step 5: `kb import <path>`** — restore from backup (with confirmation)

---

## Task 8: Counselor commands

- [ ] **Step 1: `counselor config --model <name> <new-version>`** — swap a model (see §13.10 Q4)
- [ ] **Step 2: `counselor budget`** — show cost budget usage this month
- [ ] **Step 3: `counselor history <placement>`** — query past verdicts from mempalace

---

## Task 9: Uninstall command

**Files:**
- Create: `build/cli/commands/uninstall.ts`
- Create: `tests/integration/uninstall.test.ts`

- [ ] **Step 1: Write `uninstall.ts`** implementing the full §7.7 uninstall flow

```typescript
export async function handleUninstall(cmd: CLICommand): Promise<CLIResult> {
  // Step 1: Confirm
  const confirmed = await confirmUninstall();
  if (!confirmed) return { success: false, output: "cancelled", auditId: "" };

  // Step 2: Offer KB export
  if (await promptYesNo("Export knowledge base before uninstall?")) {
    const exportPath = await promptString("Export path:");
    await exportKB(exportPath);
  }

  // Step 3: Offer config backup
  if (await promptYesNo("Backup config (seasons, advisory-board, config.yaml)?")) {
    const backupPath = await promptString("Backup path:");
    await backupConfig(backupPath);
  }

  // Step 4: Second confirmation
  if (!(await confirmUninstall("This is destructive. Last chance. Continue?"))) {
    return { success: false, output: "cancelled", auditId: "" };
  }

  // Step 5: Remove everything
  await removeFactorEchelonDir();
  await removeShellIntegration();
  await unregisterAdapterPlugins();  // Claude Code + OpenClaw
  await unregisterMempalaceMCP();
  await removeAPIKeysFromKeychain();

  // Step 6: Print recovery instructions
  console.log(`factor-echelon uninstalled. Recovery: reinstall and factor-echelon kb import ${exportPath}`);

  return { success: true, output: "uninstalled", auditId: "" };
}
```

- [ ] **Step 2: Integration test** with a fixture install

- [ ] **Step 3: Commit** — `feat(cli): add uninstall command with KB export and full cleanup`

---

## Task 10: Multi-season channel multiplexing

**Files:**
- Create: `build/multi-season/channel-multiplex.ts`
- Create: `build/multi-season/isolation-enforcer.ts`
- Create: `build/multi-season/context-switcher.ts`

- [ ] **Step 1: Write `channel-multiplex.ts`** — manages per-season channel sets

```typescript
export interface SeasonChannels {
  season_id: string;
  primary: string;          // #season01-pennys-apartment
  leonards_office: string;  // #season01-leonards-office
  review_gates: string;
  escalation: string;       // out-of-band
}

export function provisionChannels(seasonId: string, config: ChannelConfig): SeasonChannels { /* ... */ }
export function archiveChannels(channels: SeasonChannels): void { /* mark read-only, not delete */ }
```

- [ ] **Step 2: Write `isolation-enforcer.ts`** — runtime check that a character in Season A cannot access Season B's files

```typescript
export function enforceSeasonIsolation(
  operationSeasonId: string,
  targetPath: string
): { allowed: boolean; reason?: string } {
  // Parse targetPath for season context
  // Verify it matches operationSeasonId or is in the shared layers (advisory-board, team mempalace wing)
  // Deny + log if cross-season access attempted
}
```

- [ ] **Step 3: Write `context-switcher.ts`**

```typescript
// factor-echelon season use <slug> sets the default context
// Subsequent commands without --season flag use this default

const CONTEXT_FILE = "~/.factor-echelon/.context";

export function setActiveSeason(slug: string): void { /* write to CONTEXT_FILE */ }
export function getActiveSeason(): string | null { /* read from CONTEXT_FILE */ }
```

- [ ] **Step 4: Integration test with two concurrent seasons**

```typescript
test("E2E multi-season: two seasons run without cross-contamination", async () => {
  const tmpRoot = `/tmp/factor-echelon-test/${Math.random()}`;

  // Spawn two seasons
  const s1 = await spawnSeason({ slug: "project-alpha", theme: "tbbt", /* ... */, rootDir: tmpRoot });
  const s2 = await spawnSeason({ slug: "project-beta", theme: "star-wars", /* ... */, rootDir: tmpRoot });

  // Verify isolation: Penny in s1 cannot read s2's manifest
  const isolation = enforceSeasonIsolation(s1.seasonId, `${s2.path}/manifest.yaml`);
  expect(isolation.allowed).toBe(false);

  // Verify shared layer access: both seasons can consult the advisory board
  const advisoryAccess1 = enforceSeasonIsolation(s1.seasonId, `${tmpRoot}/advisory-board/stephen-hawking/SOUL.md`);
  expect(advisoryAccess1.allowed).toBe(true);
  const advisoryAccess2 = enforceSeasonIsolation(s2.seasonId, `${tmpRoot}/advisory-board/stephen-hawking/SOUL.md`);
  expect(advisoryAccess2.allowed).toBe(true);

  // Verify context switching
  setActiveSeason(s1.seasonId);
  expect(getActiveSeason()).toBe(s1.seasonId);
  setActiveSeason(s2.seasonId);
  expect(getActiveSeason()).toBe(s2.seasonId);
});
```

- [ ] **Step 5: Commit** — `feat(multi-season): add channel multiplex, isolation enforcer, context switcher`

---

## Task 11: Verification + tag

- [ ] Full test run
- [ ] Tag `plan-09-complete`

---

## Plan 09 Complete

**What's shipped:**
- CLI dispatch layer with audit logging for every intervention
- All §7.8 intervention commands: cancel, override, rerun, scope, kb, season, character, counselor, uninstall
- §7.7 season archival/restore/character-removal flows
- Full uninstall flow with KB export, config backup, and cleanup
- Multi-season channel multiplexing (channel-per-season model)
- Cross-season isolation enforcer (runtime capability check)
- User context switcher for active-season state
- Multi-season E2E integration test

**What's next:** Plan 10 — Integration + Release (E2E harness, docs, release runbook, v0.1 shippable).
