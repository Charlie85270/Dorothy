# Plan 03: Composition Engine Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the composition primitives — given a PRD, produce a roster manifest. Three components: `roster-composer` (work → archetype list), `theme-engine` (archetype list + theme → character roster), and `capabilities/access-matrix.yaml` (RBAC scopes per archetype).

**Architecture:** TypeScript skills that read from the Plan 02 content library and produce structured YAML manifests. Skills are invoked by higher layers (Penny in Plan 07, continuous expansion in Plan 07) and testable in isolation with fixture inputs.

**Tech Stack:** TypeScript + Zod schemas (from Plan 01). New: tag-based similarity scoring for theme expansion (stub in v0.1, real implementation in v0.5).

**Spec reference:** §6.1 components, §7.3 (steps 4-5 theme mapping & capability binding), §7.5 (continuous expansion), §11.1 single-role rule + Wil Wheaton exception, §12.4 review gates.

**Dependencies:** Plans 01, 02 complete.

---

## File Structure

```
src/team-factory/
├── roster-composer/
│   ├── SKILL.md
│   ├── scope-estimator.md              # PRD complexity → tier
│   ├── split-trigger-rules.md          # when to spawn specialized sub-archetypes
│   └── continuous-expansion.md         # mid-season expansion logic
│
├── theme-engine/
│   ├── SKILL.md
│   ├── mapping.md                      # archetype → character assignment logic
│   ├── expansion.md                    # runtime tag-matching (stub v0.1)
│   └── synthesis.md                    # custom-theme generation (deferred v1)
│
└── capabilities/
    └── access-matrix.yaml              # archetype → scoped shared-skills
```

Build-side additions:

```
build/
├── skills/                             # NEW — runtime skill implementations
│   ├── roster-composer.ts
│   ├── theme-engine.ts
│   └── capability-resolver.ts
└── lib/
    ├── prd-parser.ts                   # parses incoming PRD into structured form
    └── tag-matcher.ts                  # theme similarity scoring

tests/
├── fixtures/
│   ├── prds/
│   │   ├── tiny-landing-page.md
│   │   ├── medium-saas.md
│   │   └── large-multi-platform.md
│   └── expected-rosters/
│       ├── tiny-roster.yaml
│       ├── medium-roster.yaml
│       └── large-roster.yaml
└── integration/
    ├── roster-composer.test.ts
    ├── theme-engine.test.ts
    └── capability-resolver.test.ts
```

---

## Task 1: `capabilities/access-matrix.yaml` — RBAC matrix

**Files:**
- Create: `src/team-factory/capabilities/access-matrix.yaml`

- [ ] **Step 1: Author the access matrix**

Format: archetype → list of scoped capabilities. Scopes use `<skill>:<permission>` format.

```yaml
# capabilities/access-matrix.yaml
# RBAC matrix: archetype → scoped shared-skills
# Format: <skill>:<scope> where scope is read | write | admin | execute

ingestion-pm:
  - source-control:read
  - prd-intake:write
  - file-ops:write
  - knowledge-retrieval:read

user-handler:
  - source-control:read
  - source-control:write  # merge authority
  - source-control:admin  # force-merge override
  - inter-agent-protocol:admin
  - quality-gate:override
  - knowledge-retrieval:read
  - knowledge-capture:write
  - counselor-invocation:execute  # Placement C: deadlock escalation

scrum-master:
  - source-control:read
  - knowledge-retrieval:read
  - inter-agent-protocol:execute

principal-architect:
  - source-control:read
  - source-control:write
  - knowledge-retrieval:read
  - knowledge-capture:write
  - quality-gate:approve  # architecture review gate

# ... continue for all 43 archetypes
# See full matrix below
```

Full matrix (abbreviated — complete all 43 during implementation):

