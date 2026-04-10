# Plan 06: Knowledge Base Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Ship the knowledge base layer: a `shared-skills/kb-interface/` abstraction boundary, a mempalace backend implementation, and `knowledge-capture` + `knowledge-retrieval` skills that any agent can call. Solo mode only (team mode is v0.5).

**Architecture:** KB interface defines the contract — write a learning, query by tag+semantics, promote skills to pending, etc. The mempalace backend is the v0.1 implementation. If mempalace breaks or changes schema, a secondary backend can be dropped in without rewriting callers.

**Tech Stack:** Bun + TypeScript, mempalace Python CLI + MCP, ChromaDB (via mempalace), git for kb-git mirror.

**Spec reference:** §6.1 `shared-skills/knowledge-capture/` + `knowledge-retrieval/`, §7.6 knowledge base flows, §8.7 KB failure modes, §12.2 solo mode, §12.3 mempalace wing mapping, §15 mempalace pinning and KB interface abstraction.

**Dependencies:** Plans 01-05 complete.

---

## File Structure

```
src/team-factory/
└── shared-skills/
    ├── kb-interface/
    │   ├── SKILL.md
    │   ├── schema.yaml                  # wing / hall / room taxonomy
    │   └── contract.md                  # interface definition
    ├── knowledge-capture/
    │   ├── SKILL.md
    │   └── classify.md                  # learning / pattern / ADR / review-rule / skill
    └── knowledge-retrieval/
        ├── SKILL.md
        └── query-patterns.md

build/
├── kb/
│   ├── kb-interface.ts                   # TypeScript contract
│   ├── mempalace-backend.ts              # mempalace adapter
│   └── git-mirror.ts                     # git sync for solo mode
└── lib/
    └── mempalace-client.ts               # thin wrapper over mempalace CLI/MCP

tests/
├── fixtures/
│   └── kb-samples/
│       ├── learning-sample.yaml
│       ├── pattern-sample.yaml
│       └── review-decision-sample.yaml
└── integration/
    ├── kb-interface.test.ts
    ├── mempalace-backend.test.ts
    └── kb-e2e.test.ts
```

---

## Task 1: KB interface contract

**Files:**
- Create: `src/team-factory/shared-skills/kb-interface/SKILL.md`
- Create: `src/team-factory/shared-skills/kb-interface/schema.yaml`
- Create: `src/team-factory/shared-skills/kb-interface/contract.md`
- Create: `build/kb/kb-interface.ts`

- [ ] **Step 1: Write `schema.yaml`** describing the wing/hall/room taxonomy:

```yaml
# kb-interface/schema.yaml — abstraction over mempalace (or alternate backend)

wings:
  - name: "private-<user-id>"
    type: "solo-or-private"
    description: "Per-user private KB; data never crosses user boundary"
  - name: "season-<season-id>"
    type: "season-scoped"
    description: "Per-season KB; data is scoped to one season's lifetime"
  - name: "team-shared"
    type: "team"
    description: "Cross-user shared KB (v0.5+, team mode only)"

halls:
  - name: "learnings"
    description: "Insights captured during work"
  - name: "patterns"
    description: "Reusable patterns identified across tasks"
  - name: "decisions"
    description: "ADRs and architectural decisions"
  - name: "reviews"
    subhalls: ["adversarial", "code", "security", "architecture", "qa", "ui"]
    description: "Rules distilled from review decisions per gate"
  - name: "skills"
    subhalls: ["pending", "approved", "deprecated"]
    description: "Autonomously learned skills with promotion lifecycle"
  - name: "counselor-verdicts"
    description: "Multi-model council decisions (written in Plan 08)"
```

- [ ] **Step 2: Write `contract.md`** defining the interface every backend must implement.

- [ ] **Step 3: Write `kb-interface.ts`** (TypeScript contract)

```typescript
// build/kb/kb-interface.ts
export interface KBRoom {
  id: string;
  wing: string;
  hall: string;
  subhall?: string;
  content: string;
  metadata: Record<string, any>;
  created_at: Date;
  tags: string[];
}

export interface KBQuery {
  wing?: string;
  hall?: string;
  subhall?: string;
  tags?: string[];
  semantic_query?: string;
  limit?: number;
}

export interface KBCaptureInput {
  wing: string;
  hall: string;
  subhall?: string;
  content: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface KnowledgeBase {
  init(config: KBConfig): Promise<void>;
  capture(input: KBCaptureInput): Promise<KBRoom>;
  query(query: KBQuery): Promise<KBRoom[]>;
  getById(id: string): Promise<KBRoom | null>;
  delete(id: string, reason: string): Promise<void>;
  export(path: string): Promise<void>;
  import(path: string): Promise<void>;
  health(): Promise<{ ok: boolean; backend: string; version: string }>;
}

export interface KBConfig {
  mode: "solo" | "team";
  backend: "mempalace" | "mock" | string;
  localPath?: string;
  teamBackendUrl?: string;
  gitMirrorPath?: string;
}
```

