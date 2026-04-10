# Plan 02: Content Library Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the complete v0.1 content library — all 43 archetypes, all 42 TBBT core-team characters with full soul packages, all 12 advisory board characters, and the Young Sheldon expansion subdirectory.

**Architecture:** Content-only plan. No new build code. Extends `src/team-factory/` with archetype definitions and character soul packages, all validated by the Plan 01 schema validators.

**Tech Stack:** Markdown + YAML. Schema validators from Plan 01 enforce correctness.

**Spec reference:** `docs/specs/2026-04-08-factor-echelon-design.md` §11.1 (43 archetypes with TBBT casting), §11.2 (12 advisory board SMEs), §11.3 (Young Sheldon expansion).

**Dependencies:** Plan 01 complete.

---

## File Structure

This plan creates content under:

```
src/team-factory/
├── archetypes/                    # 43 total (Plan 01 added ingestion-pm)
│   ├── ingestion-pm/              ← already exists from Plan 01
│   ├── user-handler/
│   ├── scrum-master/
│   ├── principal-architect/
│   ├── devops-infrastructure/
│   ├── frontend-engineer/
│   ├── backend-engineer/
│   ├── database-engineer/
│   ├── qa-lead/
│   ├── security-engineer/
│   ├── adversarial-reviewer/
│   ├── code-reviewer/
│   ├── refinement-builder/
│   ├── cicd-pipeline-engineer/
│   ├── technical-writer/
│   ├── sre-invisible-ops/
│   ├── incident-commander/
│   ├── ux-designer/
│   ├── ux-researcher/
│   ├── content-designer/
│   ├── product-manager/
│   ├── release-manager/
│   ├── dependency-auditor/
│   ├── performance-engineer/
│   ├── accessibility-engineer/
│   ├── localization-engineer/
│   ├── privacy-officer/
│   ├── developer-experience-engineer/
│   ├── mobile-ios-engineer/
│   ├── mobile-android-engineer/
│   ├── ml-engineer/
│   ├── data-engineer/
│   ├── test-automation-engineer/
│   ├── platform-engineer/
│   ├── appsec-engineer/
│   ├── technical-program-manager/
│   ├── data-scientist/
│   ├── dba/                        # Enterprise-depth of database-engineer
│   ├── developer-advocate/
│   ├── solution-architect/
│   ├── customer-success-engineer/
│   ├── mlops-engineer/
│   ├── ai-safety-engineer/
│   └── _template/                  # scaffold for future archetypes
│
├── themes/
│   ├── tbbt/
│   │   ├── theme.yaml              # update: full 42 characters listed
│   │   └── characters/             # Plan 01 added penny
│   │       ├── penny/              ← already exists
│   │       ├── leonard-hofstadter/
│   │       ├── mrs-davis/
│   │       ├── sheldon-cooper/
│   │       ├── howard-wolowitz/
│   │       ├── raj-koothrappali/
│   │       ├── stuart-bloom/
│   │       ├── bert-kibbler/
│   │       ├── bernadette-rostenkowski/
│   │       ├── barry-kripke/
│   │       ├── wil-wheaton/         # has Adversarial primary + DevRel secondary
│   │       ├── alex-jensen/
│   │       ├── leslie-winkle/
│   │       ├── dr-eric-gablehauser/
│   │       ├── amy-farrah-fowler/
│   │       ├── debbie-wolowitz/
│   │       ├── mike-rostenkowski/
│   │       ├── emily-sweeney/
│   │       ├── lucy/
│   │       ├── president-siebert/
│   │       ├── mrs-latham/
│   │       ├── beverly-hofstadter/
│   │       ├── dennis-kim/
│   │       ├── zack-johnson/
│   │       ├── mike-massimino/
│   │       ├── josh-wolowitz/
│   │       ├── ramona-nowitzki/
│   │       ├── alfred-hofstadter/
│   │       ├── priya-koothrappali/
│   │       └── neil-degrasse-tyson/
│   │
│   └── young-sheldon/               # NEW first-class bundled expansion
│       ├── theme.yaml
│       └── characters/
│           ├── mary-cooper/          # shared with TBBT canon
│           ├── missy-cooper/         # shared with TBBT canon
│           ├── meemaw/
│           ├── paige-swanson/
│           ├── hubert-givens/
│           ├── dale-ballard/
│           ├── george-cooper-sr/
│           ├── president-hagemeyer/
│           ├── dr-john-sturgis/
│           ├── dr-grant-linkletter/
│           ├── georgie-cooper/
│           ├── mandy-mcallister/
│           └── tam-nguyen/
│
├── advisory-board/                   # NEW — cross-season shared SMEs
│   ├── SKILL.md                      # consultation protocol
│   └── characters/
│       ├── stephen-hawking/          # Skill Promotion Oracle
│       ├── brian-greene/             # Model Providers SME
│       ├── ira-flatow/               # Enterprise AI Platforms SME
│       ├── stan-lee/                 # Agent Orchestration SME
│       ├── levar-burton/             # Vector Databases SME
│       ├── james-earl-jones/         # Event Orchestration SME
│       ├── george-smoot/             # Data/Analytics SME
│       ├── nathan-fillion/           # Auth/Identity SME
│       ├── buzz-aldrin/              # Infrastructure SME
│       ├── bill-nye/                 # Product/Integration SME
│       └── arthur-jeffries/          # Research Engine SME (per-theme)
```