```yaml
frontend-engineer:
  - source-control:read
  - source-control:write
  - git-worktrees:write
  - file-ops:write

backend-engineer:
  - source-control:read
  - source-control:write
  - git-worktrees:write
  - file-ops:write

database-engineer:
  - source-control:read
  - source-control:write
  - git-worktrees:write
  - file-ops:write

qa-lead:
  - source-control:read
  - quality-gate:approve  # QA review gate
  - quality-gate:reject

security-engineer:
  - source-control:read
  - quality-gate:approve  # security review gate
  - quality-gate:reject
  - quality-gate:escalate  # P0 auto-escalation

adversarial-reviewer:
  - source-control:read
  - quality-gate:rate       # 5-star rating
  - knowledge-retrieval:read
  - counselor-invocation:execute  # Placement D: high-risk sidecar

code-reviewer:
  - source-control:read
  - quality-gate:approve  # code review gate
  - quality-gate:reject

refinement-builder:
  - source-control:read
  - source-control:write    # can push refinements
  - quality-gate:approve    # refinement pass gate

# ... (continue for remaining 34 archetypes)

# Advisory board SMEs have their own simpler scopes:
_advisory_board:
  all_smes:
    - knowledge-retrieval:read
    - knowledge-capture:write  # consultation responses logged
  stephen-hawking:  # Escalation Oracle special scopes
    - counselor-invocation:execute  # Placement A: skill promotion
```

- [ ] **Step 2: Write validator for access-matrix schema**

Add to `build/lib/validators.ts`:

```typescript
export const ACCESS_MATRIX_CAPABILITIES = new Set([
  "source-control:read", "source-control:write", "source-control:admin",
  "git-worktrees:read", "git-worktrees:write",
  "file-ops:read", "file-ops:write",
  "knowledge-retrieval:read",
  "knowledge-capture:write",
  "quality-gate:approve", "quality-gate:reject", "quality-gate:rate",
  "quality-gate:override", "quality-gate:escalate",
  "inter-agent-protocol:execute", "inter-agent-protocol:admin",
  "counselor-invocation:execute",
  "prd-intake:read", "prd-intake:write",
]);

export function validateAccessMatrix(matrix: any): ValidationResult {
  // verify all listed capabilities are in ACCESS_MATRIX_CAPABILITIES
  // verify every archetype in src/team-factory/archetypes/ has an entry
  // verify Wil Wheaton's adversarial-reviewer correctly references DevRel secondary
}
```

- [ ] **Step 3: Test the access-matrix validator** with a fixture

- [ ] **Step 4: Commit** — `feat(capabilities): add access-matrix.yaml with scoped RBAC for all 43 archetypes`

---

## Task 2: PRD parser

**Files:**
- Create: `build/lib/prd-parser.ts`
- Create: `tests/fixtures/prds/tiny-landing-page.md`
- Create: `tests/fixtures/prds/medium-saas.md`
- Create: `tests/fixtures/prds/large-multi-platform.md`

- [ ] **Step 1: Author three fixture PRDs** representing Medium, Large, and Enterprise tiers.

- [ ] **Step 2: Write failing test**

```typescript
// tests/unit/prd-parser.test.ts
import { test, expect } from "bun:test";
import { parsePRD } from "../../build/lib/prd-parser.ts";
import { readFileSync } from "node:fs";

test("parsePRD extracts goals, stakeholders, scope hints", () => {
  const content = readFileSync("tests/fixtures/prds/medium-saas.md", "utf-8");
  const parsed = parsePRD(content);
  expect(parsed.goals.length).toBeGreaterThan(0);
  expect(parsed.scope_hints.platforms).toBeDefined();
  expect(parsed.scope_hints.tier_estimate).toMatch(/medium|large|enterprise/);
});
```

- [ ] **Step 3: Write `prd-parser.ts`**

```typescript
export interface ParsedPRD {
  title: string;
  goals: string[];
  user_stories: string[];
  stakeholders: string[];
  scope_hints: {
    platforms: string[];          // detected from "mobile", "web", "iOS", "android"
    compliance: string[];         // detected from "HIPAA", "SOC2", "GDPR"
    technologies: string[];       // detected from tech keyword list
    tier_estimate: "medium" | "large" | "enterprise";
  };
  raw: string;
}

export function parsePRD(content: string): ParsedPRD {
  // Parse markdown structure
  // Extract goals from ## Goals or similar headings
  // Extract user stories from ## User Stories
  // Detect platforms, compliance, tech stack keywords
  // Estimate tier based on detected complexity signals
  // Return structured ParsedPRD
}
```

- [ ] **Step 4: Run tests, verify pass**

