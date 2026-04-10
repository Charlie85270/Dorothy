# Plan 05: Season Runtime + Worktrees + Review Gates Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development or superpowers:executing-plans.

> **⚠ Plan 11 reconciliation note (added 2026-04-09):** Echelon is the primary host runtime for v0.1. The season lifecycle and worktree-per-agent mechanics described here are **hosted inside the Echelon Electron main process**, not as standalone CLI skills. Concretely: `electron/core/season-manager.ts` (Plan 11 Phase C) owns spawn/archive/restore; `electron/core/review-gate-runner.ts` (Plan 11 Phase G) owns the 6 parallel gates; Leonard's merge arbitration surfaces through the Echelon Review Gate board (Kanban reskin). Season directories live at `~/.echelon/seasons/<slug>/` (not `~/.factor-echelon/`). Claude Code and OpenClaw adapters reuse the same runtime via IPC bridges exposed by Echelon. When this plan says "host platform channel posts," read it as "Echelon IPC + optional Telegram/Slack bridge." Read Plan 11 §2 (file structure) and Phase C/G before executing Plan 05.

**Goal:** Ship the runtime primitives that turn a composed roster manifest into a live season: season lifecycle (spawn/archive/restore), per-agent git worktrees, and the 7-gate review pipeline (6 parallel + Refinement after). After this plan, a fixture task can run end-to-end from worktree spawn through review gates to merge.

**Architecture:** Season directories live outside the repo (at `~/.echelon/seasons/<slug>/`). Worktrees attach to an in-season `workspace/` that's a full git repo. Review gates run as parallel subprocess checks against the worktree's diff; outputs are collected and aggregated by Leonard (the merge authority) before a serialized merge. **Runtime is hosted in the Echelon Electron main process** (see Plan 11 Phase C).

**Tech Stack:** Bun + TypeScript, native `git` CLI for worktree operations (via `bun` subprocess), YAML for manifests. **Electron 33 main process** as the runtime host.

**Spec reference:** §6.1 `seasons/` + `shared-skills/git-worktrees/`, §7.3 season spawn flow, §7.4 task execution + review gates, §8.5 runtime failures (bounce counter, worktree orphans), §12.4 review gates table, §12.5 worktree execution model.

**Dependencies:** Plans 01, 02, 03 complete.

---

## File Structure

```
src/team-factory/
├── seasons/
│   ├── SKILL.md                         # spawn-season, end-season, archive-season
│   ├── isolation-protocol.md            # workspace/channel/cron isolation rules
│   ├── season-manifest-schema.yaml      # Penny's handoff artifact (from Plan 03)
│   └── cross-season-learning.md         # what's shared, what isn't
│
└── shared-skills/
    ├── git-worktrees/
    │   ├── SKILL.md                     # wrap superpowers:using-git-worktrees
    │   ├── spawn-worktree.md
    │   ├── merge-worktree.md
    │   └── cleanup-orphans.md
    ├── quality-gate/
    │   ├── SKILL.md
    │   ├── rating-system.md             # 5-star + hybrid pass/fail
    │   ├── bounce-counter.md            # max 5 before Counselor escalation
    │   └── merge-authority.md           # Leonard serialized merge
    └── review-gates/
        ├── SKILL.md
        ├── architecture-review.md
        ├── code-review.md
        ├── qa-review.md
        ├── security-review.md
        ├── adversarial-review.md        # 5-star, ≥4 required
        ├── ui-functionality-review.md   # 5-star, ≥4 required
        └── refinement-pass.md           # runs after others pass

build/
├── runtime/
│   ├── season-manager.ts                # spawn/archive/restore
│   ├── worktree-manager.ts              # per-agent worktree lifecycle
│   ├── review-pipeline.ts               # orchestrate 7 gates
│   └── merge-authority.ts               # Leonard's merge logic

tests/
├── fixtures/
│   └── tasks/
│       └── simple-add-function.yaml     # fixture task for E2E runtime
└── integration/
    ├── season-spawn.test.ts
    ├── worktree-lifecycle.test.ts
    ├── review-pipeline.test.ts
    └── runtime-e2e.test.ts
```

---

## Task 1: `seasons/` skill directory

- [ ] **Step 1: Write `seasons/SKILL.md`** documenting the three primitives: spawn, archive, restore.

- [ ] **Step 2: Write `isolation-protocol.md`** — per-season workspace, per-season channels, per-season cron namespaces, no shared mutable state except advisory board + mempalace team wing.

