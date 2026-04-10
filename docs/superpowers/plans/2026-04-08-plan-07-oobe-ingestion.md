# Plan 07: OOBE + Ingestion + Expansion Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development or superpowers:executing-plans.

> **⚠ Plan 11 reconciliation note (added 2026-04-09):** The OOBE state machine in this plan runs as an **Echelon Electron wizard route** at `src/app/seasons/new/` (Plan 11 Phase F), not as Claude Code slash commands or OpenClaw channel posts. Each OOBE step is a screen in the wizard; the state machine persists between screens via IPC to `electron/handlers/season-handlers.ts`. Counselor API keys are stored via Electron's `safeStorage` API (macOS Keychain-backed), set up in `src/app/settings/counselor/page.tsx`. Telegram and Slack bots continue to act as *remote intervention* channels during and after OOBE but are no longer the primary OOBE surface. Penny's ingestion protocol and Leonard's expansion flow are unchanged — only the *surface* changes. Claude Code and OpenClaw adapters retain CLI-style OOBE for portability. Read Plan 11 Phase F before executing Plan 07.

**Goal:** Ship the user-facing first-run experience and the full ingestion-to-expansion pipeline. After this plan, a user can launch Echelon.app (or run `/factor-echelon init` in the Claude Code / OpenClaw adapters), complete OOBE, drop a PRD, and get a live themed team that will grow as needed.

**Architecture:** Implements the 8-step OOBE state machine (§7.2a) as an **Echelon Next.js wizard** under `src/app/seasons/new/`, Penny's full ingestion protocol with the malformed-PRD refinement loop (§8.3), Leonard's handoff + continuous expansion (§7.5) with user-visible proposal flow in the Echelon Seasons tab.

**Tech Stack:** Bun + TypeScript, **Electron `safeStorage` (macOS Keychain)** for Counselor API keys, Next.js wizard routes for the primary surface. Claude Code slash commands and OpenClaw channel posts remain supported as secondary portability surfaces.

**Spec reference:** §7.2 OOBE, §7.2a OOBE state machine, §7.3 new season flow, §7.5 continuous expansion, §8.3 ingestion failures, §7.8 user intervention catalog (related).

**Dependencies:** Plans 01-06 complete.

---

## File Structure

```
src/team-factory/
└── oobe/
    ├── SKILL.md                          # top-level OOBE orchestrator
    ├── state-machine.md                  # formal state machine definition
    ├── steps/
    │   ├── 01-platform-prereqs.md
    │   ├── 02-user-profile-interview.md
    │   ├── 03-theme-selection.md
    │   ├── 04-counselor-api-keys.md
    │   ├── 05-kb-mode-selection.md
    │   ├── 06-mempalace-init.md
    │   ├── 07-advisory-board-provisioning.md
    │   └── 08-channel-config.md
    ├── user-profile-interview.md
    └── deploy-checklist-generator.md

build/
├── oobe/
│   ├── state-machine.ts                  # resumable state machine engine
│   ├── steps/
│   │   ├── platform-prereqs.ts
│   │   ├── user-profile-interview.ts
│   │   ├── theme-selection.ts
│   │   ├── counselor-api-keys.ts         # OS keychain integration
│   │   ├── kb-mode-selection.ts
│   │   ├── mempalace-init.ts
│   │   ├── advisory-board-provisioning.ts
│   │   └── channel-config.ts
│   └── keychain.ts                       # macOS Keychain / Linux Secret Service / Windows CredMgr
│
├── ingestion/
│   ├── prd-refinement-loop.ts            # malformed-PRD interactive loop
│   ├── season-spawn.ts                   # Penny's full ingestion protocol
│   └── handoff.ts                        # Leonard handoff artifact writer
│
└── expansion/
    ├── gap-detection.ts                  # Leonard's gap signals
    ├── proposal-flow.ts                  # user-visible expansion proposal
    └── mid-season-spawn.ts               # add character to live team

tests/
└── integration/
    ├── oobe-e2e.test.ts
    ├── ingestion-e2e.test.ts
    └── expansion-e2e.test.ts
```

---

## Task 1: OOBE state machine engine

**Files:**
- Create: `src/team-factory/oobe/SKILL.md`
- Create: `src/team-factory/oobe/state-machine.md`
- Create: `build/oobe/state-machine.ts`

- [ ] **Step 1: Write `state-machine.md`** formalizing the 8-step state machine from §7.2a. Include:
  - State diagram
  - Checkpoint names
  - Resume semantics
  - Skip rules per step

- [ ] **Step 2: Write `state-machine.ts`**

