# Plan 08: The Counselor + Advisory Board Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Ship the Counselor multi-model council (4 models × 4 placements) and the Advisory Board consultation protocol. After this plan, characters can invoke the Counselor for Skill Promotion, Design Review, Deadlock Escalation, and High-Risk Adversarial sidecar, and any character can query the Advisory Board's 12 SMEs.

**Architecture:** Counselor is a cross-cutting capability. Invocations go through a convener character (Stephen Hawking for TBBT, Yoda for Star Wars). The convener assembles a prompt from placement-specific templates, dispatches four parallel model calls (Gemini Pro, GPT-5, Claude Opus 4.6, Grok), applies placement-specific consensus, writes the verdict to mempalace.

**Tech Stack:** Bun + TypeScript. Model API clients: `@google/generative-ai`, `openai`, `@anthropic-ai/sdk`, `openai` (Grok uses OpenAI-compatible API). API keys from OS keychain (Plan 07).

**Spec reference:** §5.3 Counselor layer, §13 The Counselor (all 10 subsections), §13.9 phasing (all 4 placements in v0.1), §11.2 advisory board.

**Dependencies:** Plans 01-07 complete.

---

## File Structure

```
src/team-factory/
├── counselor/
│   ├── SKILL.md                          # top-level invocation protocol
│   ├── models.yaml                       # Gemini Pro, GPT-5, Opus 4.6, Grok config
│   ├── consensus-rules.yaml              # per-placement consensus algorithms
│   ├── conveners-per-theme.yaml          # TBBT=Hawking, SW=Yoda
│   └── placements/
│       ├── A-skill-promotion.md
│       ├── B-design-review.md
│       ├── C-deadlock-escalation.md
│       └── D-high-risk-adversarial.md
│
└── advisory-board/                       # from Plan 02 content
    ├── SKILL.md                          # already exists from Plan 02
    └── consultation-protocol.md          # already exists from Plan 02

build/
├── counselor/
│   ├── counselor.ts                      # main dispatcher
│   ├── models/
│   │   ├── gemini.ts
│   │   ├── gpt5.ts
│   │   ├── opus.ts
│   │   └── grok.ts
│   ├── consensus.ts                      # min-score, majority, weighted
│   ├── placements/
│   │   ├── skill-promotion.ts
│   │   ├── design-review.ts
│   │   ├── deadlock-escalation.ts
│   │   └── high-risk-adversarial.ts
│   └── budget-tracker.ts                 # cost budgeting
│
└── advisory-board/
    ├── consultation.ts                   # SME query dispatch
    └── sme-router.ts                     # which SME to consult for which domain

tests/
└── integration/
    ├── counselor-placement-A.test.ts
    ├── counselor-placement-B.test.ts
    ├── counselor-placement-C.test.ts
    ├── counselor-placement-D.test.ts
    ├── counselor-failure-modes.test.ts
    └── advisory-board-consultation.test.ts
```

---

## Task 1: Counselor skill docs + config files

- [ ] **Step 1: Write `src/team-factory/counselor/SKILL.md`** — invocation protocol overview, references to placement docs.

- [ ] **Step 2: Write `models.yaml`**

```yaml
# counselor/models.yaml — the four models of the council
# v0.1 pinned versions; user can swap via `factor-echelon counselor config`

models:
  gemini:
    provider: "google"
    model: "gemini-2.5-pro-latest"
    client: "gemini.ts"
    lineage: "gemini-family"

  gpt5:
    provider: "openai"
    model: "gpt-5-2026-04-01"  # pin to specific release
    client: "gpt5.ts"
    lineage: "gpt-family"

  opus:
    provider: "anthropic"
    model: "claude-opus-4-6"
    client: "opus.ts"
    lineage: "claude-family"

  grok:
    provider: "xai"
    model: "grok-3-latest"
    client: "grok.ts"
    lineage: "grok-family"
```

- [ ] **Step 3: Write `consensus-rules.yaml`**

```yaml
# counselor/consensus-rules.yaml
# Per-placement consensus algorithms

placements:
  A-skill-promotion:
    algorithm: "min-score"
    approval_threshold: 4  # on 5-star scale
    models_required: 4     # all 4 must respond
    rationale: "Skill promotion is a one-way door; conservative by design"

  B-design-review:
    algorithm: "majority"
    approval_threshold: 3  # 3 of 4 must give ≥4 stars
    models_required: 3     # 3 of 4 required to proceed if one is down
    rationale: "Allow one dissenting voice (e.g., Grok contrarian)"

  C-deadlock-escalation:
    algorithm: "majority"
    binding: true          # verdict becomes the decision
    models_required: 3
    rationale: "Tie-breaker, not approval gate"

  D-high-risk-adversarial:
    algorithm: "majority"
    approval_threshold: 3
    models_required: 3
    rationale: "Sidecar to Wil Wheaton; supplements his rating"
```