- [ ] **Step 5: Commit** — `feat(build): add PRD parser with tier estimation`

---

## Task 3: `roster-composer` skill

**Files:**
- Create: `src/team-factory/roster-composer/SKILL.md`
- Create: `src/team-factory/roster-composer/scope-estimator.md`
- Create: `src/team-factory/roster-composer/split-trigger-rules.md`
- Create: `src/team-factory/roster-composer/continuous-expansion.md`
- Create: `build/skills/roster-composer.ts`
- Create: `tests/integration/roster-composer.test.ts`

- [ ] **Step 1: Write `SKILL.md`** documenting the composer's job: input = parsed PRD, output = archetype list with counts.

- [ ] **Step 2: Write `scope-estimator.md`** documenting the tier-assignment heuristics from §11.1.

- [ ] **Step 3: Write `split-trigger-rules.md`** from the research team-composition doc — when does Frontend split into iOS/Android/Web?

Content includes the trigger table from §7.5 and the research findings:

```markdown
## Role Split Triggers (from team-composition research)

| Generic role | Splits into | Trigger |
|---|---|---|
| Frontend | Web + iOS + Android | Product ships on ≥2 platforms |
| Full-Stack | Frontend + Backend specialists | ~200K LOC or 8+ engineers |
| DevOps | Platform + SRE + Release + Cloud | ≥3 stream teams sharing pipeline |
| Security | AppSec + InfraSec + Compliance | First SOC 2 audit |
| Data Engineer | Data + Analytics + Data Sci + ML | 50+ warehouse models |
| QA | Test Automation + Performance + A11y | Manual regression >2 days |
| Tech Writer | API Docs + Product Docs + DevRel | Public API + external growth channel |
| Product Designer | UX Researcher + IxD + Design System + Content | Design team >6 people |
| Engineering Manager | EM + Group EM + Director + VP | ~7 direct reports per layer |
| Backend Engineer | Service owner + API Platform + DB + Integrations | Service count >10 |
| Platform Engineer | Portal + CI + K8s + Mesh + Observability | Platform team >10 people |
| Incident Response | Dedicated Incident Commander | ≥1 SEV-1 per quarter |

## "Nobody owns it" heuristic

When a cross-cutting concern has no single owner AND is under-invested by every stream team, that concern becomes the next role to spawn.
```

- [ ] **Step 4: Write `continuous-expansion.md`** with the user-facing proposal flow from §7.5 step 2.

- [ ] **Step 5: Write `roster-composer.ts`**

```typescript
// build/skills/roster-composer.ts
import type { ParsedPRD } from "../lib/prd-parser.ts";

export interface RosterRecommendation {
  tier: "medium" | "large" | "enterprise";
  archetypes: string[];        // list of archetype names from src/team-factory/archetypes/
  rationale: Record<string, string>;  // per-archetype rationale
  splits_triggered: string[];  // which split-trigger rules fired
}

export function composeInitialRoster(prd: ParsedPRD): RosterRecommendation {
  // Start with the Medium-tier baseline: ~10 core archetypes
  const baseline = [
    "ingestion-pm",
    "user-handler",
    "scrum-master",
    "principal-architect",
    "frontend-engineer",
    "backend-engineer",
    "qa-lead",
    "security-engineer",
    "adversarial-reviewer",
    "code-reviewer",
    "refinement-builder",
  ];

  // Apply split triggers based on PRD signals
  const archetypes = new Set(baseline);
  const splits: string[] = [];

  if (prd.scope_hints.platforms.includes("ios")) {
    archetypes.add("mobile-ios-engineer");
    splits.push("platforms.ios → mobile-ios-engineer");
  }
  if (prd.scope_hints.platforms.includes("android")) {
    archetypes.add("mobile-android-engineer");
    splits.push("platforms.android → mobile-android-engineer");
  }
  if (prd.scope_hints.compliance.some((c) => ["hipaa", "soc2", "gdpr"].includes(c.toLowerCase()))) {
    archetypes.add("appsec-engineer");
    archetypes.add("privacy-officer");
    splits.push("compliance → appsec + privacy");
  }
  // ... additional split rules

  return {
    tier: prd.scope_hints.tier_estimate,
    archetypes: Array.from(archetypes),
    rationale: { /* ... */ },
    splits_triggered: splits,
  };
}

export function proposeMidSeasonExpansion(
  currentRoster: string[],
  gapSignal: string
): RosterRecommendation {
  // Given current roster and a gap signal (e.g., "task requires mobile iOS work"),
  // propose which archetype to add
  // Returns a single-archetype recommendation with rationale
}
```

