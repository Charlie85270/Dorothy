# The Development Flywheel

Every task cycle in factor-echelon makes the team smarter. This is the flywheel.

---

## The cycle

```
Task assigned
    |
    v
Character gets worktree
    |
    v
Implementation
    |
    v
6 parallel review gates
    |
    v
Refinement gate (sequential)
    |
    v
Leonard merges
    |
    v
Knowledge capture to mempalace
    |
    v
Next task (team is now better)
```

Each revolution captures new information:

1. **Task** -- Leonard assigns work to the right character based on archetype capabilities.
2. **Worktree** -- The character gets an isolated git worktree. No interference with other characters' work.
3. **Review gates** -- Six reviewers evaluate the work in parallel (architecture, code quality, QA, security, adversarial, UI). Each produces structured feedback and a 1-5 star rating.
4. **Refinement** -- Leslie Winkle (refinement-builder) addresses review feedback in a sequential pass.
5. **Merge** -- Leonard verifies gate approvals and merges. No character merges their own work.
6. **Knowledge capture** -- On merge, the system writes to mempalace: what was built, what reviewers flagged, what patterns emerged, what decisions were made.
7. **Next task** -- Before the next task starts, the assigned character queries mempalace for relevant context. They start with the accumulated knowledge of every previous cycle.

---

## What accumulates

| Hall | What gets stored | How it helps |
|---|---|---|
| **learnings** | Mistakes caught in review, fixes applied | Characters avoid repeating errors |
| **patterns** | Reusable code patterns, architectural decisions | Faster implementation with proven approaches |
| **decisions** | Design choices and their rationale | Consistent architecture across the project |
| **reviews** | Gate feedback, ratings, recurring issues | Review quality improves; known-good patterns get fast-tracked |
| **skills** | Autonomously created skills (promoted via Counselor) | Team gains new capabilities over time |
| **counselor-verdicts** | Multi-model council decisions | Precedent for future high-stakes reviews |

---

## Why it compounds

A team on its first task has zero context. By task 10, the knowledge base contains dozens of patterns, decisions, and lessons learned. By task 50, the team has built institutional memory that rivals a human team with months of shared experience.

The flywheel also drives **roster expansion**. As the knowledge base grows, the system detects capability gaps -- "we keep making security mistakes but have no security-engineer" -- and Penny proposes adding the right archetype.

Cross-season learning is selective: the advisory board and Counselor verdicts are shared globally, but season-specific learnings stay scoped to their season. This prevents context pollution while preserving high-value institutional knowledge.

---

## See also

- [Knowledge Base](knowledge-base.md) -- how mempalace stores the flywheel's output
- [Safety Nets](safety-nets.md) -- the review gates that feed the flywheel
- [Seasons](seasons.md) -- how flywheel data is scoped per project