- [ ] **Step 4: Write `conveners-per-theme.yaml`**

```yaml
# counselor/conveners-per-theme.yaml
# Each theme designates a convener character who initiates Counselor invocations

tbbt:
  convener: "stephen-hawking"
  rationale: "Canonical escalation oracle, already cast as Skill Promotion Reviewer"

star-wars:
  convener: "yoda"
  rationale: "Grand Master of the Jedi Order, advisory emeritus"

# Custom themes must designate a sage character at theme creation time
```

- [ ] **Step 5: Write the 4 placement docs** under `counselor/placements/` — for each placement, document the trigger condition, prompt template, and expected output format.

- [ ] **Step 6: Commit** — `feat(counselor): add skill docs + models/consensus/conveners config`

---

## Task 2: Model clients

**Files:**
- Create: `build/counselor/models/gemini.ts`
- Create: `build/counselor/models/gpt5.ts`
- Create: `build/counselor/models/opus.ts`
- Create: `build/counselor/models/grok.ts`

- [ ] **Step 1: Define the common client interface**

```typescript
// build/counselor/models/types.ts
export interface ModelRequest {
  system: string;
  user: string;
  temperature: number;
  max_tokens: number;
}

export interface ModelResponse {
  content: string;
  model: string;
  tokens_used: number;
  rating?: number;  // 1-5 if the placement asked for a rating
  duration_ms: number;
}

export interface ModelClient {
  name: string;
  lineage: string;
  invoke(request: ModelRequest): Promise<ModelResponse>;
  health(): Promise<boolean>;
}
```

- [ ] **Step 2: Write each model client** (4 files)

Each client:
1. Reads API key from OS keychain via Plan 07's `keychain.ts`
2. Makes the API call with a 120s per-model timeout
3. Parses response, extracts rating if placement asked for one
4. Returns `ModelResponse`
5. On failure, throws with clear error

- [ ] **Step 3: Unit tests for each client** — mock the API, verify request format and response parsing.

- [ ] **Step 4: Commit** — `feat(counselor): add 4 model clients (Gemini, GPT-5, Opus, Grok)`

---

## Task 3: Consensus algorithms

**Files:**
- Create: `build/counselor/consensus.ts`

- [ ] **Step 1: Write failing tests**

```typescript
test("min-score consensus picks lowest rating", () => {
  const result = computeConsensus([
    { rating: 5, model: "gemini" },
    { rating: 4, model: "gpt5" },
    { rating: 3, model: "opus" },
    { rating: 5, model: "grok" },
  ], "min-score");
  expect(result.final_rating).toBe(3);
  expect(result.approved).toBe(false);  // threshold is 4
});

test("majority consensus requires 3 of 4 at threshold", () => {
  const result = computeConsensus([
    { rating: 5, model: "gemini" },
    { rating: 4, model: "gpt5" },
    { rating: 2, model: "opus" },
    { rating: 4, model: "grok" },
  ], "majority", { threshold: 4 });
  expect(result.approved).toBe(true);  // 3 of 4 at ≥4
});

test("majority: 2 of 4 at threshold is NOT approved", () => {
  const result = computeConsensus([
    { rating: 4, model: "gemini" },
    { rating: 4, model: "gpt5" },
    { rating: 2, model: "opus" },
    { rating: 3, model: "grok" },
  ], "majority", { threshold: 4 });
  expect(result.approved).toBe(false);
});
```

- [ ] **Step 2: Write `consensus.ts`**

