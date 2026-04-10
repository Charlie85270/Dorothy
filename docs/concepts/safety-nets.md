# Safety Architecture

factor-echelon enforces quality through multiple overlapping safety nets. No single gate is a bottleneck -- they work in concert.

---

## 1. Seven review gates

Every task passes through 7 review gates before merging:

| Gate | Reviewer archetype | Runs | Focus |
|---|---|---|---|
| **Architecture** | principal-architect | Parallel | Structural integrity, dependency rules, invariants |
| **Code quality** | code-reviewer | Parallel | Style, correctness, maintainability |
| **QA** | qa-lead | Parallel | Test coverage, edge cases, regression risk |
| **Security** | security-engineer | Parallel | Vulnerabilities, auth, data exposure |
| **Adversarial** | adversarial-reviewer | Parallel | Stress-testing assumptions, devil's advocate |
| **UI** | ux-designer | Parallel | Usability, accessibility, visual consistency |
| **Refinement** | refinement-builder | Sequential | Addresses feedback from the 6 parallel gates |

The first 6 gates run concurrently. Refinement runs after, incorporating their feedback. Each gate produces a structured review with a 1-5 star rating. A task needs majority approval to proceed to merge.

---

## 2. Counselor multi-model oversight

The Counselor provides a second layer of oversight at four high-leverage decision points:

- **Placement A (Skill Promotion):** When a character proposes a new autonomous skill, the 4-model council evaluates it. Requires a minimum consensus score to promote.
- **Placement B (Design Review):** Major architectural decisions are reviewed by all four models. Requires majority approval.
- **Placement C (Deadlock Escalation):** When characters disagree and cannot resolve internally, the Counselor breaks the deadlock with a binding majority vote.
- **Placement D (High-Risk Adversarial):** Changes flagged as high-risk get full adversarial review from all four models. Requires majority approval.

The Counselor uses four independent models (Gemini, GPT-5, Claude Opus 4.6, Grok) specifically to prevent single-model bias.

---

## 3. Bounce counter with escalation

If a task fails review gates repeatedly, the bounce counter tracks rejections. After a configurable threshold (default: 3 bounces), the task escalates -- first to the principal architect for intervention, then to the Counselor (Placement C) if the impasse continues. This prevents infinite review loops.

---

## 4. Audit logging

Every significant action is logged: task assignments, gate results, merge decisions, Counselor invocations, skill promotions, and knowledge captures. The audit trail is stored alongside the season data and is never silently deleted.

---

## 5. Cross-season isolation

Each season runs in its own workspace. Characters, worktrees, and knowledge base wings are scoped to the season. One season's failures cannot contaminate another. The only shared resources are the advisory board and Counselor verdicts, which are read-only from a season's perspective.

---

## 6. Merge authority

No character merges their own code. All merges are serialized through Leonard (the User Handler). This creates a single chokepoint where quality enforcement is absolute -- even if every gate somehow fails, Leonard still reviews before merging.

---

## 7. Uninstall with KB export

factor-echelon can be fully uninstalled. Before removal, the system offers a knowledge base export (tar.gz) so no accumulated learnings are lost. Uninstall removes all season data, worktrees, advisory board state, and configuration. Clean exit, no orphans.

---

## See also

- [The Flywheel](the-flywheel.md) -- how safety gates feed continuous improvement
- [The Counselor](counselor.md) -- multi-model review council details
- [Worktree Execution](worktree-execution.md) -- how isolation prevents cross-contamination
