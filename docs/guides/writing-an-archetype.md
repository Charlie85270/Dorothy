# Writing an Archetype

An archetype is a theme-agnostic role blueprint. It defines what a team role does, what capabilities it needs, and when it activates. Themes then map archetypes to themed characters.

---

## Directory structure

Create a new directory under `src/team-factory/archetypes/`:

```
src/team-factory/archetypes/
  your-archetype-slug/
    archetype.yaml       # metadata, responsibilities, I/O
    capabilities.yaml    # required and forbidden capabilities
    description.md       # prose description and activation triggers
```

Use the template at `src/team-factory/archetypes/_template/` as a starting point:

```bash
cp -r src/team-factory/archetypes/_template src/team-factory/archetypes/your-archetype-slug
```

---

## archetype.yaml

This is the primary metadata file. Required fields:

```yaml
name: "your-archetype-slug"
display_name: "Your Archetype Display Name"
tier: "medium"          # medium | large | enterprise
canonical_source: "Reference to published source justifying this role"

role_summary: |
  One paragraph describing the archetype's primary purpose and function.
  What does this role do? Why does the team need it?

primary_responsibilities:
  - "First responsibility"
  - "Second responsibility"
  - "Third responsibility"

inputs:
  - type: "what this role consumes"
    formats: ["markdown", "yaml", "json"]

outputs:
  - type: "what this role produces"
    schema: "path/to/schema.yaml"

single_role: true                # true if only one character can hold this role
secondary_roles_allowed: []      # list of archetypes this can serve as secondary
```

**Tier guidelines:**
- `medium` -- core roles needed for any project (~11 roles at this tier)
- `large` -- specialized roles for complex projects (16-20 roles)
- `enterprise` -- highly specialized roles for large-scale systems (30+ roles)

**canonical_source** should reference published industry research (Team Topologies, SRE book, Accelerate, Staff Engineer, etc.) that justifies why this role exists as a distinct archetype rather than being absorbed by an existing one.

---

## capabilities.yaml

Defines the RBAC permissions for this archetype:

```yaml
required_capabilities:
  - source-control:read      # can read from source control
  - prd-intake:write         # can write PRD analysis
  - file-ops:write           # can create/modify files
  - knowledge-retrieval:read # can query the knowledge base

forbidden_capabilities:
  - source-control:admin     # cannot administer repos
  - capability-grant         # cannot grant capabilities to others
```

Capabilities map to shared skills in `src/team-factory/shared-skills/`. The access matrix (`src/team-factory/capabilities/access-matrix.yaml`) enforces these at runtime.

**Principle of least privilege:** Only grant capabilities the archetype genuinely needs. When in doubt, forbid it -- capabilities can be expanded later but revoking them may break existing characters.

---

## description.md

Prose documentation for the archetype. This is what other developers read when deciding whether to use or extend this archetype:

```markdown
# Your Archetype Display Name

Describe what this archetype does and its place in the team.
Explain which Team Topologies team type it belongs to
(stream-aligned, platform, enabling, or complicated-subsystem).

## When this archetype fires

- Trigger condition 1 (e.g., "when a new PRD is submitted")
- Trigger condition 2 (e.g., "when a security review is requested")

## When this archetype stops

Describe deactivation conditions (e.g., "after handoff to User Handler").
```

---

## After creating the archetype

1. **Add theme mappings** -- Update `role-mapping.yaml` in each theme that should support this archetype. Map it to a themed character with `persona_notes` explaining how the character interprets the role.
2. **Update split triggers** -- If this archetype is a specialization of an existing one (e.g., `appsec-engineer` splits from `security-engineer`), add the trigger in `src/team-factory/roster-composer/split-trigger-rules.md`.
3. **Update the scope estimator** -- If this archetype should be auto-selected at certain tiers, add it to the tier lists in `src/team-factory/roster-composer/scope-estimator.md`.
4. **Test** -- Run `bun test` to verify the archetype passes schema validation.
5. **Build** -- Run `bun run build` to verify the archetype is included in all target artifacts.

---

## Example: the ingestion-pm archetype

See `src/team-factory/archetypes/ingestion-pm/` for a complete reference implementation. The ingestion-pm (cast as Penny in TBBT) reads PRDs, estimates scope, and spawns seasons. Its `capabilities.yaml` grants `source-control:read` and `prd-intake:write` but forbids `source-control:write` -- Penny can read repos to understand the codebase but cannot modify them.

---

## See also

- [Writing a Character](writing-a-character.md) -- how to create a themed character for this archetype
- [Customizing the Roster](customizing-the-roster.md) -- how tiers and split triggers work
- [Architecture](../concepts/architecture.md) -- where archetypes fit in the content layer