---

## Task 1: Archetype `_template` scaffold

**Files:**
- Create: `src/team-factory/archetypes/_template/archetype.yaml`
- Create: `src/team-factory/archetypes/_template/description.md`
- Create: `src/team-factory/archetypes/_template/capabilities.yaml`

- [ ] **Step 1: Write scaffold files** with TODO placeholders matching the ingestion-pm pattern from Plan 01.

- [ ] **Step 2: Verify validators skip `_template`** by re-running `bun test tests/unit/validators.test.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/team-factory/archetypes/_template/
git commit -m "feat(archetypes): add _template scaffold for new archetypes"
```

---

## Task 2: Authoring all 42 remaining archetypes

**Pattern:** For each archetype in the 42-row list in §11.1 (excluding `ingestion-pm` already done), create three files following the `_template` pattern:
1. `archetype.yaml` with name, display_name, tier, canonical_source, role_summary, responsibilities, inputs, outputs, single_role flag
2. `description.md` human-facing description
3. `capabilities.yaml` with required and forbidden capabilities (reference §12.4 review gates and `capabilities/access-matrix.yaml` when it arrives in Plan 03)

**Break this task into 7 batches of 6 archetypes each** for commit granularity:

- [ ] **Batch 1: Core team & leadership (6)** — user-handler, scrum-master, principal-architect, devops-infrastructure, frontend-engineer, backend-engineer
  - Commit: `feat(archetypes): add core team & leadership archetypes (6)`

- [ ] **Batch 2: Implementation & data (6)** — database-engineer, qa-lead, security-engineer, adversarial-reviewer, code-reviewer, refinement-builder
  - Commit: `feat(archetypes): add implementation + quality archetypes (6)`

- [ ] **Batch 3: Ops & docs (6)** — cicd-pipeline-engineer, technical-writer, sre-invisible-ops, incident-commander, ux-designer, ux-researcher
  - Commit: `feat(archetypes): add ops, docs, UX archetypes (6)`

- [ ] **Batch 4: Product & compliance (6)** — content-designer, product-manager, release-manager, dependency-auditor, performance-engineer, accessibility-engineer
  - Commit: `feat(archetypes): add product & compliance archetypes (6)`

- [ ] **Batch 5: Specialization part 1 (6)** — localization-engineer, privacy-officer, developer-experience-engineer, mobile-ios-engineer, mobile-android-engineer, ml-engineer
  - Commit: `feat(archetypes): add specialization archetypes, part 1 (6)`

- [ ] **Batch 6: Specialization part 2 (6)** — data-engineer, test-automation-engineer, platform-engineer, appsec-engineer, technical-program-manager, data-scientist
  - Commit: `feat(archetypes): add specialization archetypes, part 2 (6)`

- [ ] **Batch 7: Customer-facing & AI (6)** — dba, developer-advocate, solution-architect, customer-success-engineer, mlops-engineer, ai-safety-engineer
  - Commit: `feat(archetypes): add customer-facing & AI archetypes (6)`

**After each batch:** run `bun test tests/unit/validators.test.ts && bun run build` and verify clean.

**DBA special handling:** `dba/archetype.yaml` should note `scales_from: database-engineer` and mark itself as an Enterprise-tier specialization, not a fully independent archetype. Per §11.1 row 38, this is the depth-scaling of Bert Kibbler's Database Engineer role.

**Wil Wheaton secondary:** `adversarial-reviewer/archetype.yaml` should have `single_role: true` and `secondary_roles_allowed: [developer-advocate]`. `developer-advocate/archetype.yaml` should note `canonical_secondary_of: adversarial-reviewer`.

---

## Task 3: TBBT characters — Tier 1 Primary Cast (6)

Author full TIER 1 soul packages for: leonard-hofstadter, sheldon-cooper, howard-wolowitz, raj-koothrappali, bernadette-rostenkowski, amy-farrah-fowler.

**Each character gets 5 files:** SOUL.md, AGENTS.md, HEARTBEAT.md, MEMORY.seed.md, persona.md.

**Reference the Penny pattern from Plan 01** for structure. Character content draws from:
- Research: `docs/research/themes/tbbt-cast.md` (when it exists)
- Canonical TBBT show details
- §11.1 role assignments and rationale