```typescript
// build/oobe/state-machine.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { load as yamlLoad, dump as yamlDump } from "js-yaml";

export type OOBEStepId =
  | "PLATFORM_PREREQS"
  | "USER_PROFILE_INTERVIEW"
  | "THEME_SELECTION"
  | "COUNSELOR_API_KEYS"
  | "KB_MODE_SELECTION"
  | "MEMPALACE_INIT"
  | "ADVISORY_BOARD_PROVISIONING"
  | "CHANNEL_CONFIG";

export interface OOBEStep {
  id: OOBEStepId;
  mandatory: boolean;
  run: (ctx: OOBEContext) => Promise<void>;
}

export interface OOBEContext {
  rootDir: string;
  state: Record<string, any>;
  checkpoints: Set<OOBEStepId>;
}

const STEPS_ORDER: OOBEStepId[] = [
  "PLATFORM_PREREQS",
  "USER_PROFILE_INTERVIEW",
  "THEME_SELECTION",
  "COUNSELOR_API_KEYS",
  "KB_MODE_SELECTION",
  "MEMPALACE_INIT",
  "ADVISORY_BOARD_PROVISIONING",
  "CHANNEL_CONFIG",
];

export async function runOOBE(rootDir: string, steps: Record<OOBEStepId, OOBEStep>, options: { forceReset?: boolean } = {}): Promise<void> {
  mkdirSync(rootDir, { recursive: true });
  const statePath = join(rootDir, ".oobe-state");

  if (options.forceReset && existsSync(statePath)) {
    // Archive old state
    const archivePath = `${statePath}.archived-${Date.now()}`;
    writeFileSync(archivePath, readFileSync(statePath));
  }

  const ctx: OOBEContext = {
    rootDir,
    state: existsSync(statePath) && !options.forceReset ? (yamlLoad(readFileSync(statePath, "utf-8")) as any).state ?? {} : {},
    checkpoints: new Set(
      existsSync(statePath) && !options.forceReset ? (yamlLoad(readFileSync(statePath, "utf-8")) as any).checkpoints ?? [] : []
    ),
  };

  for (const stepId of STEPS_ORDER) {
    if (ctx.checkpoints.has(stepId)) {
      console.log(`[oobe] ${stepId} already complete, skipping`);
      continue;
    }
    console.log(`[oobe] running ${stepId}`);
    try {
      await steps[stepId].run(ctx);
      ctx.checkpoints.add(stepId);
      persistState(statePath, ctx);
    } catch (e) {
      const mandatory = steps[stepId].mandatory;
      if (mandatory) {
        console.error(`[oobe] MANDATORY step ${stepId} failed: ${(e as Error).message}`);
        throw e;
      }
      console.warn(`[oobe] optional step ${stepId} failed, continuing: ${(e as Error).message}`);
    }
  }

  // Write final config
  writeFileSync(
    join(rootDir, "config.yaml"),
    yamlDump({ completed_at: new Date().toISOString(), state: ctx.state })
  );
  console.log("[oobe] complete");
}

function persistState(path: string, ctx: OOBEContext): void {
  writeFileSync(path, yamlDump({ state: ctx.state, checkpoints: Array.from(ctx.checkpoints) }));
}
```

- [ ] **Step 3: Write integration test for state machine resume**

- [ ] **Step 4: Commit** — `feat(oobe): add resumable OOBE state machine engine`

---

## Task 2: OOBE Step implementations (8 steps)

Batch into groups of 2-3 for commit granularity:

- [ ] **Step 1: Platform prereqs + User profile interview**
  - `steps/platform-prereqs.ts` checks for git, bun, disk space, target platform
  - `steps/user-profile-interview.ts` collects name/timezone/role/team/channels/hardware
  - Commit: `feat(oobe): implement steps 1-2 (prereqs, profile interview)`

- [ ] **Step 2: Theme selection + Counselor API keys**
  - `steps/theme-selection.ts` presents the theme picker (TBBT default, Star Wars, custom-disabled)
  - `steps/counselor-api-keys.ts` collects 4 model API keys (Gemini, GPT-5, Opus, Grok), validates each with a tiny test call, stores in OS keychain via `keychain.ts`
  - **Important:** `counselor-api-keys.ts` must be SKIPPABLE per §7.2a (Counselor placements disabled until keys provided)
  - Commit: `feat(oobe): implement steps 3-4 (theme, Counselor API keys)`

- [ ] **Step 3: KB mode selection + mempalace init**
  - `steps/kb-mode-selection.ts` picks solo or team (team is v0.5+, just set the flag)
  - `steps/mempalace-init.ts` installs mempalace if needed, initializes at `~/.factor-echelon/knowledge-base/local/`, creates `kb-git/` mirror, registers MCP with target platform
  - Commit: `feat(oobe): implement steps 5-6 (KB mode, mempalace init)`

