# factor-echelon Design Specification

**Date:** 2026-04-08
**Status:** Draft, pre-review
**Author:** Scott Newmann (with Claude Code)

---

## 1. Executive Summary

**factor-echelon is a portable skill package that generates themed AI-agent software development teams on demand.** A user picks a theme (e.g., The Big Bang Theory, Star Wars), drops in a work intake (a PRD, a repo URL, or a freeform description), and gets a fully-realized team of themed agents that spin up, build the work, self-review through multiple gates, and grow as the project expands.

The package targets three agent orchestration platforms at v1: Claude Code, OpenClaw, and Hermes (Nous Research). The canonical skill source is platform-neutral — authored once in an agentskills.io-compliant structure — and a build pipeline produces distribution artifacts for each target platform. The architecture is layered and source-first: edits happen in one place, builds are deterministic, and CI enforces cross-target consistency.

Beyond the skill itself, factor-echelon carries five architectural layers that make the generated teams usable at real scale: a **per-season isolation model** (each project = one thematic team in its own workspace), a **cross-season advisory board** (shared SMEs for specialist consultation), a **worktree-per-agent execution model** (parallel work, gated merges), a **knowledge base layer built on mempalace** (growing institutional memory with solo and team modes), and **the Counselor** — a multi-model council (Gemini Pro, GPT-5, Claude Opus 4.6, Grok) that reviews at high-leverage decision points (skill promotion, design review, deadlock escalation, high-risk adversarial review) to catch what any single model misses.

This spec captures all six design sections (architecture, components, data flow, error handling, testing, phasing), the theoretical foundation, the full archetype library grounded in published research, the TBBT and Star Wars cast catalogs, the deployment architecture, and the phased delivery plan from alpha through v1.

---

## 2. Problem Statement

AI-agent development teams exist today as either (a) monolithic single-purpose skills that do one thing well but can't scale into a full team, or (b) ad-hoc collections of prompts and agents that work briefly before collapsing under their own complexity. The team roster is either hard-coded and never grows with the project, or it drifts out of sync with the work and quality degrades. Existing solutions don't address the content layer — agent personalities are thin, interactions feel mechanical, and there's no continuity across sessions.

factor-echelon solves four concrete problems:

1. **Roster rigidity.** Most agent systems ship with a fixed team composition that doesn't adapt as a project's needs change. factor-echelon treats the roster as continuous — Penny (the Ingestion PM) reads the work and provisions a starting team, Leonard (the User Handler) runs the project and triggers expansion when new needs are detected, and the system grows from 10 agents to 40+ as a Medium-tier project becomes an Enterprise one.
2. **Thin agent identity.** Agents in most systems are defined by a single prompt. Real teams have personalities. factor-echelon gives every agent a full soul package — SOUL.md (identity), AGENTS.md (operational runbook), HEARTBEAT.md (cadence), MEMORY.md (working context), USER.md (relationship to the human), COMMITMENTS.md (promises made), and DEPLOY-CHECKLIST.md (deployment runbook).
3. **No cross-session memory.** Agents forget everything between sessions. factor-echelon uses mempalace as a growing, searchable knowledge base that captures learnings, decisions, patterns, and autonomous skill creation. Solo users get a local git-backed KB; team users upgrade to an Azure-backed centralized store with private-per-user + shared-team wings.
4. **Lock-in to a single platform.** Agent skills are usually written for one platform (Claude Code plugins, OpenClaw bundles, or Hermes skills). factor-echelon targets all three by authoring once in an agentskills.io-compliant format and building adapters per target.

---

## 3. Goals and Non-Goals

### 3.1 Goals

- **G1.** Produce a single source-of-truth skill package that builds cleanly for Claude Code, OpenClaw, and Hermes (at v1).
- **G2.** Generate fully-realized themed teams where every agent has a complete soul package and persistent identity.
- **G3.** Support continuous roster expansion as project work reveals new role needs.
- **G4.** Ship with The Big Bang Theory as the primary preset theme (fully polished) and Star Wars as a second reference theme (expansion-ready).
- **G5.** Support user-defined custom themes via runtime synthesis (v1).
- **G6.** Enforce a worktree-per-agent execution model with parallel review gates and serialized merges.
- **G7.** Integrate mempalace as the knowledge base layer, supporting solo and team deployment modes with a clean upgrade path.
- **G8.** Provide industry-grounded role taxonomies at Medium / Large / Enterprise tiers, with explicit role-split trigger points.

### 3.2 Non-Goals

- **NG1.** factor-echelon does NOT build its own agent orchestration runtime. It targets existing platforms (Claude Code, OpenClaw, Hermes) and delegates execution to them.
- **NG2.** factor-echelon does NOT ship custom-theme synthesis in v0.1 alpha — it's deferred to v1.
- **NG3.** factor-echelon does NOT provide a web UI in v0.1. OOBE and operations are CLI/chat-driven through the host platform.
- **NG4.** factor-echelon does NOT aim for multi-tenant SaaS deployment in v0.1 or v1. That's a v1+ concern.
- **NG5.** factor-echelon does NOT ship with all themes. Preset themes ship with the package; custom themes are generated on demand; additional preset themes are a v1+ content investment.

---

## 4. Theoretical Foundation

The archetype library and roster composer draw from published industry research, not first-principles guessing. Two frameworks anchor the design:

**Team Topologies** (Matthew Skelton & Manuel Pais, 2019) defines four team types every engineering organization eventually needs:
- **Stream-aligned teams** — ship product directly to users
- **Platform teams** — build internal products that accelerate stream teams
- **Enabling teams** — coach and uplift other teams through expertise
- **Complicated-subsystem teams** — deep expertise in one specialized area

factor-echelon's archetypes map onto these four team types. A continuous-composer decision to spawn a new archetype should be justifiable by "which team type does this belong to, and why doesn't one of the existing teams absorb it?"

**Conway's Law** — organizations ship systems that mirror their communication structures. factor-echelon embraces this: theme choice and structural hierarchy directly shape how the generated team collaborates. Star Wars implies a Jedi-council-plus-padawan hierarchy; TBBT implies a flatter academic peer structure; F1 pit crew implies a principal-plus-specialists command chain.

**Canonical industry sources for the role taxonomy:**
- Skelton & Pais, *Team Topologies* (teamtopologies.com/book)
- Kniberg & Ivarsson, *Scaling Agile @ Spotify* (2012) — and Jeremiah Lee's "Failed #SquadGoals" counter (a former Spotify engineer explaining why the model didn't work at Spotify either)
- Beyer et al., *Site Reliability Engineering* (sre.google/sre-book)
- Forsgren, Humble, Kim, *Accelerate* (DORA research)
- Will Larson, *Staff Engineer* (staffeng.com)
- FinOps Foundation Framework (finops.org/framework)
- GitLab Engineering Handbook (handbook.gitlab.com/handbook/engineering)

Important finding: the Spotify model is the most-cited and most-misapplied team structure. Use the vocabulary (Squad, Tribe, Chapter, Guild) but not as a reference architecture — Team Topologies is the better formal model for factor-echelon's composer.

---

## 5. Architecture

### 5.1 Architectural model: source → build → targets

```
  ┌─────────────────┐
  │  src/team-      │   ← canonical skill lives here
  │  factory/       │     edits happen here only
  │  (agentskills.io)│
  └────────┬────────┘
           │
           │  build pipeline
           │  (lint → validate → transform per target)
           ▼
  ┌─────────────────┐
  │  dist/          │   ← generated, gitignored
  │                 │
  │  ├─ claude-     │
  │  │   code/      │   Claude Code plugin
  │  ├─ openclaw/   │   OpenClaw bundle
  │  ├─ echelon/    │   Echelon season pack (primary host, v0.1)
  │  └─ hermes/     │   agentskills.io package (v0.5)
  └────────┬────────┘
           │
           │  release pipeline (on git tag)
           ▼
  ┌─────────────────┐
  │ GitHub Release  │   versioned artifacts
  │ + CHANGELOG     │
  └─────────────────┘
```

### 5.2 Three architectural invariants

**I1. One canonical source.** `src/team-factory/` is the only place a human edits skill content. Adapters never contain skill logic — they only hold platform-specific packaging metadata.

**I2. Builds are deterministic and reproducible.** Given the same `src/`, the build always produces the same `dist/`. CI builds on every PR; release builds on every tag. No human ever hand-assembles a target artifact.

**I3. The canonical format is agentskills.io.** Rather than inventing a custom DSL, the source lives in the agentskills.io-compliant structure that Hermes consumes natively and Claude Code is compatible with. Adapters are thin transforms: Claude Code plugin wraps agentskills.io in a plugin manifest, OpenClaw bundles it with an install script and config schema, Echelon emits a season-pack bundle that its Electron runtime loads, and Hermes consumes the canonical format directly.

**I4. Echelon is the primary host runtime for v0.1.** Per Plan 11 (Team Factory Echelon), the Dorothy Electron fork is absorbed into this repo and rebranded as Echelon — a desktop command center that hosts seasons, characters, worktrees, review gates, KB, and Counselor invocation. Claude Code and OpenClaw remain buildable targets for portability, but v0.1 ships primarily as `Echelon.app`. The canonical source in `src/team-factory/` is unchanged by this decision; only the target matrix grows.

**Consequence:** the first unit of work in alpha is converting the existing monolithic `team-factory.skill` file into the agentskills.io-compliant structured `src/` layout. This is real work and it's the work that makes everything else possible.

### 5.3 Five architectural layers

The product has five distinct runtime layers that must work together:

1. **Core team layer** — the per-project team generated by the roster composer, mapped to theme characters, bound with scoped capabilities, and running on the target platform. One team per season, one theme per team.
2. **Advisory board layer** — cross-season specialist personas (Stephen Hawking, Neil deGrasse Tyson, Bill Nye, etc. in TBBT; Yoda, Jocasta Nu, Qui-Gon Jinn in Star Wars). Instantiated once per user install, consulted on-demand by any season's agents.
3. **Worktree execution layer** — each task-bearing agent works in an isolated git worktree. Parallel review gates (architecture, code, QA, security, adversarial, UI) run concurrently; merges are serialized through Leonard as merge authority.
4. **Knowledge base layer** — mempalace-backed growing memory. Solo mode uses local ChromaDB + git sync. Team mode connects to an Azure-hosted centralized backend. Private-per-user wings coexist with shared-team wings.
5. **Counselor layer** — a multi-model council that reviews at high-leverage decision points. Four independent models (Gemini Pro, GPT-5, Claude Opus 4.6, Grok) weigh in at skill promotion, major design review, deadlock escalation, and high-risk adversarial review. The council is theme-agnostic at the model level; each theme designates a convener character who initiates invocations (Stephen Hawking for TBBT, Yoda for Star Wars). Full specification in §13.

---

## 6. Components

### 6.1 `src/team-factory/` — the canonical skill

