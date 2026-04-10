# Plan 04: OpenClaw Adapter Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan.

**Goal:** Add the OpenClaw adapter as a second build target, producing a parallel `dist/openclaw/` bundle from the same canonical `src/team-factory/` source. Parity tests verify that both Claude Code and OpenClaw targets ship equivalent content.

**Architecture:** Follows the pattern established in Plan 01's `build/targets/claude-code.ts`. The OpenClaw adapter produces a bundle structure matching the existing `~/Downloads/openclaw-dev-team/` reference implementation, with an install script, config schema, and a structured agents/ + shared-skills/ layout.

**Tech Stack:** TypeScript (same as Plan 01). New: bash install script generation.

**Spec reference:** §5 Architecture I1 (one canonical source, adapters are thin packaging), §6.2 adapters layout, §10.1 Bootstrap DAG phase 9.

**Dependencies:** Plans 01, 02, 03 complete.

---

## File Structure

```
adapters/
└── openclaw/
    ├── adapter.yaml                       # NEW
    ├── openclaw.json                      # OpenClaw config schema template
    ├── install.sh                         # shipped with the bundle
    └── README.md                          # install instructions

build/
└── targets/
    └── openclaw.ts                        # NEW transformer

tests/
└── smoke/
    └── openclaw.test.ts                   # NEW
    └── parity.test.ts                     # NEW — Claude Code vs OpenClaw parity
```

---

## Task 1: OpenClaw adapter metadata

- [ ] **Step 1: Create `adapters/openclaw/adapter.yaml`**

```yaml
name: "openclaw"
display_name: "OpenClaw Bundle"
target_platform: "openclaw"
format: "bundle"
output_directory: "dist/openclaw"

packaging:
  structure: "directory"  # not a single file
  manifest_template: "openclaw.json"
  install_script: "install.sh"
  includes:
    - "src/team-factory/SKILL.md"
    - "src/team-factory/skill.yaml"
    - "src/team-factory/archetypes/**"
    - "src/team-factory/themes/**"
    - "src/team-factory/advisory-board/**"
    - "src/team-factory/roster-composer/**"
    - "src/team-factory/theme-engine/**"
    - "src/team-factory/capabilities/**"
    - "src/team-factory/protocols/**"
```

- [ ] **Step 2: Create `adapters/openclaw/openclaw.json` template**

```json
{
  "$schema": "./openclaw.schema.json",
  "name": "factor-echelon",
  "version": "0.0.1",
  "persona": "factor-echelon",
  "agent_dir": "~/.openclaw/workspace/factor-echelon",
  "workspace": "~/.openclaw/workspace",
  "model": {
    "provider": "anthropic",
    "model": "claude-opus-4-6",
    "thinking": "high"
  },
  "features": {
    "heartbeat": true,
    "commitments": true,
    "mempalace_mcp": true,
    "counselor": true
  }
}
```

- [ ] **Step 3: Create `adapters/openclaw/install.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

# factor-echelon OpenClaw bundle installer

BUNDLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${OPENCLAW_INSTALL_DIR:-$HOME/.openclaw/workspace/factor-echelon}"

echo "[factor-echelon] Installing to $INSTALL_DIR"

mkdir -p "$INSTALL_DIR"
cp -R "$BUNDLE_DIR/skill/"* "$INSTALL_DIR/"
cp "$BUNDLE_DIR/openclaw.json" "$INSTALL_DIR/openclaw.json"

echo "[factor-echelon] Registering mempalace MCP server"
# mempalace MCP registration (see Plan 06 for details)
if command -v mempalace &>/dev/null; then
  mempalace mcp register || echo "[factor-echelon]   (mempalace registration optional; skip if not installed)"
fi

echo "[factor-echelon] Install complete"
echo "[factor-echelon] Run: openclaw start --config $INSTALL_DIR/openclaw.json"
```

- [ ] **Step 4: Create `adapters/openclaw/README.md`** — install instructions and troubleshooting.

- [ ] **Step 5: Make install.sh executable**

```bash
chmod +x adapters/openclaw/install.sh
```

- [ ] **Step 6: Commit** — `feat(adapters): add OpenClaw adapter metadata and install script`

---

## Task 2: OpenClaw target transformer

**Files:**
- Create: `build/targets/openclaw.ts`

- [ ] **Step 1: Write failing smoke test**

```typescript
// tests/smoke/openclaw.test.ts
import { test, expect } from "bun:test";
import { existsSync } from "node:fs";

const DIST = "dist/openclaw";

test("smoke(openclaw): dist/openclaw exists after build", () => {
  expect(existsSync(DIST)).toBe(true);
});

test("smoke(openclaw): bundle contains openclaw.json", () => {
  expect(existsSync(`${DIST}/openclaw.json`)).toBe(true);
});

test("smoke(openclaw): bundle contains install.sh", () => {
  expect(existsSync(`${DIST}/install.sh`)).toBe(true);
});

test("smoke(openclaw): skill directory is populated", () => {
  expect(existsSync(`${DIST}/skill/archetypes/ingestion-pm/archetype.yaml`)).toBe(true);
  expect(existsSync(`${DIST}/skill/themes/tbbt/characters/penny/SOUL.md`)).toBe(true);
});

test("smoke(openclaw): install.sh is executable", () => {
  const { statSync } = require("node:fs");
  const stat = statSync(`${DIST}/install.sh`);
  // octal: at least one execute bit set
  expect((stat.mode & 0o111) !== 0).toBe(true);
});
```

