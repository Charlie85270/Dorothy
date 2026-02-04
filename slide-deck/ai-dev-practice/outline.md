# Slide Deck Outline

**Topic**: AI Development in Practice: Understanding Models, Context & Claude
**Style**: blueprint
**Dimensions**: grid + cool + technical + balanced
**Audience**: Experts/professionals (Developers)
**Language**: English
**Slide Count**: 18 slides
**Generated**: 2026-02-03 14:50

---

<STYLE_INSTRUCTIONS>
Design Aesthetic: Precise technical blueprint style with professional analytical visual presentation. Clean, structured visual metaphors using blueprints, diagrams, and schematics. Technical grid overlay with engineering precision and cool analytical blues and grays.

Background:
  Texture: Subtle grid overlay, light engineering paper feel
  Base Color: Blueprint Off-White (#FAF8F5)

Typography:
  Headlines: Bold geometric sans-serif with perfect letterforms and consistent spacing - technical, authoritative presence
  Body: Elegant serif with clean readability at smaller sizes - professional editorial quality

Color Palette:
  Primary Text: Deep Slate (#334155) - Headlines, body text
  Background: Blueprint Paper (#FAF8F5) - Primary background
  Grid: Light Gray (#E5E5E5) - Background grid lines
  Primary Accent: Engineering Blue (#2563EB) - Key elements, highlights
  Secondary Accent: Navy Blue (#1E3A5F) - Supporting elements
  Tertiary: Light Blue (#BFDBFE) - Backgrounds, fills
  Warning: Amber (#F59E0B) - Warnings, emphasis points

Visual Elements:
  - Precise lines with consistent stroke weights
  - Technical schematics and clean vector graphics
  - Thin line work in technical drawing style
  - Connection lines use straight lines or 90-degree angles only
  - Data visualization with clean, minimal charts
  - Dimension lines and measurement indicators
  - Cross-section style diagrams
  - Isometric or orthographic projections

Density Guidelines:
  - Content per slide: 2-3 key points, balanced whitespace
  - Whitespace: Generous margins, clear visual breathing room
  - Element count: 3-5 primary elements per slide

Style Rules:
  Do: Maintain consistent line weights throughout, use grid alignment for all elements, keep color palette restrained and unified, create clear visual hierarchy through scale, use geometric precision for all shapes
  Don't: Use hand-drawn or organic shapes, add decorative flourishes, use curved connection lines, include photographic elements, add slide numbers, footers, or logos
</STYLE_INSTRUCTIONS>

---

## Slide 1 of 18

**Type**: Cover
**Filename**: 01-slide-cover.png

// NARRATIVE GOAL
Establish the presentation topic and set technical tone for a developer audience

// KEY CONTENT
Headline: AI Development in Practice
Sub-headline: Understanding Models, Context & Claude
Tagline: A Technical Guide for Developers

// VISUAL
Clean technical blueprint aesthetic with subtle grid overlay. Central title with architectural precision. Blueprint-style border elements or technical corner markers. Engineering blue accent lines.

// LAYOUT
Layout: title-hero
Centered composition with headline dominating upper-middle. Sub-headline below in smaller serif. Minimal decorative elements that reinforce technical precision theme.

---

## Slide 2 of 18

**Type**: Content
**Filename**: 02-slide-ai-landscape.png

// NARRATIVE GOAL
Establish the current AI ecosystem landscape and major players

// KEY CONTENT
Headline: The AI Landscape Today
Sub-headline: Models, Providers & Trade-offs
Body:
- Major Providers: OpenAI (GPT-4, GPT-3.5), Anthropic (Claude Opus/Sonnet/Haiku), Google (Gemini), Meta (Llama)
- Model Tiers: Large (complex reasoning) · Medium (balanced production) · Small (fast, cost-effective)
- Key Trade-off: Cost vs Capability — Large models cost 10-50× more but deliver superior reasoning

// VISUAL
Grid layout showing major providers in quadrants with model tiers indicated by size. Cost-capability spectrum visualization as a diagonal line or scale. Clean technical diagram style.

// LAYOUT
Layout: split-column
Left side: Provider grid with logos/names and model names. Right side: Cost vs capability graph with clear axes and data points.

---

## Slide 3 of 18

**Type**: Content
**Filename**: 03-slide-llm-mechanics.png

// NARRATIVE GOAL
Explain the fundamental mechanics of how LLMs process information

// KEY CONTENT
Headline: How LLMs Actually Work
Sub-headline: Token Processing Flow
Body:
- Tokens: Text broken into ~4-character chunks
- Processing: Sequential token prediction through neural network
- Flow: Input → Tokenization → Neural Network → Output Generation
- Impact: Token limits define context, pricing per token (input + output)

// VISUAL
Technical flow diagram showing the three-stage process. Input text being tokenized into chunks, flowing through a neural network representation (simplified), and output tokens being decoded. Use arrows with 90-degree angles, dimension lines.

// LAYOUT
Layout: flow-diagram
Horizontal flow from left to right showing the transformation stages. Each stage clearly labeled with technical annotations.

---

## Slide 4 of 18

**Type**: Content
**Filename**: 04-slide-context-windows.png

// NARRATIVE GOAL
Explain what context is and why managing it matters

// KEY CONTENT
Headline: Understanding Context Windows
Sub-headline: The AI's Working Memory
Body:
- Definition: Maximum tokens AI can process at once
- Limits: Claude 200K tokens (~150K words) · GPT-4 8K-128K tokens
- Challenge: Instructions + code + conversation must fit within limit
- Strategies: Summarization · RAG (on-demand retrieval) · Memory systems · Smart chunking

// VISUAL
Visualization of context window as a bounded container with different content types stacked inside (instructions, code, conversation). Show overflow concept when content exceeds limit. Use blueprint-style measurement indicators.

// LAYOUT
Layout: diagram-with-callouts
Central context window diagram with labeled sections. Callouts pointing to management strategies on the right side.

---

## Slide 5 of 18

**Type**: Content
**Filename**: 05-slide-mcp-intro.png

// NARRATIVE GOAL
Introduce Model Context Protocol as a revolutionary standard

// KEY CONTENT
Headline: The MCP Revolution
Sub-headline: Standardized AI Integration Protocol
Body:
- What: Universal protocol for AI ↔ external tool communication
- Architecture: AI Model ↔ MCP Server ↔ External Service
- Benefits: Standardization · Reusability · Security · Extensibility
- Analogy: "USB for AI tools" — one protocol for all integrations

// VISUAL
Technical architecture diagram showing three-layer stack. AI Model at left, MCP Server in center (highlighted), External Services at right. Connection lines showing standardized protocol. Blueprint schematic style.

// LAYOUT
Layout: architecture-diagram
Three-column layout with clear separation. Center column (MCP) emphasized with accent color. Bidirectional arrows showing communication flow.

---

## Slide 6 of 18

**Type**: Content
**Filename**: 06-slide-mcp-examples.png

// NARRATIVE GOAL
Make MCP concrete with real-world examples

// KEY CONTENT
Headline: MCP in Action
Sub-headline: Common Servers & Use Cases
Body:
- Filesystem: Read/write with permission controls
- Database: Secure SQL query execution
- GitHub: Repository, issues, PR access
- Slack: Messaging and channel integration
- Custom APIs: Connect any REST endpoint
- Process: Tool definition → Request → Validation → Execution → Results

// VISUAL
Grid of MCP server examples, each shown as a small schematic block with icon/label. Arrows showing the request-response flow at bottom. Technical icon style with blueprint aesthetic.

// LAYOUT
Layout: icon-grid-with-flow
Top: 2×3 grid of MCP server types. Bottom: Linear flow diagram showing the process from request to results.

---

## Slide 7 of 18

**Type**: Content
**Filename**: 07-slide-plugins-vs-skills.png

// NARRATIVE GOAL
Clarify the distinction between plugins and skills

// KEY CONTENT
Headline: Plugins vs Skills
Sub-headline: Two Approaches to Extension
Body:
- Plugins: External tools (MCP servers) · Connect to services · Example: Database, API plugin · Use for: External data/actions
- Skills: Packaged expertise · Workflow automation · Example: Code review, commit message · Use for: Repeated workflows, domain knowledge
- Comparison Table: Purpose · Installation · Maintenance · Scope

// VISUAL
Split comparison diagram with plugins on left, skills on right. Visual metaphors: plugins as connection/integration symbol, skills as workflow/process symbol. Comparison table below with clear rows.

// LAYOUT
Layout: split-comparison
Upper half: Visual representations of each concept. Lower half: Structured comparison table with aligned columns.

---

## Slide 8 of 18

**Type**: Content
**Filename**: 08-slide-skills-deep-dive.png

// NARRATIVE GOAL
Explain skills in detail with practical examples

// KEY CONTENT
Headline: Skills Deep Dive
Sub-headline: Packaged Expertise for Developers
Body:
- Definition: Pre-configured prompts + tools + workflows for specific tasks
- How They Work: Invoke (/commit) → Load instructions → AI follows guidance → Results
- Examples: /commit (conventional commits) · /review-pr (code review) · /test (test analysis)
- Structure: Instructions + tool configs + workflows in .claude/skills/

// VISUAL
Schematic showing skill anatomy: skill package containing instructions, tools, and workflows. Example flow showing /commit skill in action. Technical blueprint style with labeled components.

// LAYOUT
Layout: exploded-view
Top: Deconstructed view of skill components. Bottom: Linear workflow showing skill invocation and execution.

---

## Slide 9 of 18

**Type**: Content
**Filename**: 09-slide-claude-md.png

// NARRATIVE GOAL
Introduce .claude.md files as project context mechanism

// KEY CONTENT
Headline: .claude.md Files
Sub-headline: Project Instructions for AI
Body:
- Purpose: Project-specific guidance and context
- Placement: Root (.claude.md) or directory-level (src/.claude.md)
- Contents: Architecture overview · Code conventions · Testing requirements · Deployment · Pitfalls · Terminology
- Best Practices: Keep concise · Update regularly · Include "why" not just "what" · Add examples

// VISUAL
File structure diagram showing .claude.md placement in project hierarchy. Document icon with key content sections labeled. Connection lines showing how AI reads context.

// LAYOUT
Layout: document-structure
Left: Project tree showing .claude.md files. Right: Expanded view of file contents with sections highlighted.

---

## Slide 10 of 18

**Type**: Content
**Filename**: 10-slide-claude-code-intro.png

// NARRATIVE GOAL
Introduce Claude Code CLI tool and its capabilities

// KEY CONTENT
Headline: Claude Code
Sub-headline: AI-Assisted Development in Your Terminal
Body:
- What: Official CLI tool integrating Claude into dev workflow
- Features: File operations · Bash integration · Multi-file editing · Agent mode · MCP support · Skills system
- Example: `claude "Add authentication to user service"`
- Benefits: Terminal-native · Complex refactors · Git workflow · Extensible

// VISUAL
Terminal window representation with Claude Code command and response. Feature icons arranged around terminal. Blueprint-style technical illustration.

// LAYOUT
Layout: hero-with-features
Center: Terminal example. Surrounding: Feature callouts with icons arranged in grid pattern.

---

## Slide 11 of 18

**Type**: Content
**Filename**: 11-slide-hooks-intro.png

// NARRATIVE GOAL
Introduce hooks as event-driven automation system

// KEY CONTENT
Headline: Claude Code Hooks
Sub-headline: Event-Driven Workflow Automation
Body:
- What: Shell scripts executing at specific workflow points
- Lifecycle Events: SessionStart · UserPromptSubmit · ToolCall · SessionEnd
- Benefits: Automation (inject context) · Customization · Integration · Safety (validation)
- Analogy: Like git hooks but for AI interactions

// VISUAL
Circular lifecycle diagram showing hook events in sequence. Each event marked with hook point. Arrows showing flow through workflow lifecycle. Technical schematic style.

// LAYOUT
Layout: lifecycle-diagram
Circular or linear flow showing the four main hook points with descriptions and timing indicators.

---

## Slide 12 of 18

**Type**: Content
**Filename**: 12-slide-hook-sessionstart.png

// NARRATIVE GOAL
Demonstrate SessionStart hook with practical example

// KEY CONTENT
Headline: Hook Example: SessionStart
Sub-headline: Loading Context Automatically
Body:
- Trigger: When Claude session begins
- Use Cases: Load git activity · Set preferences · Check environment · Inject memory
- Code Example:
  ```bash
  #!/bin/bash
  echo "Recent commits:"
  git log --oneline -5
  cat .claude-context.md
  echo "Branch: $(git branch --show-current)"
  ```
- Result: Context automatically available to AI

// VISUAL
Code block showing the shell script with syntax highlighting. Flow arrow showing hook → context injection. Before/after visualization showing empty vs populated context.

// LAYOUT
Layout: code-with-explanation
Left: Code example in monospace with blueprint styling. Right: Explanation of what each section does and the resulting benefit.

---

## Slide 13 of 18

**Type**: Content
**Filename**: 13-slide-hook-promptsubmit.png

// NARRATIVE GOAL
Show UserPromptSubmit hook for dynamic context injection

// KEY CONTENT
Headline: Hook Example: UserPromptSubmit
Sub-headline: Dynamic Context Before Each Request
Body:
- Trigger: Before each user prompt processed
- Use Cases: Fresh test results · Timestamps · Memory retrieval · Input validation
- Code Example:
  ```bash
  #!/bin/bash
  echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
  jq -r '.summary' test-results.json
  claude-mem search "$USER_PROMPT" --limit 3
  ```
- Power: Context updates every request with latest info

// VISUAL
Similar code presentation with emphasis on $USER_PROMPT variable. Timeline showing hook executing before prompt reaches AI. Data flow diagram.

// LAYOUT
Layout: code-with-flow
Top: Code example. Bottom: Flow diagram showing user input → hook execution → enriched prompt → AI.

---

## Slide 14 of 18

**Type**: Content
**Filename**: 14-slide-hook-toolcall.png

// NARRATIVE GOAL
Explain ToolCall hooks for logging and validation

// KEY CONTENT
Headline: Hook Example: ToolCall
Sub-headline: Validation & Logging for Safety
Body:
- Trigger: Before/after tool execution
- Use Cases: Logging actions · Preventing dangerous ops · Notifications · Performance metrics
- Code Example (Before):
  ```bash
  if [[ "$TOOL_PARAMS" =~ "rm -rf" ]]; then
    echo "⚠️ WARNING: Destructive command"
    # exit 1 to block
  fi
  ```
- Safety: Catch problems before execution

// VISUAL
Two-panel layout showing before/after hooks. Warning symbol for validation check. Log file representation for after hook. Technical warning aesthetic.

// LAYOUT
Layout: split-comparison
Left: Before hook with validation logic. Right: After hook with logging. Center: Tool execution point with bidirectional arrows.

---

## Slide 15 of 18

**Type**: Content
**Filename**: 15-slide-building-hooks.png

// NARRATIVE GOAL
Teach how to create custom hooks

// KEY CONTENT
Headline: Building Custom Hooks
Sub-headline: Configuration & Patterns
Body:
- Configuration (settings.json):
  ```json
  {
    "hooks": {
      "SessionStart": {
        "command": "~/.claude/hooks/start.sh",
        "timeout": 5000
      }
    }
  }
  ```
- Shell Basics: Environment vars · File reads · API calls · Exit codes
- Common Patterns: Context injection (cat) · API calls (curl | jq) · Git integration · File analysis
- Tips: Keep fast (<1s) · Handle errors · Output only relevant info

// VISUAL
Configuration file snippet at top. Below: Common pattern examples as small code blocks. Technical reference card aesthetic.

// LAYOUT
Layout: reference-card
Configuration example prominently displayed. Grid of common patterns below with brief code snippets for each.

---

## Slide 16 of 18

**Type**: Content
**Filename**: 16-slide-hook-usecases.png

// NARRATIVE GOAL
Inspire with real-world hook applications

// KEY CONTENT
Headline: Real-World Hook Use Cases
Sub-headline: Production Patterns
Body:
- Auto-load Context: Recent commits + sprint info + key files
- Enforce Standards: TypeScript strict types reminder on .ts files
- External Integration: Load Linear issues assigned to user
- Memory Injection: Grep past decisions from memory files
- Deployment Safety: Alert on kubectl apply with current context

// VISUAL
Five small schematic diagrams, each illustrating a use case. Flow arrows showing hook→action→benefit. Technical icons for each category.

// LAYOUT
Layout: use-case-grid
2×3 grid (5 use cases + space), each cell containing icon, title, and brief visual representation of the pattern.

---

## Slide 17 of 18

**Type**: Content
**Filename**: 17-slide-best-practices.png

// NARRATIVE GOAL
Provide decision framework and guidelines

// KEY CONTENT
Headline: Best Practices
Sub-headline: Choosing the Right Tool
Body:
- When to Use MCP: External data/services · Reusable integrations · Security controls · Multi-system tools
- When to Use Skills: Repeated workflows · Domain expertise · Multi-step processes · Project conventions
- When to Use Hooks: Auto context · Validation · Existing tool integration · Logging
- Context Management: Be selective · Use summaries · Leverage hooks · Structure .claude.md
- Security: Permission controls · Validate scripts · Review skills · Least privilege

// VISUAL
Decision tree or matrix showing when to choose each approach. Security shield icon with key principles. Clean technical reference layout.

// LAYOUT
Layout: decision-matrix
Top: When to use what (3-column comparison). Bottom: Security and performance considerations with icons.

---

## Slide 18 of 18

**Type**: Back Cover
**Filename**: 18-slide-resources.png

// NARRATIVE GOAL
Send developers off with clear next steps and resources

// KEY CONTENT
Headline: The Future & Resources
Sub-headline: Start Building with AI
Body:
- Future: Infinite context · Specialized models · Autonomous agents · Deep IDE integration · MCP everywhere
- Resources: docs.claude.ai/code · modelcontextprotocol.io · github.com/anthropics/anthropic-cookbook
- Getting Started: 1) Install Claude Code 2) Create .claude.md 3) Try /commit skill 4) Create SessionStart hook 5) Explore MCP
- Join: Discord (discord.gg/anthropic) · GitHub Discussions

// VISUAL
Clean blueprint aesthetic with resource links and getting started steps. QR code or URL references. Technical documentation style closing.

// LAYOUT
Layout: resources-grid
Left: Future trends with minimal icons. Center: Getting started checklist. Right: Resources and community links.

---