```
src/team-factory/
├── SKILL.md                              # root orchestrator / foreman entrypoint
├── skill.yaml                            # metadata: name, version, platform matrix
│
├── oobe/                                 # first-run + deploy-time
│   ├── SKILL.md                          # theme-picker + ingestion flow
│   ├── user-profile-interview.md         # interview to populate USER.md at deploy
│   └── deploy-checklist-generator.md     # produces DEPLOY-CHECKLIST.md from target config
│
├── themes/                               # content-heavy: pre-written casts per theme
│   ├── tbbt/                             # hero theme for alpha
│   │   ├── theme.yaml                    # metadata, hierarchy, character slots, tags
│   │   ├── structure.md                  # physicist-peer hierarchy rules
│   │   ├── expansion.yaml                # declares young-sheldon as bundled expansion
│   │   ├── role-mapping.yaml             # archetype → preferred character
│   │   └── characters/                   # one subdir per themed character
│   │
│   ├── young-sheldon/                    # first-class expansion theme (v0.1, bundled with TBBT)
│   │   ├── theme.yaml
│   │   ├── structure.md                  # east texas / academic hierarchy
│   │   ├── expansion.yaml                # bidirectional link back to tbbt
│   │   └── characters/
│   │       ├── meemaw/
│   │       ├── paige-swanson/
│   │       ├── hubert-givens/
│   │       ├── dale-ballard/
│   │       ├── george-cooper-sr/
│   │       ├── president-hagemeyer/
│   │       ├── dr-john-sturgis/
│   │       ├── dr-grant-linkletter/
│   │       ├── georgie-cooper/
│   │       ├── mandy-mcallister/
│   │       └── tam-nguyen/               # also used as TBBT Advisory Board Backend/API SME
│   │       ├── leonard/
│   │       │   ├── SOUL.md               # TIER 1 — ships with theme
│   │       │   ├── AGENTS.md             # TIER 1 — ships with theme
│   │       │   ├── HEARTBEAT.md          # TIER 1 — ships with theme
│   │       │   ├── MEMORY.seed.md        # TIER 1 — seed, drifts at runtime
│   │       │   ├── persona.md            # prose style, mannerisms
│   │       │   └── prompts/              # role-specific prompt fragments
│   │       ├── sheldon/
│   │       ├── penny/
│   │       ├── howard/
│   │       ├── raj/
│   │       ├── bernadette/
│   │       ├── amy/
│   │       ├── barry-kripke/
│   │       ├── wil-wheaton/
│   │       ├── leslie-winkle/
│   │       ├── alex-jensen/
│   │       ├── bert-kibbler/
│   │       ├── mrs-davis/
│   │       ├── mike-rostenkowski/
│   │       ├── stuart-bloom/
│   │       ├── beverly-hofstadter/
│   │       ├── president-siebert/
│   │       ├── mary-cooper/
│   │       ├── debbie-wolowitz/
│   │       └── arthur-jeffries/          # Prof. Proton, mentor SME
│   │
│   └── star-wars/                        # reference theme for alpha (stub quality)
│       ├── theme.yaml
│       ├── structure.md
│       ├── expansion.yaml
│       ├── role-mapping.yaml
│       └── characters/
│           ├── leia/                     # User Handler
│           ├── obi-wan/                  # Principal Architect
│           ├── mon-mothma/               # Engineering Manager
│           ├── han-solo/                 # Adversarial Reviewer
│           ├── jocasta-nu/               # Research Engine / Docs
│           └── ...                       # full v0.5, stub v0.1
│
├── archetypes/                           # theme-agnostic role blueprints
│   ├── _template/                        # scaffold for new archetype
│   ├── ingestion-pm/
│   ├── user-handler/
│   ├── principal-architect/
│   ├── devops-infrastructure/
│   ├── frontend-engineer/
│   ├── backend-engineer/
│   ├── qa-lead/
│   ├── security-engineer/
│   ├── adversarial-reviewer/
│   ├── code-reviewer/
│   ├── refinement-builder/
│   ├── cicd-pipeline-engineer/
│   ├── database-engineer/
│   ├── technical-writer/
│   ├── scrum-master/
│   ├── ux-designer/
│   ├── release-manager/
│   ├── incident-commander/
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
│   ├── ux-researcher/
│   ├── content-designer/
│   ├── analytics-engineer/
│   ├── test-automation-engineer/
│   ├── platform-engineer/
│   ├── appsec-engineer/
│   ├── technical-program-manager/
│   ├── data-scientist/
│   ├── dba/
│   ├── developer-advocate/
│   ├── solution-architect/
│   ├── customer-success-engineer/
│   ├── mlops-engineer/
│   ├── ai-safety-engineer/
│   └── data-governance-lead/
│   # Total alpha archetype library: ~43 archetypes
│
├── advisory-board/                       # cross-season shared SMEs
│   ├── SKILL.md                          # consultation protocol
│   └── archetypes/
│       ├── model-providers/
│       ├── enterprise-ai-platforms/
│       ├── agent-orchestration/
│       ├── backend-api/
│       ├── vector-databases/
│       ├── event-orchestration/
│       ├── data-analytics/
│       ├── auth-identity/
│       ├── infrastructure/
│       ├── product-integration/
│       └── research-engine/              # per-theme: Prof. Proton (TBBT), Jocasta Nu (SW)
│
├── roster-composer/                      # work → archetype list + counts
│   ├── SKILL.md
│   ├── scope-estimator.md                # PRD complexity → tier assignment
│   ├── split-trigger-rules.md            # when to spawn specialized sub-archetypes
│   └── continuous-expansion.md           # mid-season expansion logic
│
├── theme-engine/                         # archetype + theme → themed instance
│   ├── SKILL.md
│   ├── mapping.md                        # archetype → character assignment
│   ├── expansion.md                      # runtime tag-matching neighbor search
│   └── synthesis.md                      # custom-theme character generation (v1+)
│
├── capabilities/                         # RBAC matrix
│   └── access-matrix.yaml                # archetype → scoped shared-skills
│
├── shared-skills/                        # tool-skills; access gated by capabilities
│   ├── source-control/
│   │   ├── github/
│   │   ├── azure-devops/
│   │   └── gitlab/
│   ├── prd-intake/
│   ├── quality-gate/
│   ├── inter-agent-protocol/
│   ├── backchannel/                      # cross-agent coordination
│   ├── git-worktrees/                    # per-agent worktree primitives
│   ├── knowledge-capture/                # write to mempalace
│   ├── knowledge-retrieval/              # query mempalace
│   ├── review-rating/                    # 5-star rating capture
│   ├── counselor-invocation/             # multi-model council primitives (see §13)
│   ├── web-search/
│   └── file-ops/
│
├── counselor/                            # multi-model council (§13)
│   ├── SKILL.md                          # invocation protocol, convener dispatch
│   ├── models.yaml                       # Gemini Pro, GPT-5, Opus 4.6, Grok
│   ├── consensus-rules.yaml              # per-placement consensus algorithm
│   ├── conveners-per-theme.yaml          # TBBT=Hawking, SW=Yoda, ...
│   └── placements/                       # placement-specific prompt templates
│       ├── skill-promotion.md
│       ├── design-review.md
│       ├── deadlock-escalation.md
│       └── high-risk-adversarial.md
│
├── seasons/                              # season lifecycle primitives
│   ├── SKILL.md                          # spawn-season, end-season, list-seasons
│   ├── isolation-protocol.md             # workspace / channel / cron isolation
│   ├── season-manifest-schema.yaml       # Penny's handoff artifact schema
│   └── cross-season-learning.md          # what's shared (advisory board), what isn't
│
├── templates/                            # TIER 2 generators (produced at deploy)
│   ├── USER.md.template
│   ├── DEPLOY-CHECKLIST.md.template
│   ├── COMMITMENTS.md.template           # starts empty
│   ├── openclaw.json.template
│   └── claude-code-plugin.json.template
│
├── protocols/                            # formal schemas
│   ├── soul-schema.yaml                  # 7-file character package
│   ├── theme-schema.yaml
│   ├── roster-manifest-schema.yaml
│   ├── handoff-protocol.md
│   ├── capability-protocol.md            # RBAC enforcement at runtime
│   ├── review-gate-protocol.md           # 6-gate pipeline + merge rules
│   ├── rating-system-protocol.md         # 5-star + hybrid scheme
│   └── quality-framework.md
│
└── examples/
    ├── prd-small-landing-page.md
    ├── prd-medium-saas.md
    ├── prd-large-multi-platform.md
    ├── generated-team-tbbt-small.yaml
    ├── generated-team-tbbt-medium.yaml
    └── generated-team-starwars-medium.yaml
```

### 6.2 `adapters/` — thin platform wrappers

```
adapters/
├── claude-code/
│   ├── adapter.yaml                      # how to package src/ as Claude Code plugin
│   ├── plugin.json                       # Claude Code plugin manifest template
│   └── README.md                         # install instructions
├── openclaw/
│   ├── adapter.yaml
│   ├── openclaw.json                     # OpenClaw-specific config schema
│   ├── install.sh                        # install script shipped with bundle
│   └── README.md
└── hermes/                               # v0.5
    ├── adapter.yaml
    ├── agentskills.yaml                  # Hermes/agentskills.io manifest
    └── README.md
```

Adapters contain zero skill logic. If an adapter grows real logic, that's a signal the core needs to expose a new hook, not that the adapter should get smarter.

### 6.3 `build/` — the build pipeline

```
build/
├── build.ts                              # main build orchestrator (Bun or Node)
├── targets/
│   ├── claude-code.ts                    # transform src → dist/claude-code/
│   ├── openclaw.ts                       # transform src → dist/openclaw/
│   └── hermes.ts                         # transform src → dist/hermes/
├── lib/
│   ├── skill-parser.ts                   # reads src/, returns typed AST
│   ├── validators.ts                     # schema checks against agentskills.io spec
│   └── transformers.ts                   # shared transform utilities
└── package.json                          # build-time deps only
```

### 6.4 `tests/` — the validation harness

```
tests/
├── unit/                                 # skill-parser, transformers, validators
├── integration/                          # build pipeline end-to-end per target
├── smoke/                                # "does the built artifact load in each target"
│   ├── claude-code.test.ts
│   ├── openclaw.test.ts
│   └── hermes.test.ts                    # v0.5
└── fixtures/
    ├── prds/
    ├── themes/
    │   ├── test-theme-minimal/
    │   └── test-theme-broken/
    ├── repos/
    └── user-profiles/
```

### 6.5 `docs/` — user-facing documentation

```
docs/
├── README.md → symlinked from root
├── quickstart.md
├── specs/
│   └── 2026-04-08-factor-echelon-design.md    # this document
├── concepts/
│   ├── architecture.md                   # adapted from 02-architecture-overview.md
│   ├── the-flywheel.md                   # adapted from 04-development-flywheel.md
│   ├── safety-nets.md                    # adapted from 05-safety-nets.md
│   ├── seasons.md                        # NEW — season isolation model
│   ├── worktree-execution.md             # NEW — worktree-per-agent pattern
│   └── knowledge-base.md                 # NEW — mempalace integration
├── guides/
│   ├── writing-an-archetype.md
│   ├── writing-a-theme.md
│   ├── customizing-the-roster.md
│   ├── platform-claude-code.md
│   ├── platform-openclaw.md
│   └── platform-hermes.md                # v0.5
├── research/                             # source material from research agents
│   ├── team-composition.md
│   ├── themes/
│   │   ├── tbbt-cast.md
│   │   └── star-wars-cast.md
│   └── mempalace-integration.md
├── positioning/                          # "why this matters" content
│   ├── executive-summary.md              # adapted from 01-executive-summary.md
│   ├── cost-model.md                     # adapted from 06-cost-model.md
│   └── competitive-advantages.md         # adapted from 10-competitive-advantages.md
└── examples/
```

### 6.6 `.github/workflows/` — CI/CD

```
.github/workflows/
├── pr.yml                                # on PR: lint + test + build all targets
├── main.yml                              # on merge to main: + smoke + upload artifacts
└── release.yml                           # on tag: build + E2E + create GitHub Release
```

### 6.7 Root files

- `README.md`
- `CHANGELOG.md` (Keep-a-Changelog format)
- `LICENSE`
- `.gitignore`
- `biome.json` or equivalent linter config
- `package.json` (workspace root for build tooling)

---

## 7. Data Flow

### 7.1 Build-time flow

```
src/ ──▶ lint + validate ──▶ build targets ──▶ dist/{claude-code,openclaw,hermes}/
                                                   │
                                                   ▼
                                           on tag: GitHub Release
```

Deterministic. Same `src/` always produces same `dist/`. CI enforces.

### 7.2 Runtime flow — installation and OOBE

```
1. INSTALL
   User installs adapter for target platform
   (Claude Code plugin / OpenClaw bundle / Hermes skill)
     │
     ▼
2. OOBE — pick default theme
   [1] The Big Bang Theory (default, primary)
   [2] Star Wars
   [3] Describe your own (custom synthesis — v1+)
   Selection persisted to user config
     │
     ▼
3. OOBE — Advisory Board provisioning
   All SME archetypes instantiated once, shared across every future season.
   Per-theme character casting (Prof. Proton for TBBT research engine,
   Jocasta Nu for Star Wars, etc.)
   Lives at ~/.factor-echelon/advisory-board/
     │
     ▼
4. OOBE — KB mode selection
   Solo (default) — local mempalace + git-backed sync
   Team — Azure-backed centralized team wing + local private wing
```

### 7.2a OOBE State Machine

OOBE is resumable, idempotent, and checkpointed. Each step persists state to `~/.factor-echelon/config.yaml` and `~/.factor-echelon/.oobe-state`. Resuming OOBE picks up at the first unchecked step.