```typescript
export interface ModelRating {
  rating: number;
  model: string;
  notes?: string;
}

export interface ConsensusResult {
  approved: boolean;
  final_rating: number;
  algorithm: string;
  per_model: ModelRating[];
  stdev: number;  // for disagreement tracking
  notes: string;
}

export function computeConsensus(
  ratings: ModelRating[],
  algorithm: "min-score" | "majority" | "weighted-average",
  options: { threshold?: number; weights?: Record<string, number> } = {}
): ConsensusResult {
  const threshold = options.threshold ?? 4;

  if (algorithm === "min-score") {
    const min = Math.min(...ratings.map((r) => r.rating));
    return {
      approved: min >= threshold,
      final_rating: min,
      algorithm,
      per_model: ratings,
      stdev: computeStdev(ratings.map((r) => r.rating)),
      notes: `min-score: ${min}`,
    };
  }

  if (algorithm === "majority") {
    const passing = ratings.filter((r) => r.rating >= threshold).length;
    const approved = passing >= Math.ceil(ratings.length / 2) + (ratings.length > 3 ? 0 : 0);
    // strict majority: >50% — for 4 models, need 3+
    const actualMajorityNeeded = Math.floor(ratings.length / 2) + 1;
    return {
      approved: passing >= actualMajorityNeeded,
      final_rating: average(ratings.map((r) => r.rating)),
      algorithm,
      per_model: ratings,
      stdev: computeStdev(ratings.map((r) => r.rating)),
      notes: `${passing}/${ratings.length} at ≥${threshold}`,
    };
  }

  throw new Error(`Unsupported algorithm: ${algorithm}`);
}

function computeStdev(nums: number[]): number { /* std deviation */ }
function average(nums: number[]): number { return nums.reduce((a, b) => a + b, 0) / nums.length; }
```

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit** — `feat(counselor): add consensus algorithms (min-score + majority)`

---

## Task 4: Counselor dispatcher

**Files:**
- Create: `build/counselor/counselor.ts`
- Create: `build/counselor/budget-tracker.ts`

- [ ] **Step 1: Write `counselor.ts`** — main dispatcher

```typescript
// build/counselor/counselor.ts
import type { ModelClient, ModelRequest, ModelResponse } from "./models/types.ts";
import { GeminiClient } from "./models/gemini.ts";
import { GPT5Client } from "./models/gpt5.ts";
import { OpusClient } from "./models/opus.ts";
import { GrokClient } from "./models/grok.ts";
import { computeConsensus, type ConsensusResult, type ModelRating } from "./consensus.ts";

export type PlacementId = "A" | "B" | "C" | "D";

export interface CounselorInvocation {
  placement: PlacementId;
  convener: string;  // character name, e.g., "stephen-hawking"
  prompt_context: {
    system: string;
    user: string;
  };
  season_id?: string;
}

export interface CounselorVerdict {
  placement: PlacementId;
  consensus: ConsensusResult;
  per_model_responses: ModelResponse[];
  duration_ms: number;
  timestamp: Date;
}

const PER_MODEL_TIMEOUT_MS = 120_000;
const GLOBAL_TIMEOUT_MS = 300_000;

export class Counselor {
  constructor(private readonly clients: ModelClient[]) {}

  static defaultInstance(): Counselor {
    return new Counselor([new GeminiClient(), new GPT5Client(), new OpusClient(), new GrokClient()]);
  }

  async invoke(invocation: CounselorInvocation): Promise<CounselorVerdict> {
    const start = Date.now();

    // Fire all 4 models in parallel
    const request: ModelRequest = {
      system: invocation.prompt_context.system,
      user: invocation.prompt_context.user,
      temperature: 0.3,
      max_tokens: 2000,
    };

    const responses = await Promise.allSettled(
      this.clients.map((c) => withTimeout(c.invoke(request), PER_MODEL_TIMEOUT_MS))
    );

    const successful: ModelResponse[] = [];
    for (const [i, r] of responses.entries()) {
      if (r.status === "fulfilled") {
        successful.push(r.value);
      } else {
        console.warn(`[counselor] model ${this.clients[i].name} failed: ${r.reason}`);
      }
    }

    if (successful.length < 3) {
      throw new Error(`Counselor unavailable: only ${successful.length} of 4 models responded`);
    }

    // Apply consensus based on placement
    const ratings: ModelRating[] = successful.map((r) => ({
      rating: r.rating ?? 0,
      model: r.model,
    }));

    const algorithm = invocation.placement === "A" ? "min-score" : "majority";
    const consensus = computeConsensus(ratings, algorithm, { threshold: 4 });

    return {
      placement: invocation.placement,
      consensus,
      per_model_responses: successful,
      duration_ms: Date.now() - start,
      timestamp: new Date(),
    };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}
```

- [ ] **Step 2: Write `budget-tracker.ts`** — per-month cost tracking

- [ ] **Step 3: Commit** — `feat(counselor): add dispatcher with parallel model invocation + budget tracking`

---

## Task 5: Placement implementations

**Files:**
- Create: `build/counselor/placements/skill-promotion.ts`
- Create: `build/counselor/placements/design-review.ts`
- Create: `build/counselor/placements/deadlock-escalation.ts`
- Create: `build/counselor/placements/high-risk-adversarial.ts`

- [ ] **Step 1: For each placement**, write a module that:
  - Takes placement-specific input (skill candidate / spec document / stuck task / PR diff)
  - Loads the placement prompt template from `src/team-factory/counselor/placements/<file>.md`
  - Builds the prompt context
  - Calls `counselor.invoke()`
  - Writes the verdict to mempalace
  - Returns the verdict

