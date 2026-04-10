# Executive Summary

**factor-echelon is a portable skill package that generates themed AI-agent software development teams on demand.** A user picks a theme (The Big Bang Theory, Star Wars, or a custom theme), drops in a product requirements document, and gets a fully-realized team of AI agents that spin up, build the work, self-review through multiple quality gates, and grow smarter as the project expands. The system targets three agent platforms at v0.1 -- Claude Code, OpenClaw, and Echelon -- authored once in a platform-neutral format with thin adapters per target.

What makes factor-echelon different from other AI coding tools is that it treats the team as a first-class product, not an afterthought. Every agent has a complete identity: personality, voice, operational runbook, working memory, and interpersonal dynamics drawn from beloved characters. A user who knows that Sheldon reviews architecture, Penny handles onboarding, and Barry finds security holes can reason about their team intuitively. Beyond characters, the system carries a multi-model Counselor (four LLMs from four providers reviewing high-stakes decisions), a knowledge flywheel that captures learnings on every merge and retrieves them before every task, and a worktree-per-agent execution model with seven review gates that enforce quality without creating bottlenecks.

---

## Why it matters

AI-assisted development is moving from single-agent tools to multi-agent teams, but existing solutions suffer from four problems: fixed rosters that do not grow with the project, thin agent identities that make interactions mechanical, no memory across sessions, and lock-in to a single platform. factor-echelon solves all four.

The roster starts at the right size (Medium ~11 roles for a landing page, Large ~20 for a SaaS product, Enterprise 30+ for a platform) and expands mid-project as new needs emerge. Characters have full soul packages that make every standup, review, and escalation feel like a real team interaction. The mempalace-backed knowledge base captures institutional memory that compounds across tasks. And the author-once, build-to-many-targets architecture means the same team works on Claude Code today and OpenClaw tomorrow without re-authoring anything.

---

## Key differentiators

1. **Themed characters make AI teams relatable.** Not faceless agents -- recognizable personalities with consistent voice, quirks, and working styles. Users develop intuition for how their team behaves, which builds trust and makes collaboration natural.

2. **Multi-model Counselor prevents groupthink.** Four LLMs from four different providers (Gemini, GPT-5, Opus 4.6, Grok) review at four high-leverage decision points. No single model's blind spots become the team's blind spots. This is structural diversity, not redundancy.

3. **Knowledge flywheel means teams get better over time.** Every merge captures learnings. Every task retrieval queries prior art. Skills accumulate, patterns persist, review rules sharpen. By task 50, the team has institutional memory that rivals months of human team experience.

4. **Seven review gates enforce quality without bottlenecks.** Six gates run in parallel (architecture, code, QA, security, adversarial, UI), one runs sequentially (refinement). Bounce counter escalates stuck tasks. Nothing merges without the User Handler's approval.

5. **Open architecture invites extension.** Add new themes, archetypes, characters, KB backends, and build targets without forking. The skill tree is data, not code -- extensible by design.