- [ ] **Step 2: Write `build/targets/openclaw.ts`** following the Claude Code pattern from Plan 01, but producing the OpenClaw bundle structure.

- [ ] **Step 3: Update `build/build.ts`** to invoke both targets:

```typescript
// Add to build/build.ts main()
import { buildOpenClaw } from "./targets/openclaw.ts";

// ... after claude code build:
console.log("[factor-echelon] Building OpenClaw bundle");
const openclawResult = buildOpenClaw(tree, {
  sourceRoot: SOURCE_ROOT,
  adapterRoot: "../adapters/openclaw",
  outputRoot: "../dist/openclaw",
});
if (!openclawResult.success) { /* error handling */ }
```

- [ ] **Step 4: Run build and smoke tests**

```bash
bun run build
bun run test:smoke
```
Expected: Both Claude Code smoke tests AND OpenClaw smoke tests pass.

- [ ] **Step 5: Commit** — `feat(build): add OpenClaw target transformer`

---

## Task 3: Parity tests

**Files:**
- Create: `tests/smoke/parity.test.ts`

- [ ] **Step 1: Write parity tests**

```typescript
// tests/smoke/parity.test.ts
// Verify both adapters ship the same content, even if packaged differently

import { test, expect } from "bun:test";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CLAUDE_CODE_SKILL = "dist/claude-code/skill";
const OPENCLAW_SKILL = "dist/openclaw/skill";

function collectFiles(root: string, prefix = ""): Set<string> {
  const result = new Set<string>();
  if (!existsSync(root)) return result;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      for (const sub of collectFiles(join(root, entry.name), relPath)) {
        result.add(sub);
      }
    } else {
      result.add(relPath);
    }
  }
  return result;
}

test("parity: both targets ship the same set of skill files", () => {
  const claudeFiles = collectFiles(CLAUDE_CODE_SKILL);
  const openclawFiles = collectFiles(OPENCLAW_SKILL);
  expect(claudeFiles.size).toBe(openclawFiles.size);
  expect([...claudeFiles].sort()).toEqual([...openclawFiles].sort());
});

test("parity: Penny's SOUL.md is identical between targets", () => {
  const claude = readFileSync(`${CLAUDE_CODE_SKILL}/themes/tbbt/characters/penny/SOUL.md`, "utf-8");
  const openclaw = readFileSync(`${OPENCLAW_SKILL}/themes/tbbt/characters/penny/SOUL.md`, "utf-8");
  expect(claude).toBe(openclaw);
});

test("parity: all 43 archetypes present in both targets", () => {
  const claudeArchetypes = readdirSync(`${CLAUDE_CODE_SKILL}/archetypes`).filter((n) => !n.startsWith("_"));
  const openclawArchetypes = readdirSync(`${OPENCLAW_SKILL}/archetypes`).filter((n) => !n.startsWith("_"));
  expect(claudeArchetypes.length).toBe(43);
  expect(openclawArchetypes.length).toBe(43);
  expect(claudeArchetypes.sort()).toEqual(openclawArchetypes.sort());
});

test("parity: TBBT + Young Sheldon characters present in both targets", () => {
  const claudeChars = readdirSync(`${CLAUDE_CODE_SKILL}/themes/tbbt/characters`);
  const openclawChars = readdirSync(`${OPENCLAW_SKILL}/themes/tbbt/characters`);
  expect(claudeChars.sort()).toEqual(openclawChars.sort());
  expect(claudeChars.length).toBeGreaterThanOrEqual(30);  // TBBT primary + recurring
});
```

- [ ] **Step 2: Run parity tests**

```bash
bun run build && bun run test:smoke
```
Expected: all parity tests pass. If not, the target transformers have drifted and need reconciliation.

- [ ] **Step 3: Commit** — `test(smoke): add Claude Code / OpenClaw parity tests`

---

## Task 4: CI update

- [ ] **Step 1: Update `.github/workflows/pr.yml`** to run all smoke tests (including OpenClaw and parity), not just Claude Code

- [ ] **Step 2: Verify CI would pass**

Run locally:
```bash
bun run lint && bun test && bun run build && bun run test:smoke
```
All green.

- [ ] **Step 3: Commit** — `ci: run OpenClaw smoke + parity tests in PR workflow`

---

## Task 5: Verification + tag

- [ ] **Step 1: Tag**
```bash
git tag -a plan-04-complete -m "Plan 04: OpenClaw Adapter complete"
```

---

## Plan 04 Complete

**What's shipped:**
- OpenClaw adapter with bundle layout, install script, config template
- Build orchestrator produces both Claude Code and OpenClaw targets
- Smoke tests for OpenClaw bundle structure
- Parity tests ensuring both targets ship equivalent content
- CI runs both targets' smoke tests

**What's next:** Plan 05 — Season Runtime + Worktrees + Review Gates.
