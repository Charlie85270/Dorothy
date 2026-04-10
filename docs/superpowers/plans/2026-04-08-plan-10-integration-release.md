# Plan 10: Integration + Release Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Wire everything together into a shippable v0.1 alpha. Full E2E test harness, smoke matrix across targets, complete docs (quickstart + concepts + guides + examples), release runbook, manual `gh release create` procedure, and a green CI run that proves the whole thing works.

**Architecture:** No new runtime code. This plan integrates the pieces from Plans 01-09 into a shippable artifact and produces the documentation a v0.1 user needs.

**Tech Stack:** Existing — Bun, TypeScript, GitHub Actions (already scaffolded in Plan 01).

**Spec reference:** §9 Testing strategy (full test pyramid and coverage targets), §10.1 acceptance criteria, §10.4 release process notes, §14 all open questions resolved or deferred, §15 mempalace pinning verified.

**Dependencies:** Plans 01-09 complete.

---

## File Structure

```
tests/
├── e2e/
│   ├── full-alpha-flow.test.ts           # full install → OOBE → season → task → merge → capture → uninstall
│   └── matrix/
│       ├── claude-code-matrix.test.ts    # E2E against Claude Code
│       └── openclaw-matrix.test.ts       # E2E against OpenClaw

docs/
├── README.md                              # already exists from Plan 01, expand
├── quickstart.md                          # NEW
├── concepts/
│   ├── architecture.md                   # from 02-architecture-overview.md (exec package)
│   ├── the-flywheel.md                   # from 04-development-flywheel.md
│   ├── safety-nets.md                    # from 05-safety-nets.md
│   ├── seasons.md                        # NEW
│   ├── worktree-execution.md             # NEW
│   ├── knowledge-base.md                 # NEW
│   └── counselor.md                      # NEW
├── guides/
│   ├── writing-an-archetype.md
│   ├── writing-a-character.md
│   ├── customizing-the-roster.md
│   ├── platform-claude-code.md
│   └── platform-openclaw.md
├── examples/
│   ├── tiny-landing-page/
│   │   ├── prd.md
│   │   └── expected-team.yaml
│   └── medium-saas/
│       ├── prd.md
│       └── expected-team.yaml
├── positioning/
│   ├── executive-summary.md              # from 01-executive-summary.md
│   ├── cost-model.md                     # from 06-cost-model.md
│   └── competitive-advantages.md         # from 10-competitive-advantages.md
└── release/
    ├── release-runbook.md                # NEW — how to cut a release
    └── CHANGELOG.md                      # seed for v0.1

.github/
└── workflows/
    ├── pr.yml                            # already exists from Plan 01
    ├── main.yml                          # NEW — on merge to main
    └── release.yml                       # NEW — on tag
```

---

## Task 1: Full E2E test harness

**Files:**
- Create: `tests/e2e/full-alpha-flow.test.ts`
- Create: `tests/e2e/matrix/claude-code-matrix.test.ts`
- Create: `tests/e2e/matrix/openclaw-matrix.test.ts`

- [ ] **Step 1: Write `full-alpha-flow.test.ts`**

This test runs the complete alpha lifecycle end-to-end:

```typescript
// tests/e2e/full-alpha-flow.test.ts
test("E2E full alpha flow: install → OOBE → season → task → review → merge → capture → archive → uninstall", async () => {
  const tmpRoot = `/tmp/factor-echelon-e2e/${Math.random()}`;

  // Step 1: "Install" (simulated — point factor-echelon at tmpRoot)
  await runInstall(tmpRoot);

  // Step 2: OOBE (all 8 steps with stub inputs)
  await runOOBEWithStubs(tmpRoot);

  // Step 3: Season spawn via Penny ingestion
  const season = await pennyIngest({
    prdPath: "tests/fixtures/prds/medium-saas.md",
    theme: "tbbt",
    rootDir: tmpRoot,
    askUser: stubAskUser,
  });
  expect(season.success).toBe(true);

  // Step 4: Verify all characters have live soul packages
  const rosterChars = readdirSync(join(season.path, "characters"));
  expect(rosterChars.length).toBeGreaterThanOrEqual(10);

  // Step 5: Run a task through the full review pipeline
  const task = await runTaskEnd2End({
    seasonPath: season.path,
    assignedTo: "stuart-bloom",
    description: "Add a greet function",
    workFn: (wtPath) => writeFileSync(join(wtPath, "src/greet.ts"), "export function greet() {}"),
  });
  expect(task.merged).toBe(true);

  // Step 6: Verify knowledge captured to mempalace
  const learnings = await kb.query({ wing: season.seasonId, hall: "learnings" });
  expect(learnings.length).toBeGreaterThan(0);

  // Step 7: Trigger a Counselor Placement C deadlock escalation (with stub models)
  const counselorResult = await counselor.invoke({
    placement: "C",
    convener: "stephen-hawking",
    prompt_context: { system: "You are resolving a deadlock.", user: "..." },
  });
  expect(counselorResult.consensus).toBeDefined();

  // Step 8: Trigger a mid-season expansion
  const expansion = await triggerExpansion(season, "mobile_ios_platform_added");
  expect(expansion.success).toBe(true);

  // Step 9: Archive the season
  await archiveSeason(season.path, tmpRoot);
  expect(existsSync(`${tmpRoot}/seasons/_archive/${season.seasonId}`)).toBe(true);

  // Step 10: Export KB and uninstall
  await exportKB(`/tmp/kb-backup.tar.gz`);
  await uninstall({ confirmed: true, skipConfirmPrompts: true });
  expect(existsSync(tmpRoot)).toBe(false);
});
```

- [ ] **Step 2: Write `matrix/claude-code-matrix.test.ts`** — verifies the full flow against a real Claude Code plugin load (not just stubs)

- [ ] **Step 3: Write `matrix/openclaw-matrix.test.ts`** — verifies against OpenClaw bundle installation

- [ ] **Step 4: Run E2E tests**

```bash
bun test tests/e2e/
```
Expected: all E2E tests pass (stubbed Counselor model clients).

- [ ] **Step 5: Commit** — `test(e2e): add full alpha flow E2E test harness + per-target matrix`

---

## Task 2: Documentation — quickstart

**Files:**
- Create: `docs/quickstart.md`

- [ ] **Step 1: Write quickstart** — 15-minute install-to-live-team walkthrough. Target: a developer who has never seen factor-echelon before.

```markdown
# factor-echelon Quickstart

Install and run your first themed dev team in 15 minutes.

## Prerequisites

- macOS, Linux, or WSL2
- `bun` installed (https://bun.sh)
- `git` installed
- A target platform: Claude Code (https://claude.com/claude-code) or OpenClaw
- API keys for the Counselor (optional for Placements B/C/D, required for A): Google AI Studio, OpenAI, Anthropic, xAI

## Install

... (step-by-step instructions)

## First season spawn

... (drop a PRD, watch Penny work, see Leonard's first standup)

## Next steps

- Run your first mid-season expansion
- Query the Advisory Board
- Review the Counselor's first verdict
```

- [ ] **Step 2: Test the quickstart on a clean machine** (or simulated clean environment). Time it. Must complete in <15 minutes.

- [ ] **Step 3: Commit** — `docs: add quickstart guide (15-minute install-to-team)`

---

## Task 3: Documentation — concepts

**Files:**
- Create: `docs/concepts/architecture.md`
- Create: `docs/concepts/the-flywheel.md`
- Create: `docs/concepts/safety-nets.md`
- Create: `docs/concepts/seasons.md`
- Create: `docs/concepts/worktree-execution.md`
- Create: `docs/concepts/knowledge-base.md`
- Create: `docs/concepts/counselor.md`

- [ ] **Step 1: Port content from BBT Executive Package**
  - `architecture.md` ← adapt from `~/Library/Mobile Documents/com~apple~CloudDocs/Skippy/BBT Executive Package/02-architecture-overview.md`
  - `the-flywheel.md` ← adapt from `04-development-flywheel.md`
  - `safety-nets.md` ← adapt from `05-safety-nets.md`

- [ ] **Step 2: Write new concept docs**
  - `seasons.md` — per-project isolation, season lifecycle, multi-season operation
  - `worktree-execution.md` — worktree-per-agent, parallel review gates, bounce counter, merge authority
  - `knowledge-base.md` — mempalace wings/halls/rooms, solo vs team mode, skill promotion
  - `counselor.md` — multi-model council, 4 placements, convener pattern

- [ ] **Step 3: Commit in batches** — `docs(concepts): add architecture + flywheel + safety nets` then `docs(concepts): add seasons + worktree + KB + counselor`