- [ ] **Batch 1 (3 chars): leonard-hofstadter, sheldon-cooper, howard-wolowitz**
  - Commit: `feat(characters): add TBBT primary cast batch 1 (Leonard, Sheldon, Howard)`

- [ ] **Batch 2 (3 chars): raj-koothrappali, bernadette-rostenkowski, amy-farrah-fowler**
  - Commit: `feat(characters): add TBBT primary cast batch 2 (Raj, Bernadette, Amy)`

**After each batch:** `bun run build && bun run test:smoke` must pass.

**Special note on Leonard:** `SOUL.md` must emphasize the consolidated User Handler / Delegator / Final Decision Maker / Merge Authority identity per §11.1 row 2. This is different from his canonical "Engineering Manager" role — the primary identity is as the user-facing leader.

---

## Task 4: TBBT characters — Extended Recurring Cast (10)

- [ ] **Batch 1 (3): stuart-bloom (Backend), bert-kibbler (Database), mrs-davis (Scrum Master)**
- [ ] **Batch 2 (3): alex-jensen (Code Review), leslie-winkle (Refinement), barry-kripke (Security)**
- [ ] **Batch 3 (2): wil-wheaton (Adversarial + DevRel secondary), dr-eric-gablehauser (CI/CD)**
  - **Wil Wheaton special:** SOUL.md must express both primary (Adversarial Reviewer) and secondary (DevRel) identities. The secondary role is explicitly called out in the frontmatter: `secondary_archetype: developer-advocate`.
- [ ] **Batch 4 (2): mike-rostenkowski (Incident Cmdr), debbie-wolowitz (Invisible Ops Daemon)**
  - **Debbie Wolowitz special:** Voice-only canonical character. SOUL.md must express her as "the presence that's always there but never seen" — event-driven, background-daemon personality. HEARTBEAT.md is unique: very short beat interval, never produces user-visible output except on failure detection.

Commit after each batch. Each commit: `feat(characters): add TBBT extended cast batch N (...)`.

---

## Task 5: TBBT characters — Deep Bench Extended Cast (9)

- [ ] **Batch 1 (3): emily-sweeney (UX Designer), lucy (Content Designer), president-siebert (Product Manager)**
- [ ] **Batch 2 (3): mrs-latham (Release Manager), beverly-hofstadter (Dependency Auditor), dennis-kim (Performance Engineer)**
- [ ] **Batch 3 (3): zack-johnson (Localization), josh-wolowitz (Mobile Android), ramona-nowitzki (ML Engineer)**

Each batch commit: `feat(characters): add TBBT extended cast deep bench batch N (...)`.

---

## Task 6: TBBT characters — Guest & Special (3)

- [ ] **Batch 1: alfred-hofstadter (Data Engineer), mike-massimino (Mobile iOS), neil-degrasse-tyson (AI Safety)**
  - **Mike Massimino special:** cast as himself (real-life TBBT guest astronaut). SOUL.md references his canonical ISS-mission appearance with Howard. Persona captures astronaut-engineer voice.
  - **Neil deGrasse Tyson special:** cast as himself, MOVED from advisory board to core team per §11.1 row 43. SOUL.md captures his "authoritative science communicator" voice applied to AI safety review.
- [ ] **priya-koothrappali (Legal/Compliance)** — one more character
  - Commit: `feat(characters): add TBBT guest cast + Priya (Legal)`

After Task 6 completes, all 42 core-team characters are authored.

---

## Task 7: Young Sheldon theme scaffolding

**Files:**
- Create: `src/team-factory/themes/young-sheldon/theme.yaml`

- [ ] **Step 1: Write `theme.yaml`**

```yaml
name: "young-sheldon"
version: "0.1.0"
description: "Young Sheldon — first-class bundled expansion for TBBT"
hierarchy_model: "flat-peer"
tags:
  - "sitcom"
  - "2010s-2020s"
  - "coming-of-age"
  - "east-texas"
  - "academic"
  - "family-driven"
  - "prequel"
expansion:
  bundled_themes:
    - "tbbt"  # bidirectional — TBBT expands into Young Sheldon and vice versa
characters:
  - mary-cooper
  - missy-cooper
  - meemaw
  - paige-swanson
  - hubert-givens
  - dale-ballard
  - george-cooper-sr
  - president-hagemeyer
  - dr-john-sturgis
  - dr-grant-linkletter
  - georgie-cooper
  - mandy-mcallister
  - tam-nguyen
```

- [ ] **Step 2: Commit**

```bash
git add src/team-factory/themes/young-sheldon/theme.yaml
git commit -m "feat(themes): add young-sheldon theme scaffold"
```

---

## Task 8: Young Sheldon characters (13)

Author full TIER 1 soul packages for all 13 Young Sheldon characters.