```
     ┌─────────────────────────────────────────────────────────┐
     │  State: NOT_STARTED                                      │
     └──────────────────────────┬──────────────────────────────┘
                                │
                                ▼
     ┌─────────────────────────────────────────────────────────┐
     │  Step 1: PLATFORM_PREREQS                                │
     │  Check: git, bun/node, disk space, target platform      │
     │  Skippable: no                                           │
     │  Checkpoint: platform_check_passed                       │
     └──────────────────────────┬──────────────────────────────┘
                                │
                                ▼
     ┌─────────────────────────────────────────────────────────┐
     │  Step 2: USER_PROFILE_INTERVIEW                          │
     │  Collect: name, timezone, role, team context,           │
     │           preferred channels, hardware, comms prefs     │
     │  Skippable: no (minimum fields required)                │
     │  Resumable: yes (per-field)                             │
     │  Checkpoint: user_profile_complete                       │
     └──────────────────────────┬──────────────────────────────┘
                                │
                                ▼
     ┌─────────────────────────────────────────────────────────┐
     │  Step 3: THEME_SELECTION                                 │
     │  [1] TBBT (default)                                     │
     │  [2] Star Wars                                          │
     │  [3] Custom synthesis (v1+, disabled in v0.1)           │
     │  Skippable: no                                           │
     │  Checkpoint: default_theme_selected                      │
     └──────────────────────────┬──────────────────────────────┘
                                │
                                ▼
     ┌─────────────────────────────────────────────────────────┐
     │  Step 4: COUNSELOR_API_KEY_SETUP                         │
     │  Collect API keys for 4 models:                         │
     │    - Gemini Pro (Google AI Studio)                      │
     │    - GPT-5 (OpenAI)                                     │
     │    - Claude Opus 4.6 (Anthropic)                        │
     │    - Grok (xAI)                                         │
     │  Validate each with a tiny test call                    │
     │  Skippable: yes, but Counselor placements disabled       │
     │             until keys are provided (warning shown)     │
     │  Checkpoint: counselor_keys_stored                       │
     │  Storage: OS keychain (macOS Keychain, Linux Secret      │
     │           Service, Windows Credential Manager)          │
     └──────────────────────────┬──────────────────────────────┘
                                │
                                ▼
     ┌─────────────────────────────────────────────────────────┐
     │  Step 5: KB_MODE_SELECTION                               │
     │  [1] Solo (default, v0.1 recommended)                   │
     │  [2] Team (v0.5+, requires Azure backend URL)           │
     │  Skippable: no                                           │
     │  Checkpoint: kb_mode_configured                          │
     └──────────────────────────┬──────────────────────────────┘
                                │
                                ▼
     ┌─────────────────────────────────────────────────────────┐
     │  Step 6: MEMPALACE_INIT                                  │
     │  - Install mempalace if not present (pinned version)    │
     │  - Initialize local ChromaDB at                          │
     │    ~/.factor-echelon/knowledge-base/local/              │
     │  - Create kb-git mirror at                               │
     │    ~/.factor-echelon/knowledge-base/kb-git/             │
     │  - Register mempalace MCP server with target platform   │
     │  Skippable: no                                           │
     │  Checkpoint: kb_initialized                              │
     └──────────────────────────┬──────────────────────────────┘
                                │
                                ▼
     ┌─────────────────────────────────────────────────────────┐
     │  Step 7: ADVISORY_BOARD_PROVISIONING                     │
     │  - Instantiate all 12 advisory board characters          │
     │    (11 SMEs + Stephen Hawking escalation oracle)         │
     │  - Cast using the chosen theme (Prof. Proton for TBBT    │
     │    Research Engine; per-theme research engine only)      │
     │  - Store at ~/.factor-echelon/advisory-board/            │
     │  Skippable: yes, but consultation + Counselor A/B fail   │
     │             until provisioned (prompted on first need)  │
     │  Partial-fail tolerant: if N of 12 fail, log, continue   │
     │  Checkpoint: advisory_board_provisioned                  │
     └──────────────────────────┬──────────────────────────────┘
                                │
                                ▼
     ┌─────────────────────────────────────────────────────────┐
     │  Step 8: CHANNEL_CONFIG (optional)                       │
     │  Configure default channels for season spawns:          │
     │    - Discord / Slack / Telegram / Matrix (bot tokens)   │
     │    - Out-of-band escalation (email, SMS)                │
     │  Skippable: yes, channels can be configured at first     │
     │             season spawn instead                         │
     │  Checkpoint: channels_configured                         │
     └──────────────────────────┬──────────────────────────────┘
                                │
                                ▼
     ┌─────────────────────────────────────────────────────────┐
     │  State: COMPLETE                                         │
     │  Write config.yaml final state, run welcome message     │
     │  User is now ready to drop a PRD into #pennys-apartment │
     └─────────────────────────────────────────────────────────┘
```

**Resume semantics:** `factor-echelon init` at any point re-enters the state machine at the first unchecked step. Previously-completed steps are shown but not re-run. Users can force re-run via `factor-echelon init --reset` (requires confirmation, archives old config).

**Skip rules:**
- Steps 1, 2, 3, 5, 6 are mandatory — OOBE cannot complete without them.
- Step 4 (Counselor keys) is skippable with a warning; Counselor placements A, B, C, D are disabled but all other functionality works.
- Step 7 (Advisory Board) is skippable but lazy-provisions on first consultation attempt. This extends first-consultation latency but is user-friendly.
- Step 8 (Channels) is always skippable; deferred to first season spawn.

### 7.3 Runtime flow — new season (per project)

```
1. WORK DROP
   User drops PRD, repo URL, or description
   Lands in #pennys-apartment (or platform equivalent channel)
     │
     ▼
2. THEME OVERRIDE PROMPT
   "Default theme is TBBT. Use for this season, or pick a different one?"
   If user picks non-default, season uses that theme exclusively
     │
     ▼
3. INGESTION (Penny)
   - Reads PRD / inspects repo via shared-skills/source-control (scoped)
   - Estimates scope and cost
   - Assigns tier (Medium / Large / Enterprise)
   - Produces initial work manifest
   - Queries mempalace for relevant prior learnings
   - Builds initial roster (small: ~10 archetypes; starts lean, grows)
     │
     ▼
4. THEME MAPPING
   theme-engine maps archetypes → characters for chosen theme
   Role uniqueness rule (Option B, relaxed): each character has one primary role
   plus OPTIONAL secondary roles where canonical fit is strong. Secondaries
   must be minimized — in v0.1 TBBT casting, Wil Wheaton (Adversarial Reviewer
   primary + DevRel secondary) is the only character with a secondary role.
     │
     ▼
5. CAPABILITY BINDING
   For each character, look up archetype in access-matrix.yaml
   Grant scoped shared-skills (source-control:read, worktrees:write, etc.)
     │
     ▼
6. RENDER + DEPLOY (Penny)
   - Copy TIER 1 files (SOUL/AGENTS/HEARTBEAT/MEMORY.seed) from theme
   - Generate TIER 2 files (USER.md, DEPLOY-CHECKLIST.md) from OOBE data
   - Initialize empty COMMITMENTS.md per character
   - Write season.yaml + manifest.yaml
   - Create communication channels (Discord, Slack, Telegram per config)
   - Adapter packages for target platform, deploys
     │
     ▼
7. HANDOFF TO LEONARD
   Penny writes season/manifest.yaml with:
     - Roster (characters + archetypes + capability bindings)
     - Communication channels
     - Initial backlog (PRD broken into task seeds)
     - User context summary
     - Project boundaries
   Leonard reads manifest, runs first standup, team is live
     │
     ▼
8. LIVING TEAM
   - HEARTBEAT fires per character (Debbie Wolowitz runs invisible monitoring)
   - Leonard runs daily standup, reports to user
   - Characters take tasks, spawn worktrees, submit for review
   - Any character can consult advisory board SMEs
   - Knowledge capture on every merge
```

### 7.4 Runtime flow — task execution with worktree and review gates

```
1. TASK ASSIGNED
   Leonard assigns a task from the backlog to an implementer
   (Stuart Bloom — Backend, or Raj — Frontend, etc.)
     │
     ▼
2. WORKTREE SPAWN
   Agent creates a git worktree at
     seasons/season-XX/worktrees/<agent-name>-<task-id>/
   Max 10 concurrent worktrees per season (enforced)
     │
     ▼
3. KNOWLEDGE RETRIEVAL
   Agent queries mempalace: "prior patterns for this type of task"
   Loads relevant ADRs, review decisions, patterns as prior art
     │
     ▼
4. AGENT WORKS
   Implements in the worktree
   When done, submits for review (all 6 gates in parallel)
     │
     ▼
5. PARALLEL REVIEW GATES
   All 6 gates run concurrently:
   - Architecture Review    (Sheldon)      → PASS/FAIL
   - Code Review            (Alex Jensen)  → PASS/FAIL
   - QA Review              (Bernadette)   → PASS/FAIL
   - Security Review        (Barry Kripke) → PASS/FAIL
   - Adversarial Review     (Wil Wheaton)  → ⭐⭐⭐⭐⭐ rating (need ≥4)
   - UI Functionality Review (UX Designer) → ⭐⭐⭐⭐⭐ rating (need ≥4)
   - Refinement Pass        (Leslie Winkle) → PASS/FAIL (runs after others)
     │
     ▼
6. GATE OUTCOMES
   - All 4 technical gates PASS AND both 5-star gates ≥4 stars AND Refinement PASS
       → Leonard merges
   - Any gate FAILS or <4 stars
       → agent edits in place in same worktree, resubmits
       → bounces until gates pass
     │
     ▼
7. MERGE (Leonard)
   Serialized through Leonard as merge authority
   Worktree merged to main branch of season's workspace
     │
     ▼
8. KNOWLEDGE CAPTURE
   - Learnings appended to mempalace/learnings/
   - If new pattern: proposed for mempalace/patterns/
   - If new skill emerged: drop in mempalace/skills/pending/
   - If review decision is generalizable: add to mempalace/reviews/<type>/
     │
     ▼
9. WORKTREE CLEANUP
   Worktree removed after successful merge
   Slot freed for new task
```

### 7.5 Runtime flow — continuous composition (mid-season expansion)

```
1. GAP DETECTION (Leonard)
   Signals:
   - New user request requires role not on team
   - Existing character escalates "outside my scope"
   - Quality gate reveals missing review type
   - New platform target introduced (e.g., iOS support)
   - Scope change pushes project into next tier

   Split-trigger rules (from research):
   - Frontend → iOS + Android + Web when product ships ≥2 platforms
   - Full-stack → specialist split at ~200K LOC or 8+ engineers
   - DevOps → Platform + SRE + Release + Cloud at 3+ stream teams
   - Security Champion → AppSec + InfraSec + Compliance at first audit
   - Data Engineer → Analytics + Data Sci + ML Eng at 50+ warehouse models
   - QA → Test Automation + Performance + A11y + Release QA
   - etc.
     │
     ▼
2. EXPANSION REQUEST (user-visible)
   Leonard drafts a proposal:
     - Archetype needed
     - Rationale (which split-trigger fired)
     - Suggested character (per theme-engine mapping)
     - Estimated cost/time impact
   Proposal posted to the season's primary channel (#leonards-office by
   convention) with three action buttons: ✅ Approve / ❌ Reject /
   🔄 Propose alternative archetype

   On auto-approve condition: if the archetype is in the user's
   pre-authorized list (configured in OOBE or via
   `factor-echelon config auto-expand <archetype>`), proposal is
   recorded but not blocking — Leonard proceeds.

   On user rejection: Leonard records the rejection with user's reason
   (free-text), marks the task as blocked pending manual guidance, and
   does NOT retry expansion for the same task until the user updates
   scope or overrides.

   On user timeout (no response in 24h for non-urgent, 1h for urgent):
   Leonard escalates via out-of-band channel (email, SMS) and blocks
   the task until response.
     │
     ▼
3. THEME CAPACITY CHECK
   theme-engine: does current theme have a free character for this role?
   - YES → cast within theme (preferred)
   - NO  → invoke expansion (next step)
     │
     ▼
4. RUNTIME TAG-MATCH EXPANSION
   Query installed themes for compatible neighbors
   Tags: era, tone, setting, role archetypes present, natural connections
   Pick best-match neighbor, borrow character
   Fallback: synthesis.md generates de-novo character (quality-gated)
     │
     ▼
5. MID-SEASON SPAWN
   Same steps 4–6 from 7.3 (theme mapping → capability binding → render + deploy)
   Warm handoff to Leonard
   New character joins live standup
   MEMORY.seed.md augmented with season context
   COMMITMENTS.md starts empty
```

### 7.6 Runtime flow — knowledge base write and read

**Write flow (after every successful merge):**
```
Merge to main ─▶ mempalace_ingest via knowledge-capture skill
              ─▶ Classify (learning / pattern / ADR / review rule / skill)
              ─▶ Tag with season, character, archetype, tier
              ─▶ Write to appropriate hall (learnings/patterns/reviews/skills)
              ─▶ If skill → skills/pending/
```

**Read flow (before starting any task):**
```
Task assigned ─▶ mempalace_search via knowledge-retrieval skill
              ─▶ Semantic + metadata filter (wing: this season + shared team wing)
              ─▶ Load top-N relevant patterns, ADRs, prior review decisions
              ─▶ Include in prompt context as "prior art"
              ─▶ Start work with institutional knowledge loaded
```

**Skill promotion flow (Stephen Hawking gate):**
```
Skill in skills/pending/ reaches use-count threshold (e.g., 3 uses across 2 seasons)
  ▼
Candidate flagged for promotion
  ▼
Stephen Hawking (Skill Promotion Reviewer) invokes Counselor Placement A
  - Four models review candidate skill in parallel
  - Min-score consensus, ≥4 stars required
  ▼
Approved → skills/approved/ (ships with future seasons)
Rejected → skills/deprecated/ (with reason, all 4 model verdicts preserved)
```

### 7.7 Uninstall, Teardown, and Season Archival

**Season archival (user ends an active season):**

```
factor-echelon season archive season-01-dynapt-regpro
  ▼
1. Leonard writes a season retrospective to mempalace (auto-summary)
2. All in-flight worktrees are checked — any with uncommitted work:
     - Prompt user: "Worktree <name> has uncommitted changes.
       Commit / stash / discard?"
3. All characters post final COMMITMENTS.md status
4. Channels are archived (read-only mode, not deleted)
5. Season directory moves to ~/.factor-echelon/seasons/archive/
6. season.yaml marked as archived with timestamp
7. Advisory board consultations associated with this season
   remain in mempalace (tagged for historical queries)
```