- [ ] **Step 6: Write integration test with fixture PRDs**

```typescript
test("composer produces Medium-tier roster for simple SaaS PRD", () => {
  const prd = parsePRD(readFileSync("tests/fixtures/prds/medium-saas.md", "utf-8"));
  const roster = composeInitialRoster(prd);
  expect(roster.tier).toBe("medium");
  expect(roster.archetypes).toContain("ingestion-pm");
  expect(roster.archetypes.length).toBeGreaterThanOrEqual(10);
  expect(roster.archetypes.length).toBeLessThanOrEqual(15);
});

test("composer splits Frontend when PRD mentions iOS and Android", () => {
  const prd = parsePRD(readFileSync("tests/fixtures/prds/large-multi-platform.md", "utf-8"));
  const roster = composeInitialRoster(prd);
  expect(roster.archetypes).toContain("mobile-ios-engineer");
  expect(roster.archetypes).toContain("mobile-android-engineer");
  expect(roster.splits_triggered.length).toBeGreaterThan(0);
});
```

- [ ] **Step 7: Run tests, verify pass**

- [ ] **Step 8: Commit** — `feat(composer): add roster-composer skill with split-trigger rules`

---

## Task 4: `theme-engine` skill

**Files:**
- Create: `src/team-factory/theme-engine/SKILL.md`
- Create: `src/team-factory/theme-engine/mapping.md`
- Create: `src/team-factory/theme-engine/expansion.md`
- Create: `src/team-factory/theme-engine/synthesis.md` (stub, deferred to v1)
- Create: `build/skills/theme-engine.ts`
- Create: `build/lib/tag-matcher.ts`

- [ ] **Step 1: Author skill docs** explaining the archetype→character mapping and expansion fallback logic.

- [ ] **Step 2: Each theme's `role-mapping.yaml`** — add this file under `themes/tbbt/` and `themes/young-sheldon/`:

```yaml
# themes/tbbt/role-mapping.yaml
# Maps archetype names to preferred TBBT character(s)
# Primary character first; secondary characters are fallback picks

ingestion-pm:
  primary: penny
user-handler:
  primary: leonard-hofstadter
scrum-master:
  primary: mrs-davis
principal-architect:
  primary: sheldon-cooper
# ... all 43 archetypes
adversarial-reviewer:
  primary: wil-wheaton
developer-advocate:
  primary: wil-wheaton  # secondary of adversarial-reviewer
  note: "Wil Wheaton's canonical secondary role"
```

- [ ] **Step 3: Write `theme-engine.ts`**

