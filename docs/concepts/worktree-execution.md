# Worktree Execution Model

Every character works in an isolated git worktree. This enables parallel development without merge conflicts and provides a clean boundary for review gates.

---

## How it works

When a character receives a task:

1. **Worktree creation** -- A new git worktree is created from the season's main branch. The worktree path is `<season>/worktrees/<character>-<task-id>/`.
2. **Task branch** -- The character works on a dedicated branch (`task/<character>/<task-slug>`). All changes are committed to this branch.
3. **Implementation** -- The character implements the task in their isolated worktree. No other character can modify files in this worktree.
4. **Review submission** -- When done, the character submits the task branch for review. Six gates run in parallel, followed by the Refinement gate.
5. **Merge** -- If approved, Leonard (User Handler / merge authority) merges the task branch back to the season's main branch.
6. **Cleanup** -- The worktree is removed after successful merge.

---

## Concurrency limits

| Constraint | Limit | Rationale |
|---|---|---|
| Max worktrees per season | 10 | Prevents resource exhaustion on the host machine |
| Max concurrent tasks per character | 1 | Characters focus on one task at a time for quality |
| Merge serialization | 1 at a time | Leonard merges sequentially to prevent conflicts |

If all 10 worktree slots are occupied, new tasks queue until a slot opens. The queue is FIFO with priority overrides for critical-path tasks.

---

## Review gate flow

```
Character submits task branch
          |
   +------+------+------+------+------+
   |      |      |      |      |      |
  Arch   Code    QA    Sec   Adv    UI     (6 parallel gates)
   |      |      |      |      |      |
   +------+------+------+------+------+
          |
     Refinement                            (sequential)
          |
     Leonard merges                        (serialized)
```

Each parallel gate reviewer checks out the task branch in a read-only context (no worktree needed -- they review the diff). Refinement gets its own worktree to apply fixes.

---

## Orphan cleanup

Worktrees that remain after a task completes, a character is removed, or a season is archived are considered orphans. The system runs automatic cleanup:

- **7-day grace period** -- Orphan worktrees are flagged but not deleted for 7 days, in case the task is retried or the season is restored.
- **After 7 days** -- Orphan worktrees are deleted and their branches are pruned from the local repository.
- **Season archive** -- All worktrees are cleaned up immediately when a season is archived.

---

## Conflict resolution

Because merges are serialized through Leonard, conflicts are rare. When they occur:

1. Leonard detects the conflict during merge.
2. The task is bounced back to the assigned character with conflict details.
3. The character resolves conflicts in their worktree and resubmits.
4. The bounce counter increments. After 3 bounces, the task escalates to the principal architect.

---

## See also

- [Seasons](seasons.md) -- the container that owns worktrees
- [Safety Nets](safety-nets.md) -- review gates and bounce escalation
- [Architecture](architecture.md) -- where worktrees fit in the runtime layer