**Season restoration (user wants to reactivate an archived season):**

```
factor-echelon season restore season-01-dynapt-regpro
  ▼
1. Move directory back from archive/
2. Restore channels to active state
3. Re-provision characters (SOUL.md, AGENTS.md unchanged; MEMORY.md
   replays from last daily log; COMMITMENTS.md starts empty or
   restored from archive)
4. Leonard posts resumption standup
5. User is prompted to confirm project state
```

**Full uninstall:**

```
factor-echelon uninstall
  ▼
1. Prompt: "This will remove factor-echelon from this machine.
   Your knowledge base can be exported first. Continue?"
2. Offer KB export: writes ~/.factor-echelon/knowledge-base/
   to a user-specified tar.gz
3. Offer config backup: writes ~/.factor-echelon/config.yaml
   + advisory-board/ + seasons/ to user-specified directory
4. Confirm destructive action with second prompt
5. Remove:
   - ~/.factor-echelon/ (entire directory)
   - Shell integration (init hooks, PATH entries)
   - Platform adapter plugin files (Claude Code plugin, OpenClaw bundle)
   - mempalace MCP registration with target platform
   - API keys from OS keychain
6. Retain (explicit):
   - User-exported KB/config backups
   - Git remotes the user pushed to (not touched)
7. Print recovery instructions in case user reinstalls
```

**Single-character removal (mid-season):**

```
factor-echelon season character remove season-01 stuart-bloom
  ▼
1. Prompt: "This will end Stuart Bloom's role in Season 01.
   Active commitments will be reassigned. Continue?"
2. Leonard redistributes Stuart's COMMITMENTS.md entries to
   remaining characters (may trigger expansion if no fit)
3. Worktrees owned by Stuart are either reassigned (warm handoff)
   or closed (if work incomplete, user chooses)
4. Character directory moves to
   season-01/characters/_archive/stuart-bloom/
5. Leonard posts notice in channel
```

### 7.8 User Intervention Catalog

Every flow in the spec where a human can override, cancel, or modify in-flight operations. Grouped by category.

**Cancellation / abort:**

| Intervention | How | Effect |
|---|---|---|
| Cancel season spawn mid-ingestion | `/factor-echelon cancel` in #pennys-apartment, or Ctrl-C in TTY | Penny rolls back any partial state, season directory not created |
| Cancel season spawn mid-provisioning | Same command, or force-kill the provisioning process | Step 6 (Render+Deploy) is transactional — rolls back fully, no zombie season |
| Cancel a running task | `/factor-echelon task cancel <task-id>` via Leonard | Worktree closed, task marked cancelled, no merge attempted |
| Cancel mid-season expansion proposal | ❌ reject button on Leonard's proposal post | Expansion aborted, task marked blocked |
| Stop a heartbeat | `/factor-echelon character pause <name>` | Character's heartbeat halts, other characters continue |

**Override / force:**

| Intervention | How | Effect |
|---|---|---|
| Force-pass a review gate | `/factor-echelon review override <task-id> <gate> --reason "..."` | Gate marked as human-override-pass, reason logged to mempalace, visible in audit |
| Force-reject a review gate | Same command with `--reject` | Task bounced, reason logged |
| Force-merge past gates | `/factor-echelon merge force <task-id> --reason "..."` | Leonard merges with all failures logged, heavily flagged in audit |
| Override Counselor verdict | `/factor-echelon counselor override <verdict-id> --reason "..."` | User's decision wins, verdict and override reason both written to mempalace |
| Override OOBE skip rules | `factor-echelon init --force-skip <step>` | Requires `--reason`, marks step as human-skipped |
| Override role uniqueness rule | `/factor-echelon roster assign <char> <secondary-archetype>` | Adds secondary to named character, warning shown if violates Wil-only exception |

**Re-run / replay:**

| Intervention | How | Effect |
|---|---|---|
| Re-run Penny ingestion | `/factor-echelon season reingest <season>` | Penny re-reads PRD, proposes updated roster, user confirms |
| Re-run a specific review gate | `/factor-echelon review rerun <task-id> <gate>` | Single gate re-executed, other gates' results preserved |
| Re-run OOBE | `factor-echelon init --reset` | Archives existing config, starts OOBE from Step 1 |
| Re-cast a character | `/factor-echelon character recast <season> <archetype> <new-char>` | Requires new character to exist in theme; SOUL/AGENTS/HEARTBEAT swap, MEMORY preserved, COMMITMENTS preserved, user notified |

**Scope modification:**

| Intervention | How | Effect |
|---|---|---|
| Adjust season tier | `/factor-echelon season set-tier <season> <medium|large|enterprise>` | Roster composer re-evaluates; may propose expansion or contraction |
| Add archetype to season | `/factor-echelon season add <archetype>` | Leonard spawns the role (theme-engine casts character) |
| Remove archetype from season | `/factor-echelon season remove <archetype>` | Character archived (see §7.7 single-character removal) |
| Change season theme | ❌ NOT SUPPORTED in v0.1 — theme is fixed at spawn. End the season and spawn a new one with the desired theme. |

**Knowledge base manipulation:**

| Intervention | How | Effect |
|---|---|---|
| Delete a bad learning ("poison" correction) | `/factor-echelon kb delete <room-id> --reason "..."` | Room moved to kb/quarantine/, excluded from future retrievals, reason logged |
| Mark a learning as team-shared (promote from private) | `/factor-echelon kb promote <room-id>` | Moves from private wing to team wing (team mode only) |
| Demote team-shared learning back to private | `/factor-echelon kb demote <room-id>` | Moves from team wing to private |
| Export KB for backup | `factor-echelon kb export <path>` | Writes tar.gz of mempalace state |
| Restore KB from backup | `factor-echelon kb import <path>` | Replaces current KB (confirmation required) |

**Principle:** every user intervention produces a log entry in mempalace with who, when, why, and what. Audit trail is append-only and survives uninstall if the user exports KB first.

---

## 8. Error Handling and Failure Modes

Seven failure categories, each with detection → recovery → escalation.

### 8.1 Category 1: Build-time failures

| Failure | Detection | Recovery | Escalation |
|---|---|---|---|
| Schema invalid | validators | Build fails, PR blocked | PR comment with diff |
| Character missing required file | Scanner | Build fails | Per-character error in CI log |
| Adapter transform throws | try-catch per target | Other targets still build | Issue auto-created |
| Smoke test fails | Smoke test harness | PR blocked | Full smoke log attached |
| agentskills.io spec drift | Nightly CI | Warning, not blocker | Issue auto-created |

**Invariant:** no build artifact ships if any required TIER 1 file is missing or any smoke test fails. Partial releases are allowed (e.g., "Claude Code + OpenClaw only, Hermes broken") with explicit note in CHANGELOG.

### 8.2 Category 2: OOBE failures

| Failure | Detection | Recovery | Escalation |
|---|---|---|---|
| User aborts mid-flow | State machine timeout | Resume from checkpoint | None (expected) |
| Custom theme synthesis low quality | Quality scoring | Fall back to preset | Prompt user |
| User profile inconsistency | Validator | Re-prompt specific conflict | Surface plainly |
| Advisory board partial provisioning | State persistence | Spawn missing SMEs on next launch | Warn if >50% failed |

**Invariant:** OOBE is idempotent and resumable. No partial-theme deployments.

### 8.3 Category 3: Ingestion failures (Penny)

| Failure | Detection | Recovery | Escalation |
|---|---|---|---|
| PRD too vague | Quality heuristic | Generate clarifying questions | Surface to user, do NOT spawn |
| Repo inaccessible | Source-control error | Retry, then ask user | Surface plainly |
| Unsupported tech stack | Archetype lookup fails | Flag, offer alternatives | Warn before spawn |
| Scope/expectation mismatch | User feedback | Re-scope, possibly demote tier | Surface to user |
| Multi-project request | Decomposition check | Offer to split into seasons | Surface to user |

**Invariant:** Penny never spawns a season she can't confidently scope.

### 8.4 Category 4: Provisioning failures

| Failure | Detection | Recovery | Escalation |
|---|---|---|---|
| Theme mapping no character for archetype | mapping returns null | Try expansion, then synthesis, then demote | Warn user |
| Platform adapter rejects bundle | Deploy error | Roll back partial deploy, fail whole season | Surface; no half-deployed state |
| Channel creation fails | Provisioning error | Retry with backoff, fall back to secondary | Pause season, alert user |
| Capability binding fails | Pre-deploy check | Fail early | Build-time issue, blocks release |
| Character file missing from artifact | Asset manifest | Fall back to closest-match | CI should catch — P0 bug |

**Invariant:** provisioning is all-or-nothing. No zombie half-teams.

### 8.5 Category 5: Runtime failures

| Failure | Detection | Recovery | Escalation |
|---|---|---|---|
| Character HEARTBEAT stops | Other characters' silent-fail check (Debbie) | Restart character; if repeated, spawn replacement | Leonard → user |
| COMMITMENTS overdue | Per-character audit every heartbeat | Retry, escalate to Leonard | Leonard → user |
| Capability violation attempt | Runtime enforcement | Block call, log attempt | Leonard → user if repeated |
| Advisory board SME unreachable | Consultation timeout | Retry 3x, proceed without | Flag in Leonard's daily report |
| Handoff protocol violation | Schema check | Reject, return error | Leonard escalates if repeated |
| Review gate rejection loop | Bounce counter (max 5 bounces per task per gate) | Standard workflow until threshold; at 5th bounce, Leonard invokes Counselor Placement C (Deadlock Escalation) for tie-breaker | Leonard reports to user if Counselor verdict also rejects |
| Worktree merge conflict | Git status | Leonard coordinates resolution | Agent pair for rebase |
| Worktree orphaned after agent failure | Weekly cleanup sweep | Auto-prune after 7 days idle | — |
| Soul drift (weekly LLM-as-judge) | Consistency check | Re-inject SOUL; respawn if persists | Leonard → user if respawn needed |

**Invariant:** runtime failures are caught by redundant detection — responsible character AND external watcher.

### 8.6 Category 6: Theme exhaustion + expansion failures

| Failure | Detection | Recovery | Escalation |
|---|---|---|---|
| Theme has no free character | Capacity check | Query neighbors via tag matching | — unless expansion fails |
| No installed neighbor match | Expansion search empty | Invoke synthesis | Warn user about synthesis quality |
| Synthesis quality fails (LLM-as-judge) | Quality scoring | Retry with stronger model, then demote | Surface: "recommend installing theme X" |
| User has only one theme installed | Expansion fails at step 1 | Suggest installing adjacent theme | User chooses install/demote/synthesize |

**Invariant:** system always produces *some* team, even if the result is a warning. No fatal "can't spawn" errors reach the user.

### 8.7 Category 7: Platform-level failures

| Failure | Detection | Recovery | Escalation |
|---|---|---|---|
| Target platform down | Leonard health check | Queue operations, retry with backoff | Out-of-band alert (email, SMS) |
| User config corrupted | Checksum on load | Restore last known good | Manual intervention may be needed |
| Cross-session state lost | Missing-file check | Reload from MEMORY.seed + reconstruct from daily logs | Warn user, some context loss |
| Multi-season resource collision | Lock-based detection | Queue and serialize | Leonard reports to user |
| mempalace backend unreachable | Connection check | Queue captures locally, retry | If team mode: fall back to solo wing |
| Azure team wing auth failure | Entra ID check | Re-auth flow | Alert user |

**Invariant:** platform-level failures are surfaced out-of-band (not through the failing platform itself).

### 8.8 Two cross-cutting principles

**P1. Never silently fail.** Import directly from Jimmy's AGENTS.md pattern: if an agent can't do something, the user must know. Every failure either produces a user-visible alert or enters a retry loop that eventually alerts.