- [ ] **Step 4: Advisory board provisioning + channel config**
  - `steps/advisory-board-provisioning.ts` instantiates all 12 advisory board characters as soul packages under `~/.factor-echelon/advisory-board/`
  - `steps/channel-config.ts` configures Discord/Slack/Telegram bot tokens (skippable, deferred to first season if skipped)
  - Commit: `feat(oobe): implement steps 7-8 (advisory board, channels)`

---

## Task 3: OS keychain integration

**Files:**
- Create: `build/oobe/keychain.ts`

- [ ] **Step 1: Write `keychain.ts`** with platform detection

```typescript
// build/oobe/keychain.ts
import { spawnSync } from "node:child_process";
import { platform } from "node:os";

export interface Keychain {
  set(service: string, account: string, secret: string): void;
  get(service: string, account: string): string | null;
  delete(service: string, account: string): void;
}

export function getKeychain(): Keychain {
  const p = platform();
  if (p === "darwin") return new MacOSKeychain();
  if (p === "linux") return new LinuxSecretService();
  if (p === "win32") return new WindowsCredentialManager();
  throw new Error(`Unsupported platform for keychain: ${p}`);
}

class MacOSKeychain implements Keychain {
  set(service: string, account: string, secret: string): void {
    const result = spawnSync("security", [
      "add-generic-password",
      "-s", service,
      "-a", account,
      "-w", secret,
      "-U",  // update if exists
    ]);
    if (result.status !== 0) {
      throw new Error(`macOS Keychain set failed: ${result.stderr?.toString()}`);
    }
  }

  get(service: string, account: string): string | null {
    const result = spawnSync("security", ["find-generic-password", "-s", service, "-a", account, "-w"], {
      encoding: "utf-8",
    });
    return result.status === 0 ? result.stdout.trim() : null;
  }

  delete(service: string, account: string): void {
    spawnSync("security", ["delete-generic-password", "-s", service, "-a", account]);
  }
}

class LinuxSecretService implements Keychain { /* use secret-tool CLI */ /* ... */ }
class WindowsCredentialManager implements Keychain { /* use cmdkey or PowerShell */ /* ... */ }
```

- [ ] **Step 2: Test on available platform**

- [ ] **Step 3: Commit** — `feat(oobe): add cross-platform OS keychain integration`

---

## Task 4: Penny's full ingestion protocol

**Files:**
- Create: `build/ingestion/prd-refinement-loop.ts`
- Create: `build/ingestion/season-spawn.ts`
- Create: `build/ingestion/handoff.ts`

- [ ] **Step 1: Write `prd-refinement-loop.ts`**

Implements the malformed-PRD conversational refinement loop from §8.3:

```typescript
export interface PRDRefinementState {
  original_prd: string;
  clarifying_questions: string[];
  user_answers: Record<string, string>;
  confidence: number;  // 0-1
  iteration: number;
}

export async function refineUntilConfident(
  initialPRD: string,
  askUser: (questions: string[]) => Promise<Record<string, string>>
): Promise<{ refined: ParsedPRD; state: PRDRefinementState }> {
  let state: PRDRefinementState = {
    original_prd: initialPRD,
    clarifying_questions: [],
    user_answers: {},
    confidence: 0,
    iteration: 0,
  };

  while (state.confidence < 0.8 && state.iteration < 5) {
    state.iteration++;
    const assessment = assessPRD(initialPRD, state.user_answers);
    if (assessment.confidence >= 0.8) {
      return { refined: assessment.parsed, state };
    }
    const questions = generateClarifyingQuestions(initialPRD, assessment);
    const answers = await askUser(questions);
    state.user_answers = { ...state.user_answers, ...answers };
    state.clarifying_questions.push(...questions);
    state.confidence = assessment.confidence;
  }

  if (state.confidence < 0.8) {
    throw new Error("Unable to reach scoping confidence after 5 refinement iterations; escalate to user manually");
  }

  return { refined: assessPRD(initialPRD, state.user_answers).parsed, state };
}

function assessPRD(prd: string, answers: Record<string, string>): { confidence: number; parsed: ParsedPRD } { /* ... */ }
function generateClarifyingQuestions(prd: string, assessment: any): string[] { /* ... */ }
```

- [ ] **Step 2: Write `season-spawn.ts`** — Penny's full ingestion protocol

This orchestrates:
1. PRD refinement (Task 4 step 1)
2. Query mempalace for prior art (via knowledge-retrieval skill)
3. Compose initial roster (via Plan 03 roster-composer)
4. Map to characters (via Plan 03 theme-engine)
5. Bind capabilities (via Plan 03 capability-resolver)
6. Spawn season (via Plan 05 season-manager)
7. Write manifest (hand off artifact)
8. Post handoff to Leonard's channel

- [ ] **Step 3: Write `handoff.ts`** — builds the Season Manifest artifact

- [ ] **Step 4: Integration test**

