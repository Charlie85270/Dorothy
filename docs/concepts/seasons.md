# Seasons

A **season** is a single project engagement in factor-echelon. It is the primary unit of isolation, scoping, and lifecycle management.

---

## What a season contains

Each season is a self-contained workspace with:

- **A themed character roster** -- the team Penny composed for this project, drawn from the active theme.
- **Its own git worktrees** -- up to 10 concurrent worktrees for parallel character work.
- **A knowledge base wing** -- all learnings, patterns, decisions, and reviews scoped to this season.
- **A season manifest** (`season.yaml`) -- metadata including the source PRD, theme, tier, character list, and creation timestamp.
- **Communication channels** -- inter-character messaging scoped to this season.

---

## Season lifecycle

```
spawn  -->  active  -->  archive  -->  restore (optional)
```

### Spawn
Penny reads the PRD, estimates scope, selects archetypes, casts themed characters, creates the workspace, and hands off to Leonard. This is the OOBE flow for a new project.

### Active
The team is working. Characters take tasks, create worktrees, go through review gates, merge, and capture knowledge. Mid-season expansion can add new characters as needs emerge.

### Archive
When a project completes (or is paused), the season is archived. Worktrees are cleaned up, the knowledge base wing is preserved, and the season directory moves to `seasons/_archive/`. Archived seasons consume minimal disk space.

### Restore
An archived season can be restored to active status. Characters are re-instantiated, the knowledge base wing becomes writable again, and work resumes where it left off. Theme and roster are preserved exactly.

---

## Multi-season operation

Multiple seasons can run concurrently. Each is fully isolated:

| Resource | Scoping |
|---|---|
| Characters | Per-season (separate instances even if same archetype) |
| Worktrees | Per-season (independent git worktree sets) |
| Knowledge base | Per-season wing (own halls and rooms) |
| Advisory board | Shared globally (read-only from season perspective) |
| Counselor verdicts | Shared globally (precedent applies across seasons) |

A developer might run a "TaskFlow SaaS" season and a "Landing Page" season simultaneously. The teams never interfere with each other, but both can consult the same advisory board.

---

## Season storage layout

```
~/.factor-echelon/
  seasons/
    season-001-taskflow/
      season.yaml
      characters/
      worktrees/
      kb/
    season-002-landing/
      ...
    _archive/
      season-000-prototype/
        ...
  advisory-board/
  config/
```

---

## See also

- [Architecture](architecture.md) -- where seasons fit in the runtime layer
- [Worktree Execution](worktree-execution.md) -- how characters work within a season
- [Knowledge Base](knowledge-base.md) -- how learnings are scoped per season
