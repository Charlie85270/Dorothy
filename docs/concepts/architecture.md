# Architecture Overview

factor-echelon is organized into four layers and builds to three targets.

---

## The four layers

### 1. Content layer

The foundation: **43 archetypes** defining theme-agnostic role blueprints, and **themed characters** that bring those archetypes to life. Each character ships with a full soul package (SOUL.md, AGENTS.md, HEARTBEAT.md, MEMORY.seed.md, persona.md). Two preset themes ship in v0.1: The Big Bang Theory (42 characters + Young Sheldon expansion) and Star Wars (stub).

Archetypes are grounded in published research -- Team Topologies (Skelton & Pais), SRE (Beyer et al.), Accelerate (Forsgren, Humble, Kim), and Staff Engineer (Larson). Every archetype maps to one of the four Team Topologies team types: stream-aligned, platform, enabling, or complicated-subsystem.

### 2. Composition layer

Three components turn a PRD into a live team:

- **Roster Composer** reads the work intake, estimates scope (medium / large / enterprise), and selects the archetypes needed.
- **Theme Engine** maps selected archetypes to themed characters using the theme's `role-mapping.yaml`. Handles secondary roles, expansion packs, and (in v1+) runtime synthesis for custom themes.
- **Scope Estimator** classifies project complexity and determines the team tier: medium (~11 roles), large (16-20), or enterprise (30+).

Split triggers define when a generalist role should spawn specialized sub-roles (e.g., "security-engineer" splits into "appsec-engineer" + "privacy-officer" at enterprise scale).

### 3. Runtime layer

The execution engine:

- **Seasons** provide per-project isolation. Each season has its own workspace, characters, knowledge base wing, and lifecycle (spawn, active, archive, restore). Multiple seasons run concurrently.
- **Worktrees** give each character an isolated git worktree for parallel work. Max 10 per season. Branches merge back through Leonard (the User Handler) as merge authority.
- **Review gates** enforce quality: 6 parallel gates (architecture, code, QA, security, adversarial, UI) plus a sequential Refinement gate. Tasks need majority approval plus a 5-star rating.
- **Merge authority** is serialized through the User Handler archetype. No character can merge their own work.

### 4. Cross-cutting layer

Services shared across all seasons:

- **The Counselor** is a 4-model council (Gemini, GPT-5, Opus 4.6, Grok) that reviews at four high-leverage placements: skill promotion, design review, deadlock escalation, and high-risk adversarial review.
- **Knowledge Base** (mempalace-backed) captures learnings, patterns, decisions, and skills. Organized into wings (per-season) with halls and rooms. Solo mode uses local storage; team mode (v0.5) uses Azure-backed centralized store.
- **Advisory Board** provides 12 cross-season specialist personas for on-demand consultation. Instantiated once per install, available to every season.

---

## Three build targets

factor-echelon authors once in an agentskills.io-compliant format and builds to three targets:

| Target | Format | Status |
|---|---|---|
| **Claude Code** | Plugin (plugin.json + SKILL.md) | v0.1 |
| **OpenClaw** | Bundle (install.sh + openclaw.json) | v0.1 |
| **Echelon** | Desktop app (Electron, season-pack) | v0.1 (primary) |

Architectural invariant: adapters contain zero skill logic. All behavior lives in `src/team-factory/`. If an adapter needs real logic, the core must expose a new hook instead.

---

## Further reading

- [Seasons](seasons.md) -- the per-project isolation model
- [Worktree execution](worktree-execution.md) -- parallel work with gated merges
- [The Counselor](counselor.md) -- multi-model review council
- [Knowledge Base](knowledge-base.md) -- mempalace integration
