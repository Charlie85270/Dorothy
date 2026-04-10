# The Counselor

The Counselor is a multi-model review council that provides oversight at high-leverage decision points. It exists specifically to prevent single-model bias -- no one AI model reviews its own team's critical decisions.

---

## The four models

| Model | Provider | Role |
|---|---|---|
| **Gemini Pro** | Google | Broad reasoning, alternative perspectives |
| **GPT-5** | OpenAI | Structured analysis, edge case identification |
| **Claude Opus 4.6** | Anthropic | Deep reasoning, nuanced trade-off evaluation |
| **Grok** | xAI | Contrarian perspective, unconventional insights |

Each model receives the same prompt context and responds independently. Their responses are aggregated according to placement-specific consensus rules.

---

## Four placements

### Placement A: Skill Promotion
**Trigger:** A character proposes a new autonomous skill for the team.
**Consensus rule:** Minimum score threshold. All four models score the proposed skill on utility, safety, and scope. The skill is promoted only if the average score exceeds the configured minimum. All 4 models must respond (conservative by design -- skill promotion is a one-way door).
**Why it matters:** Autonomous skills expand what the team can do without human approval. The bar must be high.

### Placement B: Design Review
**Trigger:** A major architectural decision is proposed (detected by the principal-architect or flagged by a character).
**Consensus rule:** Majority approval (3 of 4 models must score >= 4). Allows one dissenter.
**Why it matters:** Architectural mistakes compound. Multi-model review catches assumptions that a single model's training biases would miss.

### Placement C: Deadlock Escalation
**Trigger:** Two or more characters disagree on an approach and internal resolution fails (bounce counter hits 5).
**Consensus rule:** Binding majority. The majority position becomes the decision, with full reasoning preserved in the KB.
**Why it matters:** Deadlocks block progress. The Counselor breaks them with a broader perspective than any individual character.

### Placement D: High-Risk Adversarial
**Trigger:** A change is flagged as high-risk (e.g., Wil Wheaton rates a security PR at 3 stars or below).
**Consensus rule:** Majority approval required (3 of 4). All four models perform adversarial analysis.
**Why it matters:** High-risk changes (auth, data handling, external integrations) need the strongest review. Four models catch more than one.

---

## The Convener pattern

Each theme designates a **convener character** who initiates Counselor invocations:

| Theme | Convener | Character |
|---|---|---|
| TBBT | Stephen Hawking | Advisory board member |
| Star Wars | Yoda | Advisory board member |

The convener does not vote -- they frame the question, gather context, dispatch the 4 model calls in parallel, and write the verdict to the KB's `counselor-verdicts` hall. The convener is theme-appropriate but the models themselves are theme-agnostic.

---

## Failure tolerance

- Placements B/C/D proceed with 3 of 4 models responding. If only 2 respond, the invocation is retried once before falling back to the available models.
- Placement A requires all 4 models (conservative by design -- skill promotion is a one-way door).
- A budget tracker limits monthly spend across all Counselor invocations.

---

## Cost

Each Counselor invocation makes 4 API calls (one per model). Estimated cost per invocation:

| Model | Cost per call |
|---|---|
| Gemini Pro | ~$0.01 |
| GPT-5 | ~$0.05-0.075 |
| Opus 4.6 | ~$0.05-0.075 |
| Grok | ~$0.01-0.02 |

Total per invocation: approximately $0.12-0.17. The Counselor is invoked only at high-leverage moments, not on every task -- typical projects see 2-5 invocations per season.

---

## Configuration

Counselor API keys are set during OOBE or in `~/.factor-echelon/config/counselor.yaml`. All four keys are optional -- if a model key is missing, that model is skipped and consensus rules adjust to the available models. The team works without any Counselor keys; you just lose multi-model oversight.

---

## See also

- [Safety Nets](safety-nets.md) -- how the Counselor fits into the safety architecture
- [Knowledge Base](knowledge-base.md) -- where Counselor verdicts are stored
- [Architecture](architecture.md) -- the cross-cutting layer