---

## Task 4: Documentation — guides

**Files:**
- Create: `docs/guides/writing-an-archetype.md`
- Create: `docs/guides/writing-a-character.md`
- Create: `docs/guides/customizing-the-roster.md`
- Create: `docs/guides/platform-claude-code.md`
- Create: `docs/guides/platform-openclaw.md`

- [ ] **Step 1: Author guides** — how-to content for developers extending factor-echelon

- [ ] **Step 2: Commit in batches**

---

## Task 5: Documentation — examples

**Files:**
- Create: `docs/examples/tiny-landing-page/prd.md`
- Create: `docs/examples/tiny-landing-page/expected-team.yaml`
- Create: `docs/examples/medium-saas/prd.md`
- Create: `docs/examples/medium-saas/expected-team.yaml`

- [ ] **Step 1: Write worked examples** — real PRDs with the team factor-echelon would generate, annotated with rationale

- [ ] **Step 2: Commit** — `docs(examples): add worked example PRDs for tiny + medium tiers`

---

## Task 6: Documentation — positioning

**Files:**
- Create: `docs/positioning/executive-summary.md`
- Create: `docs/positioning/cost-model.md`
- Create: `docs/positioning/competitive-advantages.md`

- [ ] **Step 1: Port from BBT Executive Package** (`01-executive-summary.md`, `06-cost-model.md`, `10-competitive-advantages.md`)

- [ ] **Step 2: Adapt for public-facing use** (remove internal BBT-specific references, keep the pitch)

- [ ] **Step 3: Commit** — `docs(positioning): repackage BBT Executive Package content`

---

## Task 7: Release runbook

**Files:**
- Create: `docs/release/release-runbook.md`
- Create: `docs/release/CHANGELOG.md`

- [ ] **Step 1: Write release runbook** for manual v0.1 release

```markdown
# Release Runbook

## v0.1 (manual release)

1. Verify green CI on main: `gh run list --branch main --status success`
2. Full local test: `bun run lint && bun test && bun run build && bun run test:smoke && bun test tests/e2e/`
3. Update CHANGELOG.md with v0.1 release notes
4. Tag: `git tag -a v0.1.0 -m "Team Factory Echelon v0.1.0 alpha"`
5. Push tag: `git push origin v0.1.0`
6. Build skill artifacts locally: `bun run skill:build` (emits `dist/claude-code/`, `dist/openclaw/`, `dist/echelon/`)
7. Build Echelon desktop app via **cloud builder** (signed + notarized): `bun run echelon:build:cloud`
   → produces `release/Echelon-0.1.0-arm64.dmg` and `release/Echelon-0.1.0-arm64.zip`
8. Create GitHub release:
   `gh release create v0.1.0 dist/claude-code dist/openclaw dist/echelon release/Echelon-0.1.0-arm64.dmg release/Echelon-0.1.0-arm64.zip --title "v0.1.0" --notes-file docs/release/CHANGELOG.md`
9. **Echelon.app smoke test** on clean macOS: download the DMG from the release, install, launch, complete OOBE, spawn TBBT fixture season, verify one full task lifecycle (worktree → gates → Refinement → Leonard merge → KB capture)
10. Skill adapter smoke tests: install Claude Code plugin and OpenClaw bundle on clean machines for portability parity

## v0.5+ (automated release)

Triggered by tag push. See `.github/workflows/release.yml`.
```

- [ ] **Step 2: Seed CHANGELOG.md** with v0.1.0 notes

- [ ] **Step 3: Commit** — `docs(release): add release runbook + v0.1.0 CHANGELOG seed`

---

## Task 8: GitHub Actions — main + release

**Files:**
- Create: `.github/workflows/main.yml`
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Write `main.yml`** — on merge to main, run full test suite + upload artifacts

- [ ] **Step 2: Write `release.yml`** — on tag `v*.*.*`, build all targets, run E2E, create GitHub Release with artifacts attached

```yaml
name: Release
on:
  push:
    tags: ['v*.*.*']

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run lint
      - run: bun test
      - run: bun run build
      - run: bun run test:smoke
      - run: bun test tests/e2e/
      - name: Create release
        run: |
          gh release create ${{ github.ref_name }} \
            dist/claude-code \
            dist/openclaw \
            --title "${{ github.ref_name }}" \
            --notes-file docs/release/CHANGELOG.md
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 3: Commit** — `ci: add main + release workflows`

---

## Task 9: README polish

- [ ] **Step 1: Expand `README.md`** from the Plan 01 stub into a proper project front page

```markdown
# factor-echelon

