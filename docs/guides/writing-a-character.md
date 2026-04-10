# Writing a Character

A character is a themed persona that fills an archetype role. Characters live within a theme and give the team its personality. Every character ships with a 5-file soul package.

---

## Directory structure

Create a new directory under your theme's `characters/` folder:

```
src/team-factory/themes/<theme>/characters/<character-slug>/
  SOUL.md           # identity, personality, voice
  AGENTS.md         # operational runbook
  HEARTBEAT.md      # cadence and rhythms
  MEMORY.seed.md    # initial working context (drifts at runtime)
  persona.md        # prose style, mannerisms, catchphrases
```

---

## SOUL.md

The character's identity document. Uses YAML frontmatter plus Markdown body:

```markdown
---
name: "Character Name"
archetype: "archetype-slug"
theme: "theme-slug"
tier: "medium"
personality_tags: [analytical, warm, direct]
voice: "Third person, academic tone with occasional humor"
---

# Character Name

[2-3 paragraphs describing who this character is, how they approach their work,
what motivates them, and how they interact with the team.]

## Core traits

- **Trait 1:** Description of how this manifests in their work
- **Trait 2:** Description
- **Trait 3:** Description

## Working style

[How this character communicates, handles conflict, responds to pressure,
and collaborates with others.]
```

The frontmatter `archetype` field links this character to its role blueprint. The `personality_tags` drive runtime behavior -- an `analytical` character produces more structured output than a `creative` one.

---

## AGENTS.md

The operational runbook -- what this character does in each phase of work:

```markdown
# Character Name -- Operational Runbook

## On task assignment
- [Steps this character takes when receiving a task]

## During implementation
- [How this character approaches building]

## On review
- [How this character reviews others' work, if applicable]

## On conflict
- [How this character handles disagreements]
```

Keep this actionable. The runtime reads AGENTS.md to determine character behavior at each lifecycle phase.

---

## HEARTBEAT.md

Defines the character's cadence -- when they check in, how often they report:

```markdown
# Character Name -- Heartbeat

## Daily standup
[What this character reports and how -- format, personality, level of detail]

## Task completion
[How this character signals done -- tone, what they include]

## Escalation triggers
[When this character raises concerns -- thresholds, who they escalate to]
```

---

## MEMORY.seed.md

Initial working context. This is a seed that drifts at runtime as the character accumulates experience through the knowledge flywheel:

```markdown
# Character Name -- Working Memory

## Known context
- [Starting knowledge relevant to their role]

## Preferences
- [Tool preferences, coding style, framework opinions]

## Relationships
- [How this character relates to specific other characters]
```

---

## persona.md

Prose style guide for the character's voice. This controls how the character's output reads:

```markdown
# Character Name -- Persona

## Speech patterns
[Formal vs casual, vocabulary level, catchphrases, recurring jokes]

## Mannerisms
[Behavioral quirks that make the character feel real in reviews and standups]

## Interaction style
[How they relate to the user, to Leonard, to Sheldon, etc.]
```

---

## Register the character

After creating the soul package, add the character to the theme's `role-mapping.yaml`:

```yaml
roles:
  archetype-slug:
    character: character-slug
    display_name: "Character Display Name"
    persona_notes: >
      Brief summary of how this character interprets the archetype role.
      This is the first thing a developer reads when reviewing the roster.
    secondary: false
```

Set `secondary: true` if this character already holds a primary role and this is an additional assignment (e.g., Wil Wheaton holds both adversarial-reviewer and developer-advocate).

---

## Validation

Run `bun test` to verify:
- All 5 required files exist in the character directory
- SOUL.md frontmatter matches the soul schema (`src/team-factory/protocols/soul-schema.yaml`)
- The archetype referenced in SOUL.md exists in `src/team-factory/archetypes/`
- The character is registered in `role-mapping.yaml`
- No capability conflicts between the character and its archetype

---

## See also

- [Writing an Archetype](writing-an-archetype.md) -- the role blueprint this character fills
- [Customizing the Roster](customizing-the-roster.md) -- how characters are selected for a team