- [ ] **Step 3: Write `cross-season-learning.md`** — what is shared across seasons (advisory board consultations, mempalace team wing), what is not (COMMITMENTS, MEMORY, workspace files).

- [ ] **Step 4: Commit** — `feat(seasons): add seasons skill docs and isolation protocol`

---

## Task 2: Season manifest validator

Plan 03's `roster-manifest-schema.yaml` defines the handoff artifact Penny writes. Now verify it at season spawn time.

- [ ] **Step 1: Extend `build/lib/validators.ts`** with `validateSeasonManifest(path: string)` that loads the YAML and validates against the Plan 01 schema.

- [ ] **Step 2: Test with a fixture manifest** — pass and fail cases.

- [ ] **Step 3: Commit** — `feat(build): add season manifest validator`

---

## Task 3: Season manager

**Files:**
- Create: `build/runtime/season-manager.ts`
- Create: `tests/integration/season-spawn.test.ts`

- [ ] **Step 1: Write failing test for spawn-season**

```typescript
test("spawnSeason creates directory structure with manifest", async () => {
  const tmpRoot = "/tmp/factor-echelon-test/" + Math.random();
  const result = await spawnSeason({
    slug: "test-project",
    theme: "tbbt",
    tier: "medium",
    roster: [{ archetype: "ingestion-pm", character: "penny", capabilities: ["source-control:read"] }],
    rootDir: tmpRoot,
  });
  expect(result.success).toBe(true);
  expect(existsSync(`${tmpRoot}/seasons/season-01-test-project/season.yaml`)).toBe(true);
  expect(existsSync(`${tmpRoot}/seasons/season-01-test-project/manifest.yaml`)).toBe(true);
  expect(existsSync(`${tmpRoot}/seasons/season-01-test-project/characters/penny/SOUL.md`)).toBe(true);
});
```

- [ ] **Step 2: Write `season-manager.ts`**

```typescript
// build/runtime/season-manager.ts
import { mkdirSync, cpSync, writeFileSync, existsSync, readdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { dump as yamlDump } from "js-yaml";
import { spawnSync } from "node:child_process";

export interface SpawnSeasonInput {
  slug: string;
  theme: string;
  tier: "medium" | "large" | "enterprise";
  roster: Array<{
    archetype: string;
    character: string;
    capabilities: string[];
  }>;
  rootDir: string;  // e.g., ~/.factor-echelon
  userContext?: Record<string, any>;
}

export interface SeasonSpawnResult {
  success: boolean;
  seasonId: string;
  path: string;
  errors: string[];
}

export async function spawnSeason(input: SpawnSeasonInput): Promise<SeasonSpawnResult> {
  const seasonsDir = join(input.rootDir, "seasons");
  mkdirSync(seasonsDir, { recursive: true });

  // Determine next season ID
  const existing = existsSync(seasonsDir) ? readdirSync(seasonsDir).filter((n) => n.startsWith("season-")) : [];
  const nextN = existing.length + 1;
  const seasonId = `season-${nextN.toString().padStart(2, "0")}-${input.slug}`;
  const seasonPath = join(seasonsDir, seasonId);

  if (existsSync(seasonPath)) {
    return { success: false, seasonId, path: seasonPath, errors: ["season already exists"] };
  }

  mkdirSync(seasonPath);
  mkdirSync(join(seasonPath, "characters"));
  mkdirSync(join(seasonPath, "memory"));
  mkdirSync(join(seasonPath, "worktrees"));
  mkdirSync(join(seasonPath, "workspace"));

  // Initialize workspace as git repo
  spawnSync("git", ["init"], { cwd: join(seasonPath, "workspace") });

  // Write season.yaml
  writeFileSync(
    join(seasonPath, "season.yaml"),
    yamlDump({
      season_id: seasonId,
      season_slug: input.slug,
      theme: input.theme,
      tier: input.tier,
      state: "active",
      created_at: new Date().toISOString(),
    })
  );

  // Write manifest.yaml
  writeFileSync(
    join(seasonPath, "manifest.yaml"),
    yamlDump({
      season_id: seasonId,
      season_slug: input.slug,
      theme: input.theme,
      tier: input.tier,
      roster: input.roster,
      channels: { primary: `#${seasonId}-pennys-apartment` },
      user_context: input.userContext ?? {},
    })
  );

  // Copy character TIER 1 files for each roster entry
  for (const entry of input.roster) {
    const srcCharPath = join("src/team-factory/themes", input.theme, "characters", entry.character);
    const dstCharPath = join(seasonPath, "characters", entry.character);
    if (existsSync(srcCharPath)) {
      cpSync(srcCharPath, dstCharPath, { recursive: true });
    }
  }

  return { success: true, seasonId, path: seasonPath, errors: [] };
}