- [ ] **Step 2: Commit in batches of 2**
  - Commit A+B: `feat(counselor): add Placement A (skill promotion) and B (design review)`
  - Commit C+D: `feat(counselor): add Placement C (deadlock escalation) and D (high-risk adversarial)`

---

## Task 6: Placement integration tests

- [ ] **Step 1: Test each placement** with mock model clients that return deterministic responses

- [ ] **Step 2: Test failure modes**
  - One model unavailable → proceed with 3 of 4
  - Two models unavailable → abort
  - High-disagreement stdev → logged but proceeds
  - Placement A's dead-code warning (skills from first season only) → correctly reports "no candidates yet"

- [ ] **Step 3: Commit** — `test(counselor): add per-placement integration tests + failure modes`

---

## Task 7: Advisory Board consultation

**Files:**
- Create: `build/advisory-board/consultation.ts`
- Create: `build/advisory-board/sme-router.ts`

- [ ] **Step 1: Write `sme-router.ts`** — given a query topic, pick the right SME

```typescript
const SME_DOMAINS: Record<string, string[]> = {
  "brian-greene": ["model-providers", "openai", "anthropic", "google", "meta", "mistral"],
  "ira-flatow": ["azure-ai", "bedrock", "vertex-ai", "databricks", "enterprise-ai"],
  "stan-lee": ["langchain", "langgraph", "crewai", "semantic-kernel", "orchestration"],
  "tam-nguyen": ["node", "fastapi", "nestjs", "django", "backend-api"],
  "levar-burton": ["pinecone", "weaviate", "milvus", "qdrant", "pgvector", "vector-db"],
  "james-earl-jones": ["temporal", "airflow", "prefect", "n8n", "event-orchestration"],
  "george-smoot": ["snowflake", "bigquery", "redshift", "clickhouse", "data-analytics"],
  "nathan-fillion": ["auth0", "okta", "keycloak", "auth", "identity"],
  "buzz-aldrin": ["kubernetes", "docker", "terraform", "infrastructure"],
  "bill-nye": ["build-vs-buy", "tco", "vendor-eval", "product-integration"],
  "arthur-jeffries": ["research", "documentation", "web-search", "sources"],
  "stephen-hawking": ["escalation", "skill-promotion"],  // standalone
};

export function routeQuery(query: string, queryTags: string[]): string[] {
  // Return ranked list of SMEs most relevant to the query
  // v0.1: simple keyword matching; v0.5: semantic routing
}
```

- [ ] **Step 2: Write `consultation.ts`** — dispatches a query to one or more SMEs

```typescript
export interface ConsultationRequest {
  query: string;
  tags: string[];
  season_id?: string;
  requester_character: string;
}

export interface ConsultationResponse {
  sme: string;
  response: string;
  sources: string[];
  duration_ms: number;
}

export async function consultAdvisoryBoard(
  request: ConsultationRequest
): Promise<ConsultationResponse[]> {
  const smes = routeQuery(request.query, request.tags);
  // For each SME, invoke its consultation protocol
  // Write consultation to mempalace (logged for future retrieval)
  // Return all responses
}
```

- [ ] **Step 3: Integration test**

```typescript
test("E2E: request to 'which vector DB should we use' routes to LeVar Burton", async () => {
  const responses = await consultAdvisoryBoard({
    query: "which vector database should we use for semantic search",
    tags: ["vector-db", "semantic-search"],
    requester_character: "sheldon-cooper",
  });
  expect(responses.length).toBeGreaterThan(0);
  expect(responses[0].sme).toBe("levar-burton");
});
```

- [ ] **Step 4: Commit** — `feat(advisory-board): add SME router and consultation dispatcher`

---

## Task 8: Verification + tag

- [ ] **Step 1:** Full test run
- [ ] **Step 2:** Tag `plan-08-complete`

---

## Plan 08 Complete

**What's shipped:**
- Counselor skill docs + models/consensus/conveners config
- 4 model clients (Gemini, GPT-5, Opus, Grok) with OS keychain integration
- Consensus algorithms (min-score, majority) with stdev tracking
- Counselor dispatcher with parallel model invocation + failure tolerance
- Budget tracker for per-month cost limits
- All 4 placement implementations (A Skill Promotion, B Design Review, C Deadlock Escalation, D High-Risk Adversarial)
- Advisory Board SME router and consultation dispatcher
- Per-placement integration tests + failure mode tests

**What's next:** Plan 09 — User Intervention + Multi-Season operation.