- [ ] **Batch 1 (3): mary-cooper, missy-cooper, meemaw**
  - Mary and Missy are shared with TBBT canon — the Young Sheldon soul packages reflect their younger-era identities
- [ ] **Batch 2 (3): paige-swanson, hubert-givens, dale-ballard**
- [ ] **Batch 3 (3): george-cooper-sr, president-hagemeyer, dr-john-sturgis**
- [ ] **Batch 4 (3): dr-grant-linkletter, georgie-cooper, mandy-mcallister**
- [ ] **Batch 5 (1): tam-nguyen** — also used as Advisory Board Backend/API SME; note `also_advisory_board: true` in frontmatter

Each batch commit: `feat(characters): add Young Sheldon batch N (...)`.

---

## Task 9: Advisory Board scaffold

**Files:**
- Create: `src/team-factory/advisory-board/SKILL.md`
- Create: `src/team-factory/advisory-board/consultation-protocol.md`

- [ ] **Step 1: Write `SKILL.md`** — orchestrates how core-team characters consult SMEs.

- [ ] **Step 2: Write `consultation-protocol.md`** — format for queries, SME selection heuristics, response aggregation, logging to mempalace.

- [ ] **Step 3: Commit** — `feat(advisory-board): add scaffold and consultation protocol`

---

## Task 10: Advisory Board characters (11 + 1)

All 12 advisory board characters with full TIER 1 soul packages. Advisory board characters differ slightly from core-team characters:
- HEARTBEAT.md is lightweight (they don't run continuously, they're consulted)
- AGENTS.md focuses on consultation response format
- MEMORY.seed.md includes their domain knowledge specialty

- [ ] **Batch 1 (3): stephen-hawking (Escalation Oracle), brian-greene (Model Providers), ira-flatow (Enterprise AI Platforms)**
- [ ] **Batch 2 (3): stan-lee (Agent Orchestration), levar-burton (Vector DBs), james-earl-jones (Event Orchestration)**
- [ ] **Batch 3 (3): george-smoot (Data/Analytics), nathan-fillion (Auth/Identity), buzz-aldrin (Infrastructure)**
- [ ] **Batch 4 (2): bill-nye (Product/Integration), arthur-jeffries (Research Engine — TBBT-specific)**

Each batch commit: `feat(advisory-board): add SME batch N (...)`.

**Stephen Hawking special:** SOUL.md must explicitly state single-role — no overloading with AI Safety or other core-team roles. He is the Escalation Oracle only.

**Arthur Jeffries / Prof. Proton special:** This character is PER-THEME. For TBBT, Arthur Jeffries plays the Research Engine. For Star Wars (Plan in v0.5), Jocasta Nu plays the equivalent. Note `per_theme: true` in frontmatter.

---

## Task 11: Update `themes/tbbt/theme.yaml` with full character list

- [ ] **Step 1: Replace Plan 01's stub theme.yaml** with the full 30-character list from TBBT core team plus shared Mary/Missy

- [ ] **Step 2: Add `expansion.bundled_themes: [young-sheldon]`**

- [ ] **Step 3: Build + verify**
```bash
bun run build
bun run test:smoke
```
Expected: all tests still pass; `dist/claude-code/character-index.json` now contains all 42+13 characters.

- [ ] **Step 4: Commit** — `feat(themes): update TBBT theme.yaml with full character roster + Young Sheldon expansion`

---

## Task 12: Validation sweep

- [ ] **Step 1:** Run full validator
```bash
bun test tests/unit/validators.test.ts
```
Expected: all characters pass schema validation.

- [ ] **Step 2:** Verify character count
```bash
ls src/team-factory/themes/tbbt/characters/ | wc -l        # should show 30 (27 + 3 from TBBT-only, Plan 01 had 1)
ls src/team-factory/themes/young-sheldon/characters/ | wc -l  # should show 13
ls src/team-factory/advisory-board/characters/ | wc -l    # should show 12 (11 SMEs + Hawking)
ls src/team-factory/archetypes/ | wc -l                   # should show 44 (43 + _template)
```

- [ ] **Step 3:** Tag
```bash
git tag -a plan-02-complete -m "Plan 02: Content Library complete"
```

---

## Plan 02 Complete

**What's shipped:**
- All 43 archetypes authored and schema-validated
- All 42 TBBT core-team characters with full TIER 1 soul packages
- All 13 Young Sheldon characters with full TIER 1 soul packages (Young Sheldon is a first-class bundled expansion of TBBT)
- All 12 advisory board characters (11 SMEs + Stephen Hawking as Escalation Oracle)
- Updated TBBT theme.yaml declaring Young Sheldon expansion
- Build still produces a valid Claude Code plugin
- All smoke tests still pass

**What's next:** Plan 03 — Composition Engine (roster-composer + theme-engine + capabilities matrix).