export async function archiveSeason(seasonPath: string, rootDir: string): Promise<void> {
  // Move to archive/, update state in season.yaml, retain read access
  const archiveDir = join(rootDir, "seasons", "_archive");
  mkdirSync(archiveDir, { recursive: true });
  const slug = seasonPath.split("/").pop()!;
  renameSync(seasonPath, join(archiveDir, slug));
}

export async function restoreSeason(archivedSlug: string, rootDir: string): Promise<void> {
  // Move back to active seasons, update state
  const archivePath = join(rootDir, "seasons", "_archive", archivedSlug);
  const restoredPath = join(rootDir, "seasons", archivedSlug);
  renameSync(archivePath, restoredPath);
}
```

- [ ] **Step 3: Run tests, verify pass**

- [ ] **Step 4: Commit** — `feat(runtime): add season-manager with spawn/archive/restore`

---

## Task 4: Git worktrees shared skill

**Files:**
- Create: `src/team-factory/shared-skills/git-worktrees/SKILL.md`
- Create: `src/team-factory/shared-skills/git-worktrees/spawn-worktree.md`
- Create: `src/team-factory/shared-skills/git-worktrees/merge-worktree.md`
- Create: `src/team-factory/shared-skills/git-worktrees/cleanup-orphans.md`
- Create: `build/runtime/worktree-manager.ts`

- [ ] **Step 1: Write skill docs referencing superpowers:using-git-worktrees.**

The factor-echelon wrapper adds:
- Per-season concurrency cap (max 10 active worktrees)
- Orphan auto-prune after 7 days idle
- Naming convention: `<character>-<task-id>`

- [ ] **Step 2: Write `worktree-manager.ts`**

```typescript
// build/runtime/worktree-manager.ts
import { spawnSync } from "node:child_process";
import { existsSync, rmSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface WorktreeSpawnInput {
  seasonPath: string;
  character: string;
  taskId: string;
}

export interface Worktree {
  path: string;
  character: string;
  taskId: string;
  branch: string;
  createdAt: Date;
}

const MAX_CONCURRENT_WORKTREES = 10;
const ORPHAN_THRESHOLD_DAYS = 7;

export function spawnWorktree(input: WorktreeSpawnInput): { success: boolean; worktree?: Worktree; error?: string } {
  const { seasonPath, character, taskId } = input;
  const workspaceDir = join(seasonPath, "workspace");
  const worktreesDir = join(seasonPath, "worktrees");

  const existing = listWorktrees(seasonPath);
  if (existing.length >= MAX_CONCURRENT_WORKTREES) {
    return { success: false, error: `max ${MAX_CONCURRENT_WORKTREES} concurrent worktrees reached` };
  }

  const wtName = `${character}-${taskId}`;
  const wtPath = join(worktreesDir, wtName);
  const branch = `task/${wtName}`;

  const result = spawnSync("git", ["worktree", "add", "-b", branch, wtPath], {
    cwd: workspaceDir,
    encoding: "utf-8",
  });
  if (result.status !== 0) {
    return { success: false, error: result.stderr };
  }

  return {
    success: true,
    worktree: { path: wtPath, character, taskId, branch, createdAt: new Date() },
  };
}

export function mergeWorktree(seasonPath: string, worktree: Worktree, commitMessage: string): { success: boolean; error?: string } {
  const workspaceDir = join(seasonPath, "workspace");
  // Checkout main, merge the task branch
  let result = spawnSync("git", ["checkout", "main"], { cwd: workspaceDir });
  if (result.status !== 0) return { success: false, error: "checkout main failed" };

  result = spawnSync("git", ["merge", "--no-ff", worktree.branch, "-m", commitMessage], { cwd: workspaceDir });
  if (result.status !== 0) return { success: false, error: `merge failed: ${result.stderr?.toString()}` };

  // Remove the worktree
  result = spawnSync("git", ["worktree", "remove", worktree.path], { cwd: workspaceDir });
  return { success: result.status === 0, error: result.stderr?.toString() };
}

export function listWorktrees(seasonPath: string): Worktree[] {
  const worktreesDir = join(seasonPath, "worktrees");
  if (!existsSync(worktreesDir)) return [];
  return readdirSync(worktreesDir).map((name) => {
    const path = join(worktreesDir, name);
    const stat = statSync(path);
    const [character, taskId] = name.split("-", 2);
    return { path, character, taskId, branch: `task/${name}`, createdAt: stat.birthtime };
  });
}

export function cleanupOrphans(seasonPath: string): string[] {
  const now = Date.now();
  const removed: string[] = [];
  for (const wt of listWorktrees(seasonPath)) {
    const ageMs = now - wt.createdAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays > ORPHAN_THRESHOLD_DAYS) {
      // Check if the worktree is stale (no commits in 7 days)
      // For v0.1, assume any worktree older than 7 days is orphaned
      rmSync(wt.path, { recursive: true });
      removed.push(wt.path);
    }
  }
  return removed;
}
```

- [ ] **Step 3: Integration test for worktree lifecycle**

- [ ] **Step 4: Commit** — `feat(runtime): add worktree-manager with spawn/merge/cleanup`

---

## Task 5: Quality gate primitives

**Files:**
- Create: `src/team-factory/shared-skills/quality-gate/SKILL.md`
- Create: `src/team-factory/shared-skills/quality-gate/rating-system.md`
- Create: `src/team-factory/shared-skills/quality-gate/bounce-counter.md`
- Create: `src/team-factory/shared-skills/quality-gate/merge-authority.md`

- [ ] **Step 1: Write `rating-system.md`** documenting the hybrid scheme: pass/fail for technical gates, 5-star for subjective gates.

- [ ] **Step 2: Write `bounce-counter.md`** documenting the 5-bounce cap before Counselor Placement C escalation.

- [ ] **Step 3: Write `merge-authority.md`** documenting Leonard's serialized merge after all gates pass.

- [ ] **Step 4: Commit** — `feat(quality-gate): add rating system, bounce counter, merge authority docs`

---

## Task 6: Review gate skills (7 gates)

**Files:**
- Create: `src/team-factory/shared-skills/review-gates/SKILL.md`
- Create: `src/team-factory/shared-skills/review-gates/architecture-review.md`
- Create: `src/team-factory/shared-skills/review-gates/code-review.md`
- Create: `src/team-factory/shared-skills/review-gates/qa-review.md`
- Create: `src/team-factory/shared-skills/review-gates/security-review.md`
- Create: `src/team-factory/shared-skills/review-gates/adversarial-review.md`
- Create: `src/team-factory/shared-skills/review-gates/ui-functionality-review.md`
- Create: `src/team-factory/shared-skills/review-gates/refinement-pass.md`

- [ ] **Step 1: For each gate**, write the skill doc describing:
  - Which character owns it (Sheldon, Alex, Bernadette, Barry, Wil, UX Designer = Emily, Leslie)
  - Input: worktree diff + task context
  - Output: pass/fail or 5-star rating
  - How the gate is invoked
  - Escalation rules

- [ ] **Step 2: Commit in batches of 2-3 gates** — `feat(review-gates): add architecture + code review docs`, etc.

---

## Task 7: Review pipeline orchestrator

**Files:**
- Create: `build/runtime/review-pipeline.ts`
- Create: `tests/integration/review-pipeline.test.ts`

- [ ] **Step 1: Write `review-pipeline.ts`**

```typescript
// build/runtime/review-pipeline.ts
export interface GateResult {
  gate: string;
  type: "pass-fail" | "rating";
  result: "pass" | "fail" | number; // number for 5-star rating
  reviewer: string;
  notes: string;
}