- [ ] **Step 4: Commit** — `feat(kb): add KB interface contract and schema`

---

## Task 2: mempalace backend implementation

**Files:**
- Create: `build/lib/mempalace-client.ts`
- Create: `build/kb/mempalace-backend.ts`
- Create: `tests/integration/mempalace-backend.test.ts`

- [ ] **Step 1: Write failing test** — spawning a temp backend, capturing one learning, querying it back.

- [ ] **Step 2: Write `mempalace-client.ts`** thin wrapper over mempalace CLI + MCP.

```typescript
// build/lib/mempalace-client.ts
import { spawn as spawnProcess, spawnSync } from "node:child_process";

export class MempalaceClient {
  constructor(private readonly localPath: string) {}

  async init(): Promise<void> {
    const result = spawnSync("mempalace", ["init", this.localPath], { encoding: "utf-8" });
    if (result.status !== 0) {
      throw new Error(`mempalace init failed: ${result.stderr}`);
    }
  }

  async ingest(content: string, metadata: Record<string, any>): Promise<string> {
    // Write content to temp file, then mempalace mine --mode general
    // Return the room ID
    throw new Error("stub — implement during Plan 06");
  }

  async search(query: string, filters?: Record<string, any>): Promise<any[]> {
    const result = spawnSync("mempalace", ["search", query, "--json"], { encoding: "utf-8" });
    if (result.status !== 0) return [];
    return JSON.parse(result.stdout);
  }

  async health(): Promise<{ ok: boolean; version: string }> {
    const result = spawnSync("mempalace", ["--version"], { encoding: "utf-8" });
    return { ok: result.status === 0, version: result.stdout.trim() };
  }
}
```

- [ ] **Step 3: Write `mempalace-backend.ts`** implementing the `KnowledgeBase` interface using `MempalaceClient`.

- [ ] **Step 4: Run integration test**

- [ ] **Step 5: Commit** — `feat(kb): add mempalace backend implementing KB interface`

---

## Task 3: Git mirror for solo mode

**Files:**
- Create: `build/kb/git-mirror.ts`

- [ ] **Step 1: Write `git-mirror.ts`**

```typescript
// build/kb/git-mirror.ts
// Git-backed sync layer for solo mode (§12.2)
// Every KB change triggers a git commit in the kb-git mirror
// User can configure a remote for cross-device sync

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export class GitMirror {
  constructor(private readonly mirrorPath: string) {}

  init(): void {
    if (!existsSync(this.mirrorPath)) {
      mkdirSync(this.mirrorPath, { recursive: true });
      spawnSync("git", ["init"], { cwd: this.mirrorPath });
      writeFileSync(join(this.mirrorPath, "README.md"), "# factor-echelon KB mirror\n\nSolo-mode git mirror of the local mempalace.\n");
      spawnSync("git", ["add", "."], { cwd: this.mirrorPath });
      spawnSync("git", ["commit", "-m", "init: factor-echelon KB mirror"], { cwd: this.mirrorPath });
    }
  }

  commitChange(message: string, files: string[]): void {
    spawnSync("git", ["add", ...files], { cwd: this.mirrorPath });
    spawnSync("git", ["commit", "-m", message], { cwd: this.mirrorPath });
  }

  push(): { success: boolean; error?: string } {
    const result = spawnSync("git", ["push", "origin", "main"], { cwd: this.mirrorPath, encoding: "utf-8" });
    return { success: result.status === 0, error: result.stderr };
  }

  pull(): { success: boolean; error?: string } {
    const result = spawnSync("git", ["pull", "origin", "main"], { cwd: this.mirrorPath, encoding: "utf-8" });
    return { success: result.status === 0, error: result.stderr };
  }
}
```

- [ ] **Step 2: Integrate with mempalace-backend** — on every capture/delete, commit to git mirror.

- [ ] **Step 3: Commit** — `feat(kb): add git mirror for solo-mode cross-device sync`

---

## Task 4: knowledge-capture skill