```typescript
// build/skills/theme-engine.ts
import { readFileSync } from "node:fs";
import { load as yamlLoad } from "js-yaml";
import type { SkillTree } from "../lib/skill-parser.ts";

export interface MappedRoster {
  archetype_to_character: Record<string, string>;
  theme: string;
  secondary_assignments: Record<string, string[]>;
  expanded_from_themes: string[];  // which bundled themes contributed characters
  unmapped: string[];  // archetypes that couldn't be cast (should be empty in v0.1)
}

export function mapArchetypesToCharacters(
  archetypes: string[],
  themeName: string,
  tree: SkillTree
): MappedRoster {
  const theme = tree.themes[themeName];
  if (!theme) {
    throw new Error(`Unknown theme: ${themeName}`);
  }

  // Load role-mapping.yaml from theme
  const roleMappingPath = `${theme.path}/role-mapping.yaml`;
  const roleMapping = yamlLoad(readFileSync(roleMappingPath, "utf-8")) as Record<string, { primary: string }>;

  const result: MappedRoster = {
    archetype_to_character: {},
    theme: themeName,
    secondary_assignments: {},
    expanded_from_themes: [],
    unmapped: [],
  };

  for (const archetype of archetypes) {
    const mapping = roleMapping[archetype];
    if (mapping) {
      result.archetype_to_character[archetype] = mapping.primary;
    } else {
      // Try expansion to bundled themes
      // For v0.1, TBBT bundles young-sheldon
      const expanded = tryExpansion(archetype, themeName, tree);
      if (expanded) {
        result.archetype_to_character[archetype] = expanded.character;
        if (!result.expanded_from_themes.includes(expanded.theme)) {
          result.expanded_from_themes.push(expanded.theme);
        }
      } else {
        result.unmapped.push(archetype);
      }
    }
  }

  // Handle Wil Wheaton's secondary assignment
  if (archetypes.includes("adversarial-reviewer") && archetypes.includes("developer-advocate")) {
    result.secondary_assignments["wil-wheaton"] = ["developer-advocate"];
  }

  return result;
}

function tryExpansion(
  archetype: string,
  fromTheme: string,
  tree: SkillTree
): { character: string; theme: string } | null {
  // Load the theme's expansion config
  const theme = tree.themes[fromTheme];
  const themeYaml = yamlLoad(readFileSync(`${theme.path}/theme.yaml`, "utf-8")) as any;
  const bundledThemes = themeYaml.expansion?.bundled_themes ?? [];

  for (const neighborTheme of bundledThemes) {
    const neighbor = tree.themes[neighborTheme];
    if (!neighbor) continue;
    const mappingPath = `${neighbor.path}/role-mapping.yaml`;
    try {
      const mapping = yamlLoad(readFileSync(mappingPath, "utf-8")) as Record<string, { primary: string }>;
      if (mapping[archetype]) {
        return { character: mapping[archetype].primary, theme: neighborTheme };
      }
    } catch {
      continue;
    }
  }

  return null;
}
```

- [ ] **Step 4: Write `tag-matcher.ts`** (stub for v0.1; real similarity scoring in v0.5)

```typescript
// build/lib/tag-matcher.ts
// v0.1 STUB: real implementation ships in v0.5 per §13.10 Q8

export function scoreThemeSimilarity(themeA: string[], themeB: string[]): number {
  // Jaccard similarity on tag sets
  const setA = new Set(themeA);
  const setB = new Set(themeB);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

export function findBestNeighbor(
  currentThemeTags: string[],
  installedThemeTags: Record<string, string[]>,
  exclude: string[]
): string | null {
  let bestScore = 0;
  let bestTheme: string | null = null;
  for (const [name, tags] of Object.entries(installedThemeTags)) {
    if (exclude.includes(name)) continue;
    const score = scoreThemeSimilarity(currentThemeTags, tags);
    if (score > bestScore) {
      bestScore = score;
      bestTheme = name;
    }
  }
  return bestScore > 0.3 ? bestTheme : null;  // threshold
}
```

- [ ] **Step 5: Integration test**

```typescript
test("theme-engine maps full TBBT medium roster", () => {
  const tree = parseSkillTree("src/team-factory");
  const medium = ["ingestion-pm", "user-handler", "scrum-master", "principal-architect", /* ... */];
  const mapped = mapArchetypesToCharacters(medium, "tbbt", tree);
  expect(mapped.unmapped).toEqual([]);
  expect(mapped.archetype_to_character["ingestion-pm"]).toBe("penny");
  expect(mapped.archetype_to_character["user-handler"]).toBe("leonard-hofstadter");
});

test("theme-engine uses Young Sheldon for archetypes not in TBBT primary", () => {
  const tree = parseSkillTree("src/team-factory");
  const roster = ["ingestion-pm", "privacy-officer", "platform-engineer"];
  const mapped = mapArchetypesToCharacters(roster, "tbbt", tree);
  expect(mapped.expanded_from_themes).toContain("young-sheldon");
  expect(mapped.archetype_to_character["privacy-officer"]).toBe("meemaw");
});
```

- [ ] **Step 6: Commit** — `feat(theme-engine): add archetype→character mapping with Young Sheldon expansion`

---

## Task 5: Capability resolver

**Files:**
- Create: `build/skills/capability-resolver.ts`
- Create: `tests/integration/capability-resolver.test.ts`