Themed AI agent software development team factory. Drop in a PRD, pick a theme, get a live team ready to build.

## Quickstart

See [docs/quickstart.md](docs/quickstart.md) — 15 minutes from install to your first team.

## What you get

- 43 pre-authored archetype roles spanning Medium → Enterprise tiers
- 42 TBBT characters (plus Young Sheldon expansion) with full soul packages
- 12-character advisory board for cross-season specialist consultation
- Multi-model Counselor review (Gemini, GPT-5, Opus 4.6, Grok) at 4 high-leverage decision points
- Worktree-per-agent execution with 7 review gates + 5-star rating
- mempalace-backed knowledge base with solo (v0.1) and team (v0.5) modes
- Runs on Claude Code and OpenClaw (Hermes adapter in v0.5)

## Status

**v0.1 Alpha** — see [docs/specs/2026-04-08-factor-echelon-design.md](docs/specs/2026-04-08-factor-echelon-design.md) for the full design.

## Documentation

- [Quickstart](docs/quickstart.md)
- [Concepts](docs/concepts/)
- [Guides](docs/guides/)
- [Examples](docs/examples/)
- [Full design spec](docs/specs/2026-04-08-factor-echelon-design.md)

## Contributing

Contributions welcome. See [docs/guides/writing-an-archetype.md](docs/guides/writing-an-archetype.md) for adding new archetypes.

## License

MIT
```

- [ ] **Step 2: Commit** — `docs: expand README with feature summary and navigation`

---

## Task 10: v0.1 Release — the actual cut

- [ ] **Step 1: Final CI verification**
```bash
bun run lint && bun test && bun run build && bun run test:smoke && bun test tests/e2e/
```
All green.

- [ ] **Step 2: Update CHANGELOG.md with final v0.1.0 notes**

- [ ] **Step 3: Tag**
```bash
git tag -a v0.1.0 -m "factor-echelon v0.1.0 alpha"
```

- [ ] **Step 4: Verify tag is correct** — `git show v0.1.0`

- [ ] **Step 5: (Optional — user explicit authorization required) Push tag to GitHub**
```bash
git push origin v0.1.0
```

- [ ] **Step 6: Create GitHub release** — manual for v0.1, automated for v0.5+

```bash
gh release create v0.1.0 \
  --title "factor-echelon v0.1.0 alpha" \
  --notes-file docs/release/CHANGELOG.md
```

---

## Task 11: Verification + tag plan-10-complete

- [ ] **Step 1:** Tag
```bash
git tag -a plan-10-complete -m "Plan 10: Integration + Release complete. v0.1.0 shipped."
```

---

## Plan 10 Complete = v0.1 Alpha Ships

**What's shipped:**
- Full E2E test harness covering install → OOBE → season → task → merge → capture → archive → uninstall
- Per-target matrix tests (Claude Code + OpenClaw)
- 15-minute quickstart guide
- Complete concepts docs (architecture, flywheel, safety nets, seasons, worktrees, KB, counselor)
- Complete guides (writing archetypes/characters, customization, per-platform)
- Worked examples (tiny + medium tiers)
- Positioning docs (exec summary, cost model, competitive advantages) ported from BBT Executive Package
- Release runbook + CHANGELOG
- CI workflows for main + release
- Polished README
- **v0.1.0 tagged and released**

**Acceptance criteria from spec §10.1 — all met:**
1. ✅ Fresh clone → `npm install && bun run build` → valid Claude Code plugin AND valid OpenClaw bundle
2. ✅ Install → OOBE → drop PRD → live Season 01
3. ✅ First daily standup posts
4. ✅ Full task lifecycle: worktree → review gates → merge → capture
5. ✅ Counselor invocation demonstrates (Placement C deadlock escalation end-to-end)
6. ✅ Mid-season expansion proposal fires, user approves, new character spawns
7. ✅ Quickstart completes in <15 minutes on clean machine

**What's next:** Plan for v0.5 (Hermes adapter, full Star Wars theme, team-mode KB, automatic high-risk flagging, etc.) — a separate brainstorm + spec + plan cycle after v0.1 is in the field and generating feedback.
