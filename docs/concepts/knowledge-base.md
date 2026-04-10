# Knowledge Base

factor-echelon uses [mempalace](https://github.com/mempalace) as its knowledge base backend. Every merge, review, and decision feeds into a structured, searchable knowledge store that grows with the project.

---

## Taxonomy: wings, halls, rooms

The knowledge base is organized in a three-level hierarchy:

```
KB root
  wings/           (one per season + one shared)
    season-001/
      halls/
        learnings/
          rooms/
            room-001.md
            room-002.md
        patterns/
        decisions/
        reviews/
        skills/
        counselor-verdicts/
    shared/
      advisory-board/
      counselor-verdicts/
```

### Wings
Each season gets its own wing. A shared wing holds cross-season data (advisory board consultations, Counselor verdicts). Wings provide isolation -- one season's data never leaks into another.

### Halls
Six standard halls per season wing:

| Hall | Contents |
|---|---|
| **learnings** | Mistakes caught in review, corrections applied, lessons extracted |
| **patterns** | Reusable code patterns, architectural templates, proven approaches |
| **decisions** | Design choices with rationale, trade-offs considered, alternatives rejected |
| **reviews** | Gate feedback, ratings, recurring issues, reviewer observations |
| **skills** | Autonomously created skills, promoted via Counselor Placement A |
| **counselor-verdicts** | Multi-model council decisions with full reasoning chains |

### Rooms
Individual knowledge entries within a hall. Each room is a Markdown document with structured frontmatter (timestamp, author character, related task, tags).

---

## Capture and retrieval

### Capture (on merge)
When Leonard merges a task, the system automatically captures:
- What was built (task description, files changed)
- What reviewers flagged (gate feedback summary)
- What patterns emerged (extracted by the code-reviewer)
- What decisions were made (extracted by the principal-architect)

Characters can also write to the KB explicitly during implementation.

### Retrieval (before task)
Before starting a new task, the assigned character queries mempalace for relevant context:
- Prior decisions in the same domain
- Known patterns for similar work
- Past review feedback on related areas
- Active skills that might apply

This is what makes the [flywheel](the-flywheel.md) work -- each task starts with more context than the last.

---

## Storage backend

### Solo mode (v0.1)
- Local storage backed by git
- Knowledge entries are Markdown files committed to a local repository
- Full-text search via mempalace's built-in indexing
- Zero external dependencies

### Team mode (v0.5)
- Azure-backed centralized store
- Private-per-user wings coexist with shared-team wings
- Real-time sync across team members
- Clean upgrade path from solo mode (export + import)

---

## Git mirror

In solo mode, every KB write is also committed to a local git repository. This provides:
- Full history of knowledge evolution
- Offline access to all accumulated learnings
- Easy backup (push the git repo to any remote)
- Export capability for uninstall (tar.gz of the git repo)

---

## See also

- [The Flywheel](the-flywheel.md) -- how knowledge capture drives improvement
- [Seasons](seasons.md) -- how KB wings are scoped
- [The Counselor](counselor.md) -- how verdicts are stored in the KB