- [ ] **Step 1: Write `capability-resolver.ts`**

```typescript
// build/skills/capability-resolver.ts
import { readFileSync } from "node:fs";
import { load as yamlLoad } from "js-yaml";

export interface BoundCapabilities {
  character: string;
  archetype: string;
  granted: string[];
  denied: string[];  // forbidden scopes per archetype.yaml
}

export function resolveCapabilities(
  mappedRoster: Record<string, string>,  // archetype → character
  matrixPath = "src/team-factory/capabilities/access-matrix.yaml"
): BoundCapabilities[] {
  const matrix = yamlLoad(readFileSync(matrixPath, "utf-8")) as Record<string, string[]>;
  const result: BoundCapabilities[] = [];

  for (const [archetype, character] of Object.entries(mappedRoster)) {
    const granted = matrix[archetype] ?? [];
    result.push({
      character,
      archetype,
      granted,
      denied: [],
    });
  }

  return result;
}
```

- [ ] **Step 2: Integration test**

```typescript
test("capability-resolver grants source-control:admin to user-handler", () => {
  const bound = resolveCapabilities({ "user-handler": "leonard-hofstadter" });
  const leonard = bound.find((b) => b.character === "leonard-hofstadter");
  expect(leonard?.granted).toContain("source-control:admin");
});

test("capability-resolver does not grant write access to ingestion-pm source-control", () => {
  const bound = resolveCapabilities({ "ingestion-pm": "penny" });
  const penny = bound.find((b) => b.character === "penny");
  expect(penny?.granted).toContain("source-control:read");
  expect(penny?.granted).not.toContain("source-control:write");
});
```

- [ ] **Step 3: Commit** — `feat(composer): add capability-resolver for RBAC binding`

---

## Task 6: End-to-end composition flow test

- [ ] **Step 1: Write E2E composition integration test**

```typescript
// tests/integration/composition-e2e.test.ts
import { test, expect } from "bun:test";
import { parsePRD } from "../../build/lib/prd-parser.ts";
import { composeInitialRoster } from "../../build/skills/roster-composer.ts";
import { mapArchetypesToCharacters } from "../../build/skills/theme-engine.ts";
import { resolveCapabilities } from "../../build/skills/capability-resolver.ts";
import { parseSkillTree } from "../../build/lib/skill-parser.ts";
import { readFileSync } from "node:fs";

test("E2E composition: PRD → roster → characters → capabilities", () => {
  // Step 1: Parse PRD
  const prd = parsePRD(readFileSync("tests/fixtures/prds/medium-saas.md", "utf-8"));

  // Step 2: Compose archetype roster
  const roster = composeInitialRoster(prd);
  expect(roster.archetypes.length).toBeGreaterThanOrEqual(10);

  // Step 3: Map to characters
  const tree = parseSkillTree("src/team-factory");
  const mapped = mapArchetypesToCharacters(roster.archetypes, "tbbt", tree);
  expect(mapped.unmapped).toEqual([]);

  // Step 4: Bind capabilities
  const bound = resolveCapabilities(mapped.archetype_to_character);
  expect(bound.length).toBe(roster.archetypes.length);

  // Every bound character has at least one capability
  for (const b of bound) {
    expect(b.granted.length).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 2: Run test**

```bash
bun test tests/integration/composition-e2e.test.ts
```
Expected: PASS. The full composition pipeline works end-to-end.

- [ ] **Step 3: Commit** — `test(integration): add E2E composition flow test`

---

## Task 7: Verification + tag

- [ ] **Step 1: Full test suite**
```bash
bun run lint
bun test
bun run build
bun run test:smoke
```
All green.

- [ ] **Step 2: Tag**
```bash
git tag -a plan-03-complete -m "Plan 03: Composition Engine complete"
```

---

## Plan 03 Complete

**What's shipped:**
- `capabilities/access-matrix.yaml` with RBAC scopes for all 43 archetypes
- PRD parser with tier estimation
- `roster-composer` skill with split-trigger rules
- `theme-engine` skill with archetype→character mapping + Young Sheldon expansion
- `capability-resolver` binding capabilities to characters
- End-to-end composition integration test

**What's next:** Plan 04 — OpenClaw Adapter (second build target).