**Files:**
- Create: `src/team-factory/shared-skills/knowledge-capture/SKILL.md`
- Create: `src/team-factory/shared-skills/knowledge-capture/classify.md`

- [ ] **Step 1: Write `SKILL.md`** — after every successful merge, write a learning to the KB. The skill:
  1. Receives the merge context (task, worktree diff, review results)
  2. Classifies the content (learning / pattern / ADR / review-rule / skill candidate)
  3. Writes to the appropriate hall via the KB interface
  4. Tags with season, character, archetype, tier

- [ ] **Step 2: Write `classify.md`** documenting the five classification types and how to pick one.

- [ ] **Step 3: Commit** — `feat(knowledge-capture): add capture skill with classification rules`

---

## Task 5: knowledge-retrieval skill

**Files:**
- Create: `src/team-factory/shared-skills/knowledge-retrieval/SKILL.md`
- Create: `src/team-factory/shared-skills/knowledge-retrieval/query-patterns.md`

- [ ] **Step 1: Write `SKILL.md`** — before starting any task, query the KB for prior art. The skill:
  1. Receives the task context (description, related files, assigned archetype)
  2. Builds a semantic + tag query
  3. Calls `kb.query()` via the KB interface
  4. Returns top-N relevant rooms as "prior art" to include in the agent's prompt context

- [ ] **Step 2: Write `query-patterns.md`** documenting common query templates.

- [ ] **Step 3: Commit** — `feat(knowledge-retrieval): add retrieval skill with query patterns`

---

## Task 6: E2E KB test

**Files:**
- Create: `tests/integration/kb-e2e.test.ts`

- [ ] **Step 1: Write E2E test**

```typescript
test("E2E KB: capture on merge, retrieve on next task", async () => {
  const tmpRoot = `/tmp/factor-echelon-test/${Math.random()}`;
  const kb = new MempalaceBackend({ mode: "solo", backend: "mempalace", localPath: tmpRoot });
  await kb.init({} as any);

  // Capture a learning
  const room = await kb.capture({
    wing: "season-test-01",
    hall: "learnings",
    content: "Always validate input before database insert to prevent injection",
    tags: ["security", "database", "backend"],
  });
  expect(room.id).toBeDefined();

  // Query it back
  const results = await kb.query({
    wing: "season-test-01",
    hall: "learnings",
    semantic_query: "how to prevent injection attacks on database writes",
  });
  expect(results.length).toBeGreaterThan(0);
  expect(results[0].content).toContain("validate input");
});

test("E2E KB: git mirror reflects captures", async () => {
  // After capture, the git mirror should have a new commit
  // Verify via `git log` in the mirror directory
});
```

- [ ] **Step 2: Run the test**

- [ ] **Step 3: Commit** — `test(kb): add end-to-end capture + retrieve + mirror test`

---

## Task 7: mempalace version pinning

**Files:**
- Modify: `src/team-factory/protocols/external-deps.yaml`

- [ ] **Step 1: Capture the exact mempalace HEAD commit as of 2026-04-08** and update `external-deps.yaml`:

```yaml
mempalace:
  source: "github.com/milla-jovovich/mempalace"
  pin_type: "commit"
  pin_ref: "<actual SHA from gh repo view>"
  pinned_at: "2026-04-08"
  reason: "Tool is brand new (launched 2026-04-07). Pinned to first stable state after launch fixes."
  upgrade_policy: "manual; requires full E2E re-run before bump"
```

Capture the commit SHA via:
```bash
gh api repos/milla-jovovich/mempalace/commits/main --jq .sha
```

- [ ] **Step 2: Add a CI check that warns if mempalace main diverges** from the pinned commit.

- [ ] **Step 3: Commit** — `chore(deps): pin mempalace to specific commit per §15`

---

## Task 8: Verification + tag

- [ ] **Step 1:** Full test run
```bash
bun run lint && bun test && bun run build && bun run test:smoke
```

- [ ] **Step 2:** Tag
```bash
git tag -a plan-06-complete -m "Plan 06: Knowledge Base complete"
```

---

## Plan 06 Complete

**What's shipped:**
- KB interface contract (`shared-skills/kb-interface/`)
- mempalace backend implementing the interface
- Git mirror for solo-mode cross-device sync
- knowledge-capture skill with classification rules
- knowledge-retrieval skill with query patterns
- E2E test: capture on merge → retrieve on next task
- mempalace pinned to specific commit with upgrade policy

**What's next:** Plan 07 — OOBE + Ingestion + Expansion (full first-run experience).