**P2. Redundant detection.** Every failure has at least two detection mechanisms — the responsible character AND an external watcher (other character, Leonard, quality gate, Debbie's invisible daemon, or CI).

---

## 9. Testing Strategy

### 9.1 Test pyramid

```
                        ┌─────────────┐
                        │  5. E2E     │
                        │  (platform) │
                        └──────┬──────┘
                       ┌───────┴────────┐
                       │  4. Smoke       │
                       │  (per-adapter)  │
                       └───────┬─────────┘
                    ┌──────────┴──────────┐
                    │  3. Integration      │
                    │  (full build runs)   │
                    └──────────┬───────────┘
                 ┌─────────────┴──────────────┐
                 │  2. Unit                    │
                 │  (TypeScript)               │
                 └─────────────┬───────────────┘
          ┌────────────────────┴────────────────────┐
          │  1. Schema + content validation          │
          └───────────────────────────────────────────┘
```

Separate parallel track for content quality (LLM-as-judge): persona fidelity, character drift detection, synthesis quality scoring, theme ensemble consistency. Runs nightly in CI, gated on content changes.

### 9.2 Layer-by-layer coverage

| Layer | Test type | Examples |
|---|---|---|
| `src/team-factory/` content | Schema + LLM-as-judge | Required TIER 1 files present, theme tags valid, SOUL matches archetype |
| `build/` pipeline | Unit + integration | Parser handles valid/malformed input, transformers idempotent |
| `adapters/` per target | Smoke | Built plugin installs cleanly in each target platform |
| OOBE + composer + theme-engine | Integration with mocks | Fixture PRD → expected manifest; expansion triggers correctly |
| Runtime behavior | E2E on real platforms | Full Medium-tier season spawn, daily-log writing, commitment execution |
| Advisory board | E2E | SME consultation returns sourced answer |
| Knowledge base | E2E cross-season | Second season benefits from first season's learnings |

### 9.3 CI gates

| Stage | Runs on | Must pass |
|---|---|---|
| Fast | Every commit | Schema + content + lint |
| PR | Every PR | Fast + unit + integration |
| Main | On merge | PR + smoke per target |
| Nightly | Scheduled | Main + LLM-as-judge content + E2E on one target |
| Release | On tag | All of above + E2E on all targets + artifacts attached |

**Hard rule:** no release tag without green E2E on all shipping adapters. Partial releases allowed with explicit override + CHANGELOG note.

### 9.4 Coverage targets

- **Code layers** (`build/`, adapter transforms, parsers): 80% line coverage
- **Content layers** (`src/themes/`, `src/archetypes/`): 100% schema validation, 100% required-file presence, LLM-as-judge sample rotation (5% per nightly run, rotates through full cast over ~20 days)
- **Runtime E2E**: at least one full Medium-tier season spawn per target platform in CI

### 9.5 Ongoing / regression tests

1. **Weekly character soul drift check** — LLM-as-judge on each deployed character's recent outputs vs SOUL.md.
2. **agentskills.io spec drift watch** — nightly upstream check.
3. **Target platform smoke** — nightly re-run against latest versions of Claude Code, OpenClaw, Hermes.

### 9.6 Explicit non-goals for testing in alpha

- Performance benchmarks
- Load testing for multi-season concurrency
- Security pen testing of deployed agents (platform's job)
- Custom-theme synthesis end-to-end quality (v1+)

---

## 10. Phasing and Release Runway

Three named milestones (not calendar dates — sized during implementation planning):

```
v0.1 ───────▶ v0.5 ───────▶ v1.0 ───────▶ v1.1+
Alpha        Beta           GA             Growth
```

### 10.1 v0.1 — Alpha (Full Scope — Decision γ)

**Goal:** Ship the complete architecture end-to-end with TBBT polished, two adapters, full review layer, mempalace KB in solo mode, and the Counselor multi-model council. This is full scope per the brainstorming Decision γ — timeline extended, risk absorbed, no feature-cuts to make alpha "small."

**Ships:**
- **Echelon desktop app** (`Echelon.app`) — the primary host runtime, absorbed from the Dorothy Electron fork and rebranded (see Plan 11). Bundle ID `io.tf-echelon.app`, cloud-signed and notarized for macOS.
- Repo scaffold (src, adapters, build, tests, docs, CI baseline) **as a monorepo** absorbing the Dorothy fork (Plan 11 Phase A)
- Archetype library: **43 archetypes, all cast** (see §11.1) spanning Medium + Large tiers + select Enterprise
- **One theme fully polished: TBBT + Young Sheldon expansion** (42 unique characters + 12 advisory board = 54 characters with full soul packages)
- Reference theme stub: **Star Wars** (8 characters, not full parity — full in v0.5)
- Three build targets: **Echelon** (primary host) + **Claude Code** + **OpenClaw**
- Build pipeline (lint, validate, transform, smoke)
- Season runtime primitives (season.yaml, manifest.yaml, workspace layout)
- Penny ingestion flow + Leonard handoff flow
- Worktree-per-agent execution with **7 review gates** (6 parallel + Refinement after)
- 5-star hybrid rating system (Adversarial + UI subjective; others binary)
- mempalace integration in **solo mode** (local ChromaDB + git-backed sync)
- Knowledge capture primitives + manual retrieval (automatic retrieval is v0.5)
- **Advisory board full 12 characters** (11 SMEs + Stephen Hawking escalation oracle)
- **The Counselor — all 4 placements** (Skill Promotion, Design Review, Deadlock Escalation, High-Risk Adversarial sidecar) with Gemini Pro + GPT-5 + Claude Opus 4.6 + Grok
- **Counselor API key setup integrated into OOBE flow**
- Schema + unit + integration + smoke + one E2E test
- Quickstart docs, example PRDs per tier, concepts docs, README
- Manual release process (tag + `gh release create`)
- §7.2a OOBE state machine (explicit checkpoints, resume semantics)
- §7.7 Uninstall / teardown / season archival
- §7.8 User intervention catalog
- Multi-season user multiplexing (channel-per-season model)
- Malformed-PRD conversational refinement loop (Penny ↔ user)

**Explicitly NOT in v0.1:**
- Hermes adapter (v0.5)
- Star Wars theme fully polished (v0.5)
- Custom theme synthesis (v1)
- Team-mode KB + Azure backend (v0.5)
- LLM-as-judge content tests wired to CI (v0.5)
- Theme expansion via runtime tag matching beyond the TBBT+Young Sheldon combined cast (v0.5)
- CI release automation (v0.5)
- Observability / telemetry beyond structured logs (v1)
- Full interactive config story (v1)
- Automatic knowledge retrieval before task start (v0.5)
- Skill promotion with full ceremony beyond Counselor gate (v0.5)

**Acceptance criteria:**
1. Fresh clone → `bun install && bun run skill:build` → valid Claude Code plugin AND valid OpenClaw bundle AND valid Echelon season pack
2. Fresh clone → `bun run echelon:build` → signed, notarized `Echelon.app` produced via cloud builder
3. **Echelon.app smoke pass:** launch Echelon.app on a clean macOS machine → complete first-run OOBE (theme pick + profile + Counselor API keys + advisory board provisioning + KB solo init) → drop a test PRD → live Season 01 renders in the Seasons view with a full roster including Leonard, Penny, Sheldon, implementers, and the 12-character advisory board accessible
4. Claude Code / OpenClaw adapters independently install + run `/factor-echelon init` to parity (portability smoke)
5. First daily standup posts in Echelon
6. One full task lifecycle runs through the Echelon Review Gate board: worktree spawn → agent works → 6 parallel review gates → Refinement pass → Leonard merge → knowledge capture to mempalace
7. One Counselor invocation demonstrates correctly from the Echelon Counselor tab: either a Placement C deadlock escalation OR a Placement D high-risk PR sidecar review producing a 4-model consensus verdict
8. One mid-season expansion proposal fires, surfaces to the user in Echelon (and echoed to Telegram/Slack), accepts user approval, and spawns a new character
9. README quickstart completes on clean machine in <15 minutes against Echelon.app

**Bootstrap build order (DAG):**

v0.1 component dependencies — implementation must proceed in this order:

```
  0a. Plan 11 Phase A — absorb Dorothy fork, rebrand to Echelon, migration shim
  0b. Plan 11 Phase B — Bun workspace wiring, scripts, CI matrix
                              │  (safety gate: bun run echelon:dev still launches)
                              ▼
  1. skill-parser + validators + agentskills.io schema check
                              │
                              ▼
  2. protocols/ (soul-schema.yaml, theme-schema.yaml, roster-manifest-schema.yaml)
                              │
                              ▼
  3. One archetype fully authored (reference: ingestion-pm)
  4. One character fully authored (reference: penny TIER 1 package)
                              │
                              ▼
  5. build/targets/claude-code.ts (single target end-to-end)
     smoke test: does the built artifact load in Claude Code
                              │
                              ▼
  6. All 43 archetypes authored + all 42 TBBT characters + 12 advisory board
                              │
                              ▼
  7. roster-composer/ (reads work → produces archetype list)
  8. theme-engine/ (maps archetypes → characters)
                              │
                              ▼
  9. capabilities/access-matrix.yaml + enforcement protocol
                              │
                              ▼
  10. build/targets/openclaw.ts (second target)
      smoke test: OpenClaw bundle
                              │
                              ▼
  10b. Plan 11 Phase C–E — season-manager.ts + character-loader.ts in Electron
       main + build/targets/echelon.ts (third target)
       smoke test: Echelon season pack loads in Echelon.app
                              │
                              ▼
  11. seasons/ runtime primitives (season.yaml, manifest.yaml, isolation)
      — hosted in electron/core/season-manager.ts per Plan 11 Phase C
                              │
                              ▼
  12. shared-skills/git-worktrees/ (worktree-per-agent)
                              │
                              ▼
  13. Review gates (6 parallel + Refinement) + bounce semantics
                              │
                              ▼
  14. shared-skills/knowledge-capture/ + knowledge-retrieval/ (mempalace)
      KB interface + solo mode + git sync
                              │
                              ▼
  15. oobe/ full flow (theme picker → profile → API keys → advisory → KB init)
                              │
                              ▼
  16. Penny ingestion + Leonard handoff + continuous expansion
                              │
                              ▼
  17. counselor/ (all 4 placements) + model dispatch + consensus
                              │
                              ▼
  18. Advisory board provisioning + consultation protocol
                              │
                              ▼
  19. §7.7 uninstall + §7.8 user intervention + multi-season multiplex
                              │
                              ▼
  19b. Plan 11 Phase F–L — Echelon UI (seasons route, review-gate board, KB
       dashboard retheme for mempalace, Counselor tab, Convener wiring),
       UI retheme to Echelon brand, park Dorothy-legacy features
                              │
                              ▼
  20. E2E test harness + smoke matrix + release runbook
      (includes Echelon.app smoke from acceptance criteria #3)
```

**Nothing in this DAG can be parallelized across phases, but work within a phase can be parallelized across multiple contributors.** The writing-plans skill should treat this as the skeleton for the implementation plan.

### 10.2 v0.5 — Beta

**Goal:** Prove portability across three platforms. Second theme validates expansion. Team mode KB works.

**Adds:**
- **Hermes adapter** (third target, using agentskills.io format directly)
- **Star Wars theme polished to parity with TBBT** (~20 characters)
- **Theme expansion via runtime tag matching** (borrow characters across themes)
- **Advisory board complete** (all 11 SMEs, per-theme casting)
- **LLM-as-judge content tests** running in CI (sampled nightly)
- **Release automation** (GitHub Action: tag → build all → E2E matrix → release)
- **Per-platform platform guides**, worked examples per tier, "writing an archetype" guide
- **Continuous composition** working end-to-end (mid-season expansion via Leonard)
- **Team mode KB** via Azure backend (multi-node sync, private per-user wings)
- **Semantic retrieval** working (agents auto-query before starting tasks)
- **Skill-pending capture** (no promotion workflow yet)

**Not yet:**
- Custom theme synthesis
- Full 40-70 enterprise archetype library (research taxonomy has it but cast mapping deferred)
- Third+ preset theme
- Observability beyond structured logs
- Full interactive config story

**Acceptance criteria:**
1. All three adapters pass smoke tests in CI
2. Medium-tier season runs to completion on any of three platforms given same PRD
3. Large-tier season triggers expansion at least once
4. Team-mode KB multi-node sync verified
5. Nightly LLM-as-judge content test green on 5% sample
6. Release fully automated — tag push → GitHub Release with all artifacts

### 10.3 v1.0 — GA

**Goal:** Everything from Question 6 (A–I gaps). Public-shippable.

**Adds:**
- **Full archetype taxonomy** (all 56 Enterprise roles cast in TBBT + Star Wars)
- **Custom theme synthesis** (user describes theme → system produces cast; quality-gated)
- **Third preset theme** (TBD during v0.5 review)
- **Observability** (structured logging, OpenTelemetry traces, per-character metrics, weekly reports)
- **Full config story** (interactive `factor-echelon config` command, YAML overrides, per-season customization without editing core)
- **Versioning discipline** (semver enforcement, automated changelog from PR labels, upgrade-path tests)
- **Positioning / marketing** (BBT Executive Package content repackaged for public docs site)
- **Weekly drift detection** running by default in deployed agents
- **Skill promotion workflow** (Stephen Hawking gate) working end-to-end
- **Full E2E matrix** (3 themes × 3 platforms × 3 tiers)

**Acceptance criteria:**
1. All nine gaps from original requirements resolved (A–I)
2. Public docs site live
3. Three preset themes, full archetype library, all three adapters, custom synthesis working
4. Upgrade path from v0.5 tested and documented
5. One external user (not the author) successfully runs a full season from install to team-posts-daily-standup

### 10.4 v1.1+ — Growth backlog

Not planned, opportunistic:
- Additional preset themes (regency, F1 pit crew, round table, 90s NBA, historical Rome, cyberpunk)
- Additional source-control adapters (GitLab, Bitbucket, Gerrit)
- Web UI for OOBE
- Cross-season collaboration beyond advisory board
- Performance optimization
- Multi-tenant deployment
- SDK for third-party theme authors

---

## 11. Archetype Library (Alpha Scope)

**43 archetypes** for v0.1 alpha, spanning Medium (core 12) + Large (scaled 24) + select Enterprise additions, with TBBT casting. Full taxonomy from research documented in `docs/research/team-composition.md`; cast catalogs in `docs/research/themes/`.

### 11.1 Core team roster with TBBT casting

**42 unique characters cast across 43 archetype roles.** Wil Wheaton is the only character with a secondary role (DevRel) — all others have a single primary role per the relaxed Option B rule (primary + optional secondary, minimized).

| # | Archetype | TBBT Character | Source | Role |
|---|---|---|---|---|
| 1 | Ingestion PM / Season Producer | **Penny** | TBBT primary | Reads PRD, estimates scope, spawns season, establishes channels, hands off to Leonard |
| 2 | User Handler / Delegator / Final Decision Maker | **Leonard Hofstadter** | TBBT primary | Runs daily standup, human interface, delegation authority, sole merge authority, continuous expansion trigger |
| 3 | Scrum Master | **Mrs. Janine Davis** (Caltech HR) | TBBT recurring | Backlog grooming, sprint ceremonies, process enforcement, blocker removal, personality mediation |
| 4 | Principal Architect | **Sheldon Cooper** | TBBT primary | Architecture review gate, API/data model/tenant isolation review |
| 5 | Infrastructure / DevOps | **Howard Wolowitz** | TBBT primary | Azure/AWS provisioning, Terraform IaC, container mgmt |
| 6 | Frontend Engineer | **Raj Koothrappali** | TBBT primary | React, design system, component library, responsive |
| 7 | Backend Engineer | **Stuart Bloom** | TBBT recurring | TS/Node, API, business logic, DB queries, middleware |
| 8 | Database Engineer | **Bert Kibbler** | TBBT recurring | Schemas, migrations, query performance, indexing, replication (scales to DBA at Enterprise tier) |
| 9 | QA Lead | **Bernadette Rostenkowski** | TBBT primary | Test verification, acceptance criteria, UAT on live previews |
| 10 | Security Engineer | **Barry Kripke** | TBBT recurring | Auth, secrets, tenant isolation, RBAC, P0-P3 severity, P0 auto-escalates |
| 11 | Adversarial Reviewer | **Wil Wheaton** | TBBT recurring | YAGNI enforcer, 1-5 star rating, ≥4 required to merge |
| 12 | Code Reviewer | **Alex Jensen** | TBBT recurring | Line-by-line code quality, pattern adherence, test presence |
| 13 | Refinement Builder / Second Pass | **Leslie Winkle** | TBBT recurring | Rival-architect second opinion, catches gaps before merge |
| 14 | CI/CD / Pipeline Engineer | **Dr. Eric Gablehauser** | TBBT recurring | GitHub Actions, deployment automation, env promotion — officious by-the-book physics dept chair |
| 15 | Technical Writer / Workflow Lead | **Amy Farrah Fowler** | TBBT primary | OpenAPI docs, ADRs, runbooks, Linear/Jira workflow rules |
| 16 | SRE / Invisible Ops Daemon | **Debbie Wolowitz** (voice-only) | TBBT voice-only | Heartbeat, monitoring, cron, silent-fail checks, background watcher |
| 17 | Incident Commander | **Mike Rostenkowski** | TBBT recurring | SEV-1 response, post-incident coordination — ex-cop veteran-operator energy |
| 18 | UX Designer | **Emily Sweeney** | TBBT recurring | Wireframes, visual design, UI functionality reviewer — goth dermatologist specialist |
| 19 | UX Researcher | **Missy Cooper** | TBBT recurring | User interviews, usability testing, "normal person sanity check" |
| 20 | Content Designer / UX Writer | **Lucy** | TBBT recurring | Microcopy, error messages, product voice — Raj's freelance-blogger ex |
| 21 | Product Manager | **President Siebert** | TBBT recurring | Roadmap, prioritization, stakeholder alignment — Caltech president, political operator |
| 22 | Release Manager | **Mrs. Latham** | TBBT recurring | Version bumps, changelog, rollout — wealthy Caltech donor, transactional + outcome-focused |
| 23 | Dependency / Supply-chain Auditor | **Beverly Hofstadter** | TBBT recurring | CVE monitoring, SBOM, license compliance — clinical neuroscientist, rigorous auditor |
| 24 | Performance Engineer | **Dennis Kim** | TBBT recurring | Profiling, optimization, load testing — child prodigy who outperforms entire physics dept |
| 25 | Accessibility Engineer | **Mary Cooper** | TBBT / Young Sheldon | WCAG, a11y beyond frontend baseline — Sheldon's mom, inclusive folksy authority |
| 26 | Localization Engineer | **Zack Johnson** | TBBT recurring | i18n/l10n infrastructure — Penny's dim-but-kind ex in advertising, cross-audience communicator |
| 27 | Privacy Officer | **Meemaw (Constance Tucker)** | Young Sheldon | GDPR, CCPA, data handling compliance — runs an under-the-table gambling operation, privacy by necessity |
| 28 | Developer Experience Engineer | **Paige Swanson** | Young Sheldon | Tooling, dev env, build speed, inner-loop — child prodigy rival with efficiency-for-others mindset |
| 29 | Mobile iOS Engineer | **Mike Massimino** (as himself) | TBBT guest | Native iOS — NASA astronaut, literally deploys things in orbit |
| 30 | Mobile Android Engineer | **Josh Wolowitz** | TBBT recurring | Native Android — Howard's half-brother, "second engineer" Wolowitz family metaphor |
| 31 | ML Engineer | **Ramona Nowitzki** | TBBT recurring | Model training, feature engineering — obsessive physicist stalker, single-minded tuning energy |
| 32 | Data Engineer | **Alfred Hofstadter** | TBBT recurring | Pipelines, warehouse, ELT — Leonard's anthropologist dad, field-research = data mining |
| 33 | Test Automation Engineer | **Hubert Givens** | Young Sheldon | Test infrastructure, framework, CI orchestration — Sheldon's methodical math teacher |
| 34 | Platform Engineer | **Dale Ballard** | Young Sheldon | Internal developer platforms, abstractions — Meemaw's boyfriend, practical small-biz infrastructure owner |
| 35 | AppSec Engineer | **George Cooper Sr.** | Young Sheldon | SAST/DAST, code-level vulns — high school football coach = defensive coordinator metaphor |
| 36 | Technical Program Manager (TPM) | **President Hagemeyer** | Young Sheldon | Cross-team technical orchestration — East Texas Tech president, cross-department coordinator |
| 37 | Data Scientist | **Dr. John Sturgis** | Young Sheldon | Experimentation, modeling — experimental-minded theoretical physicist |
| 38 | DBA (Enterprise-tier depth of Database Engineer) | **Bert Kibbler** scales | — | Enterprise tier specialization of row 8; same character, deeper responsibilities at enterprise scale. Not a distinct cast assignment. |
| 39 | Developer Advocate / DevRel | **Wil Wheaton** (SECONDARY) | TBBT recurring | External community, SDK docs, conference presence — canonically a public commentator. THE ONLY SECONDARY ROLE IN THE ROSTER (Option B exception). |
| 40 | Solution Architect | **Dr. Grant Linkletter** | Young Sheldon | Client-facing architecture — East Texas Tech physicist, approachable compared to Sturgis |
| 41 | Customer Success Engineer | **Georgie Cooper** | Young Sheldon | Technical support at engineering depth — Sheldon's practical older brother, salesman-turned-small-biz-owner |
| 42 | MLOps Engineer | **Mandy McAllister** | Young Sheldon | Model deployment, drift monitoring — Georgie's organized pragmatic wife |
| 43 | AI Safety Engineer | **Neil deGrasse Tyson** (as himself) | TBBT guest | Prompt safety, jailbreak resistance, hallucination monitoring — authoritative scientific communicator, moved from Advisory Board to core team for this role |

**Character summary:**
- 17 TBBT primary/recurring (rows 1–17, plus 21, 23, 31, 32)
- 7 TBBT recurring extended cast (18, 19, 20, 22, 24, 26, 30)
- 10 Young Sheldon characters (25, 27, 28, 33, 34, 35, 36, 37, 40, 41, 42 — Mary and Missy are shared TBBT/YS)
- 2 TBBT guest scientists in core team (29 Massimino, 43 Tyson)
- 42 unique characters total for 43 roles (Wil Wheaton's DevRel secondary is the only dual-role assignment)
- Zero primary-role overloading

### 11.2 Advisory Board (cross-season, 11 SMEs + Escalation Oracle)

Advisory board uses TBBT **guest characters** (primarily canonical show guests, per research recommendation). Most SMEs are theme-invariant — the same real person / character plays the role regardless of which theme a season uses. The exception is the **Research Engine SME**, which is cast per-theme (Prof. Proton for TBBT, Jocasta Nu for Star Wars) because a research engine persona is tightly coupled to the fictional world.

| # | SME Domain | Character | Source | Rationale |
|---|---|---|---|---|
| 1 | Model Providers (OpenAI, Anthropic, Google, Meta, Mistral) | **Brian Greene** | TBBT guest | String theorist and public intellectual — foundational theory across models |
| 2 | Enterprise AI Platforms (Azure AI, Bedrock, Vertex, Databricks) | **Ira Flatow** | TBBT guest | NPR Science Friday host — explains platforms to broad audiences |
| 3 | Agent Orchestration (LangChain, LangGraph, CrewAI, Semantic Kernel) | **Stan Lee** (as himself) | TBBT guest | Canonically orchestrated Marvel's multi-character ensemble — literal agent orchestration. TBBT "The Excelsior Acquisition." |
| 4 | Backend / API (Node, FastAPI, NestJS, Django) | **Tam Nguyen** | Young Sheldon | Sheldon's Vietnamese childhood best friend — "the reliable polyglot friend you build on" |
| 5 | Vector Databases (Pinecone, Weaviate, Milvus, Qdrant, pgvector) | **LeVar Burton** (as himself) | TBBT guest | Reading Rainbow host — lifelong knowledge-library curator; vector DBs are searchable knowledge at scale |
| 6 | Event Orchestration (Temporal, Airflow, Prefect, n8n) | **James Earl Jones** (as himself) | TBBT guest | Deep-voice narrator/announcer — canonically triggers events with authority. TBBT "The Convention Conundrum." |
| 7 | Data / Analytics (Snowflake, BigQuery, Redshift, ClickHouse) | **George Smoot** | TBBT guest | Nobel laureate physicist — cosmic microwave background data is canonical big-data analysis |
| 8 | Auth / Identity (Auth0, Okta, Keycloak) | **Nathan Fillion** (as himself) | TBBT guest | Screen persona (Castle, Firefly) is "captain verifying crew loyalty" — identity and access management |
| 9 | Infrastructure (Kubernetes, Docker, Terraform) | **Buzz Aldrin** (as himself) | TBBT guest | Apollo 11 astronaut — legacy systems veteran, production-deploy SME |
| 10 | Product / Integration (build vs buy, TCO, vendor evaluation) | **Bill Nye** (as himself) | TBBT guest | Science educator — developer education / product-integration outreach |
| 11 | Research Engine (live web research with sourced docs) | **Arthur Jeffries / Professor Proton** (TBBT) / **Jocasta Nu** (Star Wars) | TBBT recurring / Star Wars canon | THE ONE PER-THEME SME — a mentor research persona tightly coupled to the fictional world |

**Ultimate Escalation / Skill Promotion Oracle (standalone, not counted in the 11):** **Stephen Hawking** (as himself, canonical TBBT guest). Single-role, no overloading. Consulted only on hardest-problem escalations and for Counselor Placement A (Skill Promotion). In Star Wars theme, the equivalent is **Yoda**.

**Total Advisory Board cast:** 11 SMEs + 1 Escalation Oracle = **12 advisory characters** per install, shared across every season (except the per-theme Research Engine, which is re-cast per theme).

### 11.3 Young Sheldon as first-class TBBT expansion

Original research flagged TBBT as thin on: pure software specialists, junior IC bench, adversarial depth, QA depth beyond Bernadette, and content design. The v0.1 casting resolves these gaps by **formally adopting Young Sheldon as a first-class expansion theme** sharing TBBT's universe.

**Young Sheldon characters cast into the v0.1 roster:**
- Meemaw (Constance Tucker) — Privacy Officer
- Paige Swanson — Developer Experience Engineer
- Hubert Givens — Test Automation Engineer
- Dale Ballard — Platform Engineer
- George Cooper Sr. — AppSec Engineer
- President Hagemeyer — Technical Program Manager
- Dr. John Sturgis — Data Scientist
- Dr. Grant Linkletter — Solution Architect
- Georgie Cooper — Customer Success Engineer
- Mandy McAllister — MLOps Engineer
- Mary Cooper and Missy Cooper (shared with TBBT canon)
- Tam Nguyen (Advisory Board Backend/API SME)

**Expansion metadata:** `src/team-factory/themes/tbbt/expansion.yaml` declares Young Sheldon as an ambient neighbor — Young Sheldon characters appear in the TBBT roster by default at v0.1, not as a fallback. The theme-engine treats TBBT + Young Sheldon as one combined cast for all casting purposes.

**Non-canonical additions (TBBT universe but requiring some interpretation):**
- **Mike Massimino** as Mobile iOS Engineer — canonical TBBT guest (Howard's ISS mission), cast as himself; mobile deployment metaphor.
- **Neil deGrasse Tyson** as AI Safety Engineer — canonical TBBT guest; moved from Advisory Board to core team for this role.

**Remaining casting limitations (known):**
- If a season's Large-tier expansion needs roles beyond the ~54 characters in the combined TBBT+Young Sheldon+guests cast, the theme-engine falls through to runtime tag-match expansion (v0.5+) into further themes or invokes synthesis (v1+).
- No role currently requires this fallback in v0.1 because all 43 archetype slots are filled from the combined cast.

### 11.4 Star Wars casting (v0.1 stub, v0.5 full)

Stub characters for v0.1 (5-8 total, full expansion v0.5). Source: `docs/research/themes/star-wars-cast.md`.

| Archetype | Star Wars |
|---|---|
| User Handler / Decision Maker | **Princess Leia Organa** |
| Principal Architect | **Obi-Wan Kenobi** |
| Engineering Manager (absorbs Mon Mothma role) | **Mon Mothma** |
| Adversarial Reviewer | **Han Solo** (or **K-2SO** for statistical pessimism) |
| Research Engine / Docs | **Jocasta Nu** (Jedi Archivist) |
| Skill Promotion Oracle | **Yoda** |
| Invisible Ops Daemon | **R2-D2** or **Chopper** (pick during implementation) |
| Incident Commander | **Captain Rex** |

Full 25-character Star Wars cast catalogued in research doc, expanded in v0.5.

---

## 12. Deployment Architecture

### 12.1 Season directory layout (deployment-side)

```
~/.factor-echelon/
├── config.yaml                          # default theme, user profile, mode (solo/team)
├── advisory-board/                      # SHARED across all seasons
│   ├── neil-degrasse-tyson/
│   │   ├── SOUL.md, AGENTS.md, HEARTBEAT.md, MEMORY.md, ...
│   ├── stephen-hawking/                 # Skill Promotion Oracle
│   └── ...                              # other SMEs
│
├── knowledge-base/                      # mempalace integration
│   ├── local/                           # solo mode + team-mode private wing
│   │   └── <mempalace ChromaDB files>
│   ├── kb-git/                          # solo mode git mirror
│   │   └── <git repo of KB>
│   └── team-config.yaml                 # team mode backend URL, Entra config
│
└── seasons/
    ├── season-01-<slug>/
    │   ├── season.yaml                  # theme, roster, tier, state
    │   ├── manifest.yaml                # Penny's handoff to Leonard
    │   ├── characters/
    │   │   ├── leonard/                 # TBBT — live
    │   │   ├── sheldon/
    │   │   └── ...
    │   ├── channels.yaml                # Discord/Slack/Telegram bindings
    │   ├── memory/
    │   │   └── YYYY-MM-DD.md            # daily logs per character
    │   ├── workspace/                   # project files, main branch
    │   └── worktrees/                   # per-agent isolated worktrees
    │       ├── stuart-task-42/
    │       ├── raj-task-43/
    │       └── ... (max 10 concurrent)
    │
    ├── season-02-<slug>/                # potentially different theme
    └── ...
```

**Multi-season user multiplexing model (v0.1):**

Each season has its own channel set (e.g., `#season01-pennys-apartment`, `#season01-leonards-office`, `#season01-review-gates`). The user switches context by switching channels. There is no meta-orchestrator above Leonard; each season runs its own Leonard instance, and cross-season coordination happens via the advisory board (the only shared layer).

```
User
  │
  ├─▶ #season01-pennys-apartment   ──▶ Season 01 Penny
  ├─▶ #season01-leonards-office    ──▶ Season 01 Leonard
  ├─▶ #season01-review-gates       ──▶ Season 01 review ceremonies
  │
  ├─▶ #season02-pennys-apartment   ──▶ Season 02 Penny (different theme possible)
  ├─▶ #season02-leonards-office    ──▶ Season 02 Leonard
  │
  └─▶ #advisory-board              ──▶ Shared SMEs (all seasons)
```

No global "factor-echelon" channel. The user's attention is directed by which channel is active. On CLI, `factor-echelon season use <season-slug>` sets the default context for subsequent commands; otherwise commands must specify `--season`.

**Cross-season isolation guarantees:**
- Characters in Season 01 cannot read Season 02's COMMITMENTS.md, MEMORY.md, or workspace.
- Characters CAN query the shared advisory board and the team wing of mempalace (not the other season's private wing).
- Worktree concurrency caps are per-season (max 10 each, independent), not global.
- If two seasons' agents need to coordinate, the user acts as the bridge by manually copying context or elevating a decision to a shared channel.

### 12.2 Knowledge base modes

**Solo mode (default, v0.1):**
```
Local ChromaDB + git-backed sync
~/.factor-echelon/knowledge-base/local/ (mempalace)
~/.factor-echelon/knowledge-base/kb-git/ (git mirror for cross-device sync)
Solo user can sync their own KB across multiple machines via git push/pull
"Team of 1"
```

**Team mode (v0.5):**
```
Each user node keeps local mempalace (private wing)
Plus connects to a shared Azure backend (team wing)

Azure architecture:
- Azure Container Apps or AKS (mempalace server)
- Azure Database for PostgreSQL or AKS-hosted ChromaDB (vector store)
- Azure Entra ID (identity + per-user scoping)
- Azure Key Vault (secrets)
- Azure Storage Account (raw payload backup)

Multi-node, multi-dev-instance support (each developer can have laptop + desktop + tablet nodes)
Private wing stays local, team wing connects to Azure
Upgrade: mempalace config --mode team --db-target <azure-url>
```

**Solo → Team migration semantics (v0.5 upgrade path):**

When a solo user upgrades to team mode, their existing local knowledge base is treated as follows:

1. **Private wing stays local.** Everything the user has captured remains in
   `~/.factor-echelon/knowledge-base/local/` and stays private to that node.
   No data is copied to the team backend automatically.

2. **Team wing is newly provisioned.** The Azure backend is initialized empty
   for this user, scoped by their Entra identity. Other team members' existing
   team-wing data becomes visible if they have access to the same backend.

3. **Promotion is explicit and granular.** The user reviews their existing
   local learnings and explicitly promotes items to the team wing via
   `factor-echelon kb promote <room-id>` (see §7.8). Nothing is auto-promoted.

4. **Rollback is supported.** If a user regrets promoting an item, they can
   demote it back to private via `factor-echelon kb demote <room-id>`, or
   delete it entirely from the team wing via `factor-echelon kb delete`.

5. **In-flight captures during upgrade:** the upgrade command pauses new
   captures during the Azure provisioning window (typically <60s), queues
   any captures that arrive during pause, and flushes them to the private
   wing after completion. Team wing starts receiving captures only after
   the user explicitly promotes or configures a default capture destination.

6. **Downgrade (team → solo) is supported but destructive to team data.**
   `factor-echelon config --mode solo` disconnects from the team backend.
   The local private wing is untouched. The user's contributions to the
   team wing remain in the team backend (other team members' access is
   unchanged) — the downgrade is "this node no longer syncs," not "delete
   my team contributions."

**Migration edge cases:**
- Network failure mid-upgrade → rollback to solo mode, log failure, prompt user to retry.
- Entra authentication failure → block upgrade, stay in solo mode, surface the auth error.
- Team backend schema incompatible with local → upgrade blocked, user must resolve (likely version mismatch; pin versions per §15).

### 12.3 mempalace wing mapping

| mempalace concept | factor-echelon mapping |
|---|---|
| Wing (private) | `season-XX` per project + `personal-private` for individual user |
| Wing (team-shared) | `team-shared` accessible by all nodes |
| Hall | Memory type: `learnings`, `patterns`, `decisions`, `reviews/<type>`, `skills/<status>` |
| Room | Individual captured item |
| Mining mode `projects` | Used by Penny during ingestion |
| Mining mode `convos` | Used to capture inter-agent coordination + user conversations |
| Mining mode `general` | Used during merge-capture to auto-classify learnings |
| MCP tools (19) | Consumed directly by Claude Code adapter via `claude mcp add mempalace` |

### 12.4 Review gates and rating system

**Six review gates, hybrid rating scheme:**

| Gate | Owner | Type | Merge requirement |
|---|---|---|---|
| Architecture Review | Sheldon | Pass/Fail | Pass |
| Code Review | Alex Jensen | Pass/Fail | Pass |
| QA Review | Bernadette | Pass/Fail | Pass |
| Security Review | Barry Kripke | Pass/Fail | Pass |
| Adversarial Review | Wil Wheaton | ⭐⭐⭐⭐⭐ | ≥4 stars |
| UI Functionality Review | UX Designer | ⭐⭐⭐⭐⭐ | ≥4 stars |
| Refinement Pass | Leslie Winkle | Pass/Fail (runs after others) | Pass |

**5-star rating scale (Adversarial + UI gates only):**
- ⭐ 1 — Reject, fundamental issues
- ⭐⭐ 2 — Reject, significant issues
- ⭐⭐⭐ 3 — Conditional, minor issues must be fixed
- ⭐⭐⭐⭐ 4 — Approved with notes
- ⭐⭐⭐⭐⭐ 5 — Approved unconditionally

Ratings tracked over time as team quality metric.

**Counselor sidecar for high-risk PRs.** For PRs flagged as high-risk (architectural change, security-sensitive code, data migration, cross-service contract change), Wil's adversarial gate optionally invokes the Counselor (§13) to produce a multi-model consensus rating alongside his own. Not every PR — the 4x cost is reserved for changes where it earns its keep. Gating heuristic lives in `counselor/placements/high-risk-adversarial.md`.

### 12.5 Worktree execution model

- **Each task → one worktree**. Max 10 concurrent per season.
- **Worktree lifecycle on rejection:** agent edits in place, same worktree, until gates pass.
- **Merges serialized through Leonard.** Parallel work, serialized merges.
- **Cleanup:** worktree removed after successful merge; orphaned worktrees auto-pruned after 7 days idle.

---

## 13. The Counselor — Multi-Model Council Review

### 13.1 Concept

The Counselor is a multi-model review council. Rather than relying on a single model (however good) to make high-leverage decisions, four independent model perspectives are consulted in parallel and their outputs combined via a placement-specific consensus algorithm. Different models catch different things; different training lineages expose different blind spots. For decisions where the cost of being wrong exceeds the cost of running four models, the Counselor is invoked.

The Counselor is **not** a replacement for the existing review gates or the advisory board. It's a **cross-cutting sidecar** that can be invoked at specific high-leverage placements. Most day-to-day work never triggers the Counselor.

### 13.2 The four models

| Model | Provider | Lineage |
|---|---|---|
| **Gemini Pro** | Google | Gemini family — strong on code generation, multimodal reasoning |
| **GPT-5** | OpenAI | GPT family — strong on general reasoning, broad knowledge |
| **Claude Opus 4.6** | Anthropic | Claude family — strong on long-context, nuanced judgment |
| **Grok** | xAI | Grok family — contrarian perspective, willing to push back |

Four models, four distinct training lineages, four different blind spots. The Counselor's value comes from the diversity of perspectives, not from having "more" of any one lineage.

Model selection is configurable via `counselor/models.yaml`. Users can swap models (e.g., substitute GPT-5 with a fine-tuned variant, or replace Grok with a local open-weights model) as long as the count stays at four and the lineages remain diverse.

### 13.3 Four placement points

**Placement A — Skill Promotion Gate**

When a learned skill in `mempalace/skills/pending/` reaches its use-count threshold (default: 3 uses across 2 seasons), the Stephen Hawking character (or the theme's equivalent convener) invokes the Counselor. Each model independently evaluates the candidate skill on correctness, generality, and fit with existing canonical skills.

- **Frequency:** Rare (per candidate skill)
- **Consensus algorithm:** **Min-score** — take the lowest rating of the four. Conservative by design; promotion is a one-way door and the library's quality matters more than volume.
- **Approval threshold:** ≥4 of 5 stars on the min-score.
- **Thematic framing:** "Hawking consults his three peers before declaring something worthy of the canon."

**Placement B — Design / ADR Review**

When a major design document, architectural decision record (ADR), or spec is written, the Counselor reviews it before the team begins implementation. This is the **highest-leverage placement** because design errors are 10-100x more expensive than code errors.

Triggered by:
- Every new spec in `docs/specs/` or `docs/adrs/`
- Any architectural change that touches more than one service boundary
- Any data schema change that requires migration

- **Frequency:** Rare (a few per season)
- **Consensus algorithm:** **Majority** — 2 of 4 models approve. Allows for one dissenting voice (especially Grok's contrarian take) without blocking on it, but requires more than a single model's opinion.
- **Approval threshold:** ≥3 of 4 models give ≥4 stars.
- **Thematic framing:** "Major design decisions get reviewed by the council before the team commits."

**Placement C — Deadlock Escalation**

When a character hits a deadlock — a task has bounced 3 times on the same review gate, Sheldon and another archetype disagree on an architectural choice, or scope has spiraled beyond Leonard's authority — Leonard invokes the Counselor as a tie-breaker.

- **Frequency:** Occasional (on stuck situations only)
- **Consensus algorithm:** **Majority** — 2 of 4 models' verdict wins, with the dissenting view captured in the decision log
- **Approval threshold:** Not applicable — this is a tie-breaker, not an approval gate. Council outputs become the binding decision.
- **Thematic framing:** "Leonard asks the council when the team is stuck."

**Placement D — High-Risk Adversarial Review (sidecar)**

For PRs flagged as high-risk, Wil Wheaton's adversarial gate optionally invokes the Counselor to produce a multi-model consensus rating alongside his own. Not every PR — the cost is reserved for high-risk changes where multi-model input earns its keep.

High-risk flags:
- Architectural change (touches more than one service boundary)
- Security-sensitive code (auth, crypto, input validation, secrets)
- Data migration (schema change with existing rows)
- Cross-service contract change (API or message shape)
- Changes tagged by `counselor/placements/high-risk-adversarial.md` trigger rules

- **Frequency:** Gated — only on high-risk PRs, typical rate ~5-10% of all PRs
- **Consensus algorithm:** **Majority** — 2 of 4 models give ≥4 stars on the 5-star rating scale
- **Approval threshold:** ≥3 of 4 models give ≥4 stars. Wil's own rating is independent and must also pass ≥4.
- **Thematic framing:** "Wil's harsh take plus a council consensus."

### 13.4 Theme integration — convener characters

The Counselor is theme-agnostic at the model level but themed at the invocation level. Each theme has a **convener** — an in-theme character whose role is to initiate Counselor invocations when the placement trigger fires. The convener is the narrative framing for an otherwise abstract multi-model call.

| Theme | Convener | Rationale |
|---|---|---|
| **TBBT** | Stephen Hawking | Canonical escalation oracle, already Skill Promotion Reviewer |
| **Star Wars** | Yoda | Grand Master of the Jedi Order, advisory emeritus |
| **Friends** (v1+) | — | To be decided when theme is authored |
| **Custom themes** | Synthesized at theme creation time | Must designate a "sage" character |

Defined in `counselor/conveners-per-theme.yaml`.

### 13.5 Invocation protocol

```
Trigger fires (placement A/B/C/D condition met)
    │
    ▼
Convener character (Hawking for TBBT, Yoda for SW) receives trigger
    │
    ▼
Convener assembles the prompt from counselor/placements/<placement>.md template
    │
    ▼
Four parallel model invocations:
    - Gemini Pro
    - GPT-5
    - Claude Opus 4.6
    - Grok
Each gets the same prompt, runs independently, no cross-contamination
    │
    ▼
Four responses collected (timeout: 120s per model; 3 of 4 required)
    │
    ▼
Consensus algorithm applied (min-score or majority, per placement)
    │
    ▼
Verdict written to mempalace:
    - Placement type + context
    - Each model's output
    - Aggregated verdict
    - Dissenting opinions preserved
    │
    ▼
Convener reports verdict back to invoker (Leonard, Wil, etc.)
```

### 13.6 Cost profile and budgeting

The Counselor is expensive by design — four model calls per invocation. Budgeting strategy:

| Placement | Typical monthly invocations | Cost envelope |
|---|---|---|
| A — Skill Promotion | 1-3 | Negligible |
| B — Design Review | 2-5 | Low |
| C — Deadlock Escalation | 3-8 | Low |
| D — High-Risk Adversarial (gated) | 10-30 | Moderate |

Users with tight budgets can disable placement D entirely in `config.yaml` (`counselor.placements.high_risk_adversarial: false`), keeping only A, B, and C as "ceremonial" invocations on rare events.

### 13.7 Failure modes

| Failure | Detection | Recovery | Escalation |
|---|---|---|---|
| One model unavailable (rate limit, API down) | Per-model timeout | Proceed with 3 of 4, log the miss | Continue if ≥3 respond; escalate if <3 |
| Two or more models unavailable | Multiple timeouts | Abort invocation, mark decision as "Counselor unavailable" | Leonard decides whether to retry later or proceed without |
| Model responses wildly disagree (stdev on rating > 1.5) | Variance check | Log "high disagreement", include in verdict | Human review recommended for high-stakes placements (A and B) |
| Counselor times out entirely | Global timeout (5 min) | Abort, mark decision as "timeout" | User notified |
| Model returns malformed response | Schema check on output | Exclude that model from consensus | Proceed with remaining models if ≥3 |
| Cost budget exceeded | Per-month budget check | Block new invocations until next period | User notified, can override |

### 13.8 Relationship to existing architecture

- **Advisory board vs Counselor:** the advisory board is per-season themed SMEs consulted on domain questions (e.g., "which vector DB should we use"). The Counselor is a cross-cutting multi-model review at specific placement points. SMEs are themed persistent personas; the Counselor is a non-diegetic capability wrapped in a thin thematic convener.
- **Knowledge base vs Counselor:** the Counselor's verdicts are written to mempalace so that future agents can learn from past Counselor decisions. "Why was this skill rejected?" becomes a queryable fact.
- **Review gates vs Counselor:** the Counselor does not replace existing review gates. It sidecars the Adversarial gate (placement D) and adds two new standalone gates (A Skill Promotion, B Design Review) that didn't exist before. Placement C Deadlock is an escalation mechanism, not a gate.

### 13.9 Phasing within factor-echelon releases

Per Decision γ (full scope), **all four Counselor placements ship in v0.1.** Timeline is extended to accommodate this; no placements are deferred.

| Release | Counselor scope |
|---|---|
| **v0.1** | **All four placements ship.** Placement A (Skill Promotion), B (Design Review on new `docs/specs/`), C (Deadlock Escalation), D (High-Risk Adversarial sidecar with manual flagging). API key setup integrated into OOBE. |
| **v0.5** | Automatic high-risk PR flagging via rule engine (replaces v0.1 manual flagging for Placement D). Cross-session verdict history queryable via mempalace. Per-placement cost budget reporting. |
| **v1.0** | Budget management UI. Model swapping via `counselor config`. Counselor self-evaluation — periodic comparison of verdicts vs ground-truth outcomes, used to tune consensus algorithms. Pattern mining across accumulated verdicts. |

**Dead-code warning for Placement A in v0.1:** Placement A (Skill Promotion) requires a skill candidate to have been used ≥3 times across ≥2 seasons before the Counselor is invoked. In a fresh v0.1 install, the first season's skills cannot trigger promotion because no second season exists yet. Placement A is **conditionally active** — the infrastructure ships, the invocation protocol works, but real-world invocations only fire after the user has run at least two seasons. This is documented in §13.10 and not a bug.

### 13.10 Open design questions (not blocking v0.1)

1. **Model access authentication** — how does the user configure API keys for four providers? Secure storage, rotation, per-user vs shared team-mode.
2. **Local model fallback** — if internet unavailable, can the Counselor fall back to local models (Ollama, etc.)? Diversity is reduced but availability matters.
3. **Model versioning** — when a provider releases a new model version, does the Counselor auto-upgrade or pin to a specific version for reproducibility?
4. **Disagreement logging for research** — high-disagreement cases are valuable training data for understanding where models fail. Should we expose this as a feature for users who want to study it?
5. **Counselor self-evaluation** — periodically compare Counselor verdicts to ground-truth outcomes (did the promoted skill actually work? did the design review catch real problems?) and use this to tune consensus algorithms.

---

## 14. Open Questions

These don't block v0.1 alpha but should be resolved during implementation planning or early in v0.5.

**Resolved during brainstorm (moved to locked sections):**
- ~~CI/CD archetype casting~~ → Dr. Eric Gablehauser (§11.1 row 14)
- ~~UX Designer casting~~ → Emily Sweeney (§11.1 row 18)
- ~~All 23 TBA archetype rows~~ → resolved in §11.1
- ~~Advisory board SME casting~~ → resolved in §11.2
- ~~Private vs team flag at capture time~~ → default private, explicit promotion (§7.8, §12.2)
- ~~Git repo layout for solo KB mode~~ → one repo per install at `~/.factor-echelon/knowledge-base/kb-git/` (§12.2)
- ~~mempalace version pinning~~ → pinned to a specific commit (§15)

**Still open:**

1. **Platform delegation for worktrees** — do adapters wrap a common `git-worktrees` skill (the superpowers pattern) or delegate to the target platform's native worktree management? Claude Code has native worktree support; OpenClaw is unclear. Likely path: wrap a common skill that detects platform and delegates when supported.
2. **CI/CD release automation structure** — workflow file layout, secrets management, artifact signing, release notes generation. Fully scoped in v0.5 when automation replaces manual releases.
3. **Azure team-mode architecture specifics (v0.5)** — Container Apps vs AKS, CosmosDB vs PostgreSQL, containerized ChromaDB vs managed vector store. Requires Azure architect review before v0.5 implementation begins.
4. **Counselor model swap policy** — when a provider releases a new model version (e.g., GPT-5 → GPT-5.5), does the Counselor auto-upgrade or pin to a specific version for reproducibility? Proposed default: pin versions, user opts into upgrades.
5. **Counselor local fallback (v1+)** — if internet unavailable, can the Counselor fall back to local models (Ollama, llama.cpp)? Diversity reduced but availability matters.
6. **Counselor disagreement logging for research** — high-disagreement cases are valuable training data. Should we expose a feature for users who want to study it?
7. **Counselor self-evaluation (v1.0)** — periodic comparison of verdicts vs ground-truth outcomes (did the promoted skill actually work? did the design review catch real problems?) to tune consensus algorithms.
8. **Young Sheldon expansion boundary** — the v0.1 roster uses Young Sheldon as a bundled expansion, but beyond that the theme-engine should know when to reach into further themes. What's the trigger to go beyond the combined TBBT+Young Sheldon cast? Deferred to v0.5 where runtime tag-matching ships.
9. **Mid-season re-cast consent flow** — when soul drift triggers a character respawn (§8.5), does the respawn automatically use the same character reload or does the user confirm? Proposed: auto-reload for minor drift, user confirm for full respawn.
10. **Channel platform support matrix** — Discord, Slack, Telegram, Matrix are all viable for season channels. Which ship in v0.1? Proposed: Discord + Slack in v0.1, Telegram + Matrix in v0.5.

---

## 15. References

### Research inputs
- `docs/research/team-composition.md` — 3-tier role taxonomy with industry sources
- `docs/research/themes/tbbt-cast.md` — 40-character TBBT catalog
- `docs/research/themes/star-wars-cast.md` — 49-character Star Wars catalog

### External tools (with v0.1 pinning)
- [**mempalace**](https://github.com/milla-jovovich/mempalace) — memory palace backed by ChromaDB; wing/hall/room structure; MCP server with 19 tools. **Pinned for v0.1:** the HEAD commit as of 2026-04-08 (the day after mempalace's 2026-04-07 launch). Implementation plan must capture the exact SHA at scaffolding time and freeze it. Version pin is stored in `src/team-factory/protocols/external-deps.yaml`. Upgrade to a newer mempalace release is a conscious decision, not automatic, and requires re-running the full E2E test matrix.
- [**Hermes Agent**](https://github.com/NousResearch/hermes-agent) — target platform (v0.5 adapter); built on [agentskills.io](https://agentskills.io) open standard. Pinned to a specific tag at adapter implementation time.
- [**Claude Code**](https://claude.com/claude-code) — target platform (v0.1 adapter); skills + plugins. Pinned to a major version; compatibility shims for minor upgrades.
- **OpenClaw** — target platform (v0.1 adapter); reference: existing `~/Downloads/openclaw-dev-team/` bundle. OpenClaw version pinning TBD — needs upstream stability signal.
- **KB interface abstraction layer** — while v0.1 uses mempalace as its only KB backend, the spec requires `shared-skills/kb-interface/` as an abstraction boundary. If mempalace stability or schema breaks during alpha, a secondary backend (Honcho, custom ChromaDB, or local file-only) can be slotted in without rewriting the data flows.

### Canonical team-composition sources
- Skelton & Pais, *Team Topologies*
- Beyer et al., *Site Reliability Engineering* (sre.google/sre-book)
- Forsgren, Humble, Kim, *Accelerate*
- Larson, *Staff Engineer* (staffeng.com)
- Kniberg & Ivarsson, *Scaling Agile @ Spotify* + Jeremiah Lee's "Failed #SquadGoals"

### Prior art
- `~/Library/Mobile Documents/com~apple~CloudDocs/Skippy/BBT Executive Package/` — original BBT team roster and vision docs
- `~/Library/Mobile Documents/com~apple~CloudDocs/Skippy/team-factory.skill` — monolithic skill file, source of forward-port
- `~/Downloads/openclaw-dev-team/` — OpenClaw-shaped prior implementation
- `~/Library/Mobile Documents/com~apple~CloudDocs/Skippy/examples/james-jimmy/` — soul-document schema reference (SOUL, AGENTS, HEARTBEAT, MEMORY, USER, COMMITMENTS, DEPLOY-CHECKLIST)