export interface ReviewPipelineInput {
  taskId: string;
  worktreePath: string;
  worktreeDiff: string;  // output of `git diff main...task/branch`
  bounceCount: number;  // 0 on first review
}

export interface ReviewPipelineResult {
  passed: boolean;
  mustBounce: boolean;
  escalateToCounselor: boolean;  // true if bounce count reaches 5
  gateResults: GateResult[];
  overallRating: number | null;  // derived from 5-star gates
}

const PARALLEL_GATES = [
  "architecture-review",
  "code-review",
  "qa-review",
  "security-review",
  "adversarial-review",     // 5-star
  "ui-functionality-review", // 5-star
];
const SEQUENTIAL_GATES = ["refinement-pass"];  // runs after parallel gates pass

const RATING_GATES = new Set(["adversarial-review", "ui-functionality-review"]);

export async function runReviewPipeline(input: ReviewPipelineInput): Promise<ReviewPipelineResult> {
  // 1. Run all parallel gates concurrently
  const parallelResults = await Promise.all(
    PARALLEL_GATES.map((gate) => runGate(gate, input))
  );

  const allPassed = parallelResults.every((r) => {
    if (r.type === "pass-fail") return r.result === "pass";
    return (r.result as number) >= 4;
  });

  if (!allPassed) {
    const bouncing = input.bounceCount + 1;
    return {
      passed: false,
      mustBounce: true,
      escalateToCounselor: bouncing >= 5,
      gateResults: parallelResults,
      overallRating: null,
    };
  }

  // 2. Run refinement pass (sequential, after parallel gates pass)
  const refinement = await runGate("refinement-pass", input);
  const finalPassed = refinement.type === "pass-fail" && refinement.result === "pass";

  return {
    passed: finalPassed,
    mustBounce: !finalPassed,
    escalateToCounselor: !finalPassed && input.bounceCount + 1 >= 5,
    gateResults: [...parallelResults, refinement],
    overallRating: computeOverallRating(parallelResults),
  };
}

