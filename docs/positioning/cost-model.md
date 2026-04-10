# Cost Model

factor-echelon runs on the user's machine using their own API keys. There are no subscription fees, no hosted services, and no per-seat charges. Costs come from three sources, two of which are free.

---

## Cost breakdown

### 1. Counselor invocations (the only real cost)

The Counselor makes 4 API calls per invocation (one per model). Estimated cost per invocation:

| Model | Provider | Cost per call (est.) |
|---|---|---|
| Gemini Pro | Google AI Studio | ~$0.01 |
| GPT-5 | OpenAI | ~$0.05-0.075 |
| Claude Opus 4.6 | Anthropic | ~$0.05-0.075 |
| Grok | xAI | ~$0.01-0.02 |
| **Total per invocation** | | **~$0.12-0.17** |

The Counselor is invoked only at four high-leverage decision points (skill promotion, design review, deadlock escalation, high-risk adversarial review). It does not run on every task.

**Typical usage per season:**
| Project size | Counselor invocations | Estimated cost |
|---|---|---|
| Small (20 tasks) | 2-3 | $0.24-0.51 |
| Medium (50 tasks) | 5-10 | $0.60-1.70 |
| Large (100+ tasks) | 10-20 | $1.20-3.40 |

A built-in budget tracker limits monthly Counselor spend (default cap: $50). The system warns before exceeding the cap and falls back to single-model review if the budget is exhausted.

### 2. mempalace storage (free)

The knowledge base runs locally in solo mode (v0.1):
- Markdown files committed to a local git repository
- Full-text indexing via mempalace's built-in engine
- No cloud services, no storage fees
- Disk usage: typically 10-50 MB per season depending on project size

Team mode (v0.5) will add an Azure-backed centralized store with its own cost structure (not yet defined).

### 3. Compute (free -- user's machine)

factor-echelon runs entirely on the user's machine:
- Bun runtime (TypeScript)
- Git worktrees (local disk)
- No GPU required
- No Docker required (Docker is optional for projects that use it, not for factor-echelon itself)

---

## Comparison to alternatives

| Approach | Monthly cost | Availability |
|---|---|---|
| 16-person engineering team | ~$300,000+ | Business hours, PTO, turnover |
| AI coding assistant (single agent) | $20-100/seat | On demand, no team dynamics |
| factor-echelon (full team) | $1-5 in API costs | 24/7, persistent memory, growing skills |

factor-echelon is not a replacement for a human engineering team -- it is a force multiplier. A single developer with a factor-echelon team can operate at the throughput of a small team with consistent quality enforcement and institutional memory.

---

## Cost controls

- **Budget tracker:** Built-in monthly limit (configurable, default $50). Warns at 80%, pauses Counselor at 100%.
- **Optional Counselor:** All four API keys are optional. The team works without the Counselor -- you just lose multi-model oversight at high-stakes decisions.
- **Per-model opt-out:** If one model is too expensive, remove its API key. Consensus rules adjust to available models (minimum 3 for Placements B/C/D, all 4 required for Placement A).
- **No hidden costs:** No telemetry, no phoning home, no cloud dependencies in v0.1.

---

## See also

- [The Counselor](../concepts/counselor.md) -- what triggers invocations
- [Architecture](../concepts/architecture.md) -- what runs locally vs. what calls APIs
- [Executive Summary](executive-summary.md) -- the value proposition
