## Memory System

Dorothy exposes Claude Code's **native memory** (`~/.claude/projects/*/memory/`) via the Memory page. No custom storage — reads real Claude Code memory files. Project dir names use path-as-folder-name encoding (slashes → dashes).

## Memory

Use auto memory (`~/.claude/projects/.../memory/`) actively on this project:
- Save architectural decisions, key file locations, and debugging insights to `MEMORY.md`
- Create topic files (e.g. `patterns.md`, `debugging.md`) for detailed notes — keep `MEMORY.md` under 200 lines
- At session start, review `MEMORY.md` for relevant context before diving in
- After any correction or new discovery, update memory so the next session benefits
