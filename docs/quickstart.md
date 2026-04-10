# factor-echelon Quickstart

Install and run your first themed AI dev team in 15 minutes.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| **OS** | macOS, Linux, or WSL2 on Windows |
| **bun** | v1.1+ ([bun.sh](https://bun.sh)) |
| **git** | v2.30+ (worktree support required) |
| **Platform** | Claude Code v2+ **or** OpenClaw |
| **Counselor keys** (optional) | Google AI Studio, OpenAI, Anthropic, xAI API keys. Only needed for Placements B/C/D. The team works without them -- you just skip multi-model review. |

---

## Step 1: Install

```bash
git clone https://github.com/your-org/factor-echelon.git
cd factor-echelon
bun install
bun run build
```

The build produces target artifacts in `dist/claude-code/` and `dist/openclaw/`. Pick your platform:

**Claude Code:**
```bash
cp -r dist/claude-code ~/.claude/plugins/factor-echelon
```

**OpenClaw:**
```bash
cd dist/openclaw && bash install.sh
```

---

## Step 2: First-run setup (OOBE)

Launch your platform and factor-echelon's first-run wizard starts automatically. It walks you through:

1. **Theme selection** -- pick The Big Bang Theory (default) or Star Wars.
2. **Advisory Board provisioning** -- 12 cross-season specialist advisors are created once and shared across all future projects.
3. **User profile interview** -- a short Q&A that populates your USER.md so characters know how to work with you.

This takes about 2 minutes.

---

## Step 3: Your first season

A **season** is one project engagement. To start one, give Penny a PRD.

### Option A: Use the built-in example

```bash
# From the factor-echelon root:
cat docs/examples/tiny-landing-page/prd.md
```

Paste this into your chat. Penny (the Ingestion PM) reads it, estimates scope, and composes a team.

### Option B: Write your own PRD

Create a Markdown file describing what you want to build -- goals, tech stack, timeline. Even a few sentences works. Penny handles the rest.

### Watch Penny work

Penny will:
1. Parse your PRD and estimate scope (tiny / medium / large / enterprise).
2. Select archetypes that match the work (e.g., frontend-engineer, backend-engineer, qa-lead).
3. Cast themed characters into those roles (e.g., Raj as frontend, Stuart as backend, Bernadette as QA).
4. Create the season workspace with isolated git worktrees.
5. Hand off to Leonard (the User Handler), who runs your project from here.

---

## Step 4: Verify the team

Once Penny finishes, confirm everything is live:

### Check the roster
Leonard presents the full team roster with each character's role, personality summary, and capabilities. You should see 8-11 characters for a small/medium project.

### Run a task
Ask Leonard to assign a task -- for example, "Add a greeting component to the landing page." The assigned character:
- Gets their own git worktree
- Implements the change
- Submits it through **7 review gates** (architecture, code quality, QA, security, adversarial, UI, and refinement)
- Leonard merges the approved result

### See the review gates
Each gate runs in parallel (except Refinement, which is sequential). Watch the reviewers provide ratings and feedback. A task needs majority approval to merge.

---

## Step 5: Next steps

You have a running team. Here is where to go next:

### Mid-season expansion
As your project grows, the team grows too. If you add a mobile requirement, Penny proposes new characters (e.g., Mike Massimino for iOS). Approve the expansion and they join immediately.

### Advisory Board
Your 12-member advisory board (tech luminaries like Bill Gates, Linus Torvalds, Jensen Huang) is available for specialist consultation on any season. Ask Leonard to "consult the advisory board on database architecture."

### The Counselor
For high-stakes decisions, invoke the Counselor -- a 4-model council (Gemini, GPT-5, Opus, Grok) that reviews skill promotions, design decisions, deadlocks, and high-risk changes. Requires API keys for the external models.

### Learn more
- [Architecture overview](concepts/architecture.md)
- [The development flywheel](concepts/the-flywheel.md)
- [Safety nets and review gates](concepts/safety-nets.md)
- [Writing your own archetype](guides/writing-an-archetype.md)
- [Full design specification](specs/2026-04-08-factor-echelon-design.md)