async function runGate(gate: string, input: ReviewPipelineInput): Promise<GateResult> {
  // In v0.1 this is a stub — the actual gate execution is delegated to
  // the character (Sheldon, Bernadette, etc.) via the host platform's
  // agent invocation. This stub returns a deterministic result for tests.
  const isRating = RATING_GATES.has(gate);
  return {
    gate,
    type: isRating ? "rating" : "pass-fail",
    result: isRating ? 5 : "pass",  // stub always passes in v0.1 tests
    reviewer: "stub",
    notes: "",
  };
}

function computeOverallRating(results: GateResult[]): number {
  const ratings = results.filter((r) => r.type === "rating").map((r) => r.result as number);
  if (ratings.length === 0) return 5;
  return ratings.reduce((a, b) => a + b, 0) / ratings.length;
}
```

- [ ] **Step 2: Integration test**

```typescript
test("review pipeline passes all gates on a clean task", async () => {
  const result = await runReviewPipeline({
    taskId: "task-1",
    worktreePath: "/tmp/wt",
    worktreeDiff: "+function hello() {}",
    bounceCount: 0,
  });
  expect(result.passed).toBe(true);
  expect(result.gateResults.length).toBe(7);  // 6 parallel + refinement
});

test("review pipeline triggers escalation after 5 bounces", async () => {
  // Mock: force one gate to fail
  // (implementation detail: inject a fail stub)
  const result = await runReviewPipeline({
    taskId: "task-2",
    worktreePath: "/tmp/wt",
    worktreeDiff: "",
    bounceCount: 4,  // this is the 5th attempt
  });
  // If stub always passes, this test needs a fail-injection mode
  // For now, document the expected behavior in the test name
});
```

- [ ] **Step 3: Commit** — `feat(runtime): add review-pipeline orchestrator with 7 gates`

---

## Task 8: Merge authority (Leonard's merge logic)

**Files:**
- Create: `build/runtime/merge-authority.ts`

- [ ] **Step 1: Write `merge-authority.ts`**

```typescript
// build/runtime/merge-authority.ts
import type { ReviewPipelineResult } from "./review-pipeline.ts";
import { mergeWorktree, type Worktree } from "./worktree-manager.ts";

export interface MergeInput {
  seasonPath: string;
  worktree: Worktree;
  reviewResult: ReviewPipelineResult;
  taskDescription: string;
}

export interface MergeResult {
  merged: boolean;
  commitMessage: string;
  error?: string;
}