```typescript
test("E2E ingestion: drop PRD → get live season", async () => {
  const tmpRoot = `/tmp/factor-echelon-test/${Math.random()}`;
  // ... setup OOBE state minimal
  const result = await pennyIngest({
    prdPath: "tests/fixtures/prds/medium-saas.md",
    theme: "tbbt",
    rootDir: tmpRoot,
    askUser: async (qs) => ({ "what platform?": "web", /* ... */ }),
  });
  expect(result.success).toBe(true);
  expect(existsSync(`${tmpRoot}/seasons/season-01-*/manifest.yaml`)).toBe(true);
});
```

- [ ] **Step 5: Commit** — `feat(ingestion): add Penny's full ingestion protocol with PRD refinement`

---

## Task 5: Leonard's continuous expansion

**Files:**
- Create: `build/expansion/gap-detection.ts`
- Create: `build/expansion/proposal-flow.ts`
- Create: `build/expansion/mid-season-spawn.ts`

- [ ] **Step 1: Write `gap-detection.ts`** — implements the signals from §7.5:
  - New user request requires role not on team
  - Existing character escalates "outside my scope"
  - Quality gate reveals missing review type
  - New platform target introduced
  - Scope change pushes project into next tier
  - "Nobody owns it" cross-cutting concern detected

- [ ] **Step 2: Write `proposal-flow.ts`** — user-visible proposal flow from §7.5 step 2

```typescript
export interface ExpansionProposal {
  archetype: string;
  rationale: string;
  split_trigger: string;
  suggested_character: string;
  estimated_impact: string;
}

export interface ProposalDecision {
  decision: "approve" | "reject" | "alternative";
  reason?: string;
  alternative_archetype?: string;
}

export async function presentProposal(
  proposal: ExpansionProposal,
  channelPost: (msg: string, buttons: string[]) => Promise<string>,
  timeout: number = 24 * 60 * 60 * 1000  // 24h
): Promise<ProposalDecision> {
  // Post proposal to Leonard's channel with ✅ / ❌ / 🔄 buttons
  // Wait for user action or timeout
  // On timeout, escalate via out-of-band channel (email/SMS)
  // Return decision
}
```

- [ ] **Step 3: Write `mid-season-spawn.ts`** — spawns new character into live season (reuses Plan 05 season-manager primitives)

- [ ] **Step 4: Integration test**

```typescript
test("E2E expansion: gap detected → proposal → approve → character joins", async () => {
  // ... setup live season
  const proposal = detectGap({ trigger: "ios_platform_added", existingRoster: [...] });
  const decision = await presentProposal(proposal, mockChannelPost, 1000);
  expect(decision.decision).toBe("approve");
  const spawn = await midSeasonSpawn(season, proposal);
  expect(spawn.success).toBe(true);
});
```

- [ ] **Step 5: Commit** — `feat(expansion): add Leonard's continuous expansion with user proposal flow`

---

## Task 6: OOBE E2E test

**Files:**
- Create: `tests/integration/oobe-e2e.test.ts`

- [ ] **Step 1: Write E2E test**

```typescript
test("E2E OOBE: full 8-step flow completes", async () => {
  const tmpRoot = `/tmp/factor-echelon-test/${Math.random()}`;
  const mockUser = {
    profile: { name: "Test User", timezone: "America/Los_Angeles", /* ... */ },
    theme: "tbbt",
    api_keys: { gemini: "stub", gpt5: "stub", opus: "stub", grok: "stub" },
    kb_mode: "solo",
    channels: {},
  };
  const result = await runOOBE(tmpRoot, makeStubSteps(mockUser));
  expect(existsSync(`${tmpRoot}/config.yaml`)).toBe(true);
  expect(existsSync(`${tmpRoot}/.oobe-state`)).toBe(true);
  expect(existsSync(`${tmpRoot}/knowledge-base/local/`)).toBe(true);
  expect(existsSync(`${tmpRoot}/advisory-board/`)).toBe(true);
});

test("E2E OOBE: resume after interruption", async () => {
  // Run OOBE halfway, then re-run; should pick up at next uncompleted step
});
```

- [ ] **Step 2: Commit** — `test(oobe): add E2E OOBE state machine tests`

---

## Task 7: Verification + tag

- [ ] **Step 1:** Full test run
- [ ] **Step 2:** Tag `plan-07-complete`

---

## Plan 07 Complete

**What's shipped:**
- OOBE state machine (8 steps, resumable, checkpointed)
- All 8 OOBE step implementations including Counselor API key setup
- OS keychain integration (macOS, Linux, Windows)
- Penny's full ingestion protocol with PRD refinement loop
- Handoff artifact writer
- Leonard's continuous expansion with user-visible proposal flow
- Mid-season character spawn

**What's next:** Plan 08 — The Counselor + Advisory Board consultation protocol.
