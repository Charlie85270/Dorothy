# Customizing the Roster

factor-echelon composes teams dynamically based on project scope. This guide explains how tiers work, how to manually adjust the roster, and how mid-season expansion operates.

---

## Team tiers

The scope estimator classifies every project into one of three tiers based on PRD complexity:

| Tier | Role count | Typical project |
|---|---|---|
| **Medium** | ~11 roles | Landing page, small web app, single-service API |
| **Large** | 16-20 roles | Multi-service SaaS, mobile + web, data pipeline |
| **Enterprise** | 30+ roles | Platform with ML, mobile, security compliance, i18n |

### Medium tier core roles (~11)
These roles are always present regardless of project type:
- ingestion-pm, user-handler, principal-architect, frontend-engineer, backend-engineer, devops-infrastructure, qa-lead, security-engineer, code-reviewer, adversarial-reviewer, refinement-builder

### Large tier additions (16-20)
Medium core plus specialized roles triggered by PRD signals:
- database-engineer, technical-writer, cicd-pipeline-engineer, ux-designer, scrum-master, release-manager, incident-commander, performance-engineer, sre-invisible-ops

### Enterprise tier additions (30+)
Large tier plus deep specializations:
- mobile-ios-engineer, mobile-android-engineer, ml-engineer, data-engineer, privacy-officer, accessibility-engineer, localization-engineer, appsec-engineer, platform-engineer, data-scientist, ux-researcher, content-designer, analytics-engineer, test-automation-engineer, developer-experience-engineer, mlops-engineer, and more

---

## Split triggers

Some archetypes split into specialized sub-roles as complexity grows. Split triggers are defined in `src/team-factory/roster-composer/split-trigger-rules.md`.

Examples:
- `security-engineer` splits into `security-engineer` + `appsec-engineer` + `privacy-officer` at enterprise scale
- `backend-engineer` splits into `backend-engineer` + `database-engineer` + `data-engineer` when the PRD mentions data pipelines or ETL
- `qa-lead` splits into `qa-lead` + `test-automation-engineer` when test scope exceeds a threshold
- `devops-infrastructure` splits into `devops-infrastructure` + `sre-invisible-ops` + `platform-engineer` at enterprise scale

Split triggers fire automatically during initial composition and can also fire during mid-season expansion.

---

## Manual roster adjustment

### Adding a character mid-season

To add a character that Penny did not include in the initial composition:

1. Identify the archetype you need (see `src/team-factory/archetypes/` for the full list of 43 archetypes).
2. Ask Leonard to "add [archetype] to the team." Leonard invokes Penny's expansion logic.
3. Penny selects the themed character for that archetype, creates their soul package in the season, and provisions a worktree slot.
4. The new character is immediately available for task assignment.

### Removing a character

Ask Leonard to "remove [character] from the team." The character's active worktrees are cleaned up and their role is unassigned. Their knowledge base contributions are preserved -- removing a character does not delete their learnings.

**Protected roles:** The following core roles cannot be removed because they are essential to the review pipeline: ingestion-pm, user-handler, principal-architect, code-reviewer, refinement-builder.

### Changing the tier

You can force a tier change by asking Leonard to "set the team to [large/enterprise] tier." This triggers re-composition: new archetypes are added for the higher tier but existing characters are not removed. Tier changes are additive.

---

## Mid-season expansion

As work progresses, the system detects capability gaps and proposes expansions automatically:

1. **Detection** -- The roster composer monitors task assignments and review feedback. If tasks consistently require capabilities not covered by any current character, it flags a gap.
2. **Proposal** -- Penny proposes adding specific archetypes to fill the gap, with rationale explaining why the gap was detected.
3. **User approval** -- You approve or reject the expansion. No characters are added without your explicit consent.
4. **Provisioning** -- Approved characters are cast from the theme, their soul packages are created, and they join the active roster immediately.

Example: If the team keeps receiving security-related review feedback but has no dedicated `appsec-engineer`, the system proposes splitting the `security-engineer` role.

---

## Theme constraints

Not every theme has characters for every archetype. When the theme lacks a character for a needed archetype:
- The theme engine checks expansion packs (e.g., Young Sheldon for TBBT).
- If still unmatched, the system assigns a "generic" character with the archetype's default personality.
- In v1+, custom theme synthesis can generate new characters on demand.

---

## See also

- [Writing an Archetype](writing-an-archetype.md) -- how to create new archetypes
- [Writing a Character](writing-a-character.md) -- how to create characters for a theme
- [Architecture](../concepts/architecture.md) -- the composition layer