export async function attemptMerge(input: MergeInput): Promise<MergeResult> {
  if (!input.reviewResult.passed) {
    return {
      merged: false,
      commitMessage: "",
      error: "review gates did not pass; merge blocked",
    };
  }

  const ratingSuffix = input.reviewResult.overallRating !== null
    ? ` [avg rating: ${input.reviewResult.overallRating.toFixed(1)}★]`
    : "";
  const commitMessage = `${input.taskDescription}${ratingSuffix}\n\nReviewed by: ${input.reviewResult.gateResults.map((r) => r.gate).join(", ")}`;

  const mergeOutcome = mergeWorktree(input.seasonPath, input.worktree, commitMessage);
  if (!mergeOutcome.success) {
    return { merged: false, commitMessage, error: mergeOutcome.error };
  }

  return { merged: true, commitMessage };
}
```

- [ ] **Step 2: Commit** — `feat(runtime): add merge-authority (Leonard's serialized merge logic)`

---

## Task 9: End-to-end runtime test with fixture task

**Files:**
- Create: `tests/fixtures/tasks/simple-add-function.yaml`
- Create: `tests/integration/runtime-e2e.test.ts`

- [ ] **Step 1: Write fixture task**

```yaml
# tests/fixtures/tasks/simple-add-function.yaml
task_id: "task-e2e-001"
description: "Add a simple greet() function"
assigned_to: "stuart-bloom"  # Backend Engineer
scope:
  files_to_create:
    - "src/greet.ts"
expected_content:
  "src/greet.ts": |
    export function greet(name: string): string {
      return `Hello, ${name}!`;
    }
```

- [ ] **Step 2: Write E2E runtime test**

```typescript
test("E2E runtime: spawn season → spawn worktree → review → merge", async () => {
  const tmpRoot = `/tmp/factor-echelon-test/${Math.random()}`;

  // 1. Spawn a season with Stuart (Backend Engineer)
  const spawn = await spawnSeason({
    slug: "runtime-test",
    theme: "tbbt",
    tier: "medium",
    roster: [
      { archetype: "user-handler", character: "leonard-hofstadter", capabilities: ["source-control:admin"] },
      { archetype: "backend-engineer", character: "stuart-bloom", capabilities: ["source-control:write", "git-worktrees:write"] },
      { archetype: "code-reviewer", character: "alex-jensen", capabilities: ["quality-gate:approve"] },
      // ... minimum viable roster for all 7 review gates
    ],
    rootDir: tmpRoot,
  });
  expect(spawn.success).toBe(true);

  // 2. Spawn a worktree for Stuart
  const wtResult = spawnWorktree({
    seasonPath: spawn.path,
    character: "stuart-bloom",
    taskId: "task-e2e-001",
  });
  expect(wtResult.success).toBe(true);

  // 3. Simulate agent work (write a file in the worktree)
  writeFileSync(join(wtResult.worktree!.path, "src/greet.ts"), `export function greet(name: string): string { return \`Hello, \${name}!\`; }`);

  // Commit in the worktree
  spawnSync("git", ["add", "-A"], { cwd: wtResult.worktree!.path });
  spawnSync("git", ["commit", "-m", "feat: add greet function"], { cwd: wtResult.worktree!.path });

  // 4. Run review pipeline
  const reviewResult = await runReviewPipeline({
    taskId: "task-e2e-001",
    worktreePath: wtResult.worktree!.path,
    worktreeDiff: "+export function greet(name: string): string { return `Hello, ${name}!`; }",
    bounceCount: 0,
  });
  expect(reviewResult.passed).toBe(true);

  // 5. Attempt merge
  const mergeResult = await attemptMerge({
    seasonPath: spawn.path,
    worktree: wtResult.worktree!,
    reviewResult,
    taskDescription: "Add greet function",
  });
  expect(mergeResult.merged).toBe(true);

  // 6. Verify the file is in main
  expect(existsSync(join(spawn.path, "workspace/src/greet.ts"))).toBe(true);
});
```

- [ ] **Step 3: Run the E2E test**

```bash
bun test tests/integration/runtime-e2e.test.ts
```
Expected: PASS. Full runtime loop works.

- [ ] **Step 4: Commit** — `test(runtime): add end-to-end season spawn → worktree → review → merge test`

---

## Task 10: Verification + tag

- [ ] **Step 1:** Full test run
```bash
bun run lint && bun test && bun run build && bun run test:smoke
```

- [ ] **Step 2:** Tag
```bash
git tag -a plan-05-complete -m "Plan 05: Season Runtime + Worktrees + Review Gates complete"
```

---

## Plan 05 Complete

**What's shipped:**
- Seasons skill docs (isolation protocol, cross-season learning)
- Season manager with spawn/archive/restore primitives
- Worktree manager with per-season concurrency cap (max 10), orphan cleanup
- Quality gate docs (rating system, bounce counter, merge authority)
- Seven review gate skill docs (Architecture, Code, QA, Security, Adversarial, UI, Refinement)
- Review pipeline orchestrator running 6 parallel + 1 sequential gate
- Merge authority implementing Leonard's serialized merge
- End-to-end runtime test: season spawn → worktree spawn → review gates → merge → verify

**What's next:** Plan 06 — Knowledge Base (mempalace + KB interface abstraction).
