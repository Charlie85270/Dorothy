# AI Development in Practice: Understanding Models, Context & Claude

## Presentation for Developers

### 1. Title Slide
AI Development in Practice: Understanding Models, Context & Claude
A Technical Guide for Developers

### 2. The AI Landscape Today
The modern AI ecosystem is dominated by several major providers, each with distinct strengths:

**Major Model Providers:**
- **OpenAI**: GPT-4, GPT-3.5 - Industry-leading general-purpose models
- **Anthropic**: Claude (Opus, Sonnet, Haiku) - Safety-focused with large context windows
- **Google**: Gemini - Multimodal capabilities, deep integration
- **Meta**: Llama - Open-source, customizable

**Model Sizes & Use Cases:**
- Large models (Opus, GPT-4): Complex reasoning, code generation, research
- Medium models (Sonnet, GPT-3.5): Balanced performance, most production use cases
- Small models (Haiku): Fast responses, simple tasks, cost-effective

**Cost vs Capability Trade-offs:**
Understanding when to use each model tier is crucial for production systems. Large models cost 10-50x more but provide significantly better reasoning for complex tasks.

### 3. How LLMs Actually Work
Understanding the fundamentals helps developers work more effectively with AI.

**Token-Based Processing:**
- Text is broken into tokens (~4 characters each)
- Models process tokens sequentially
- Token limits define context window size
- Pricing is per token (input + output)

**The Processing Flow:**
1. **Input**: User prompt → tokenized
2. **Processing**: Neural network predicts next tokens
3. **Output**: Generated tokens → decoded to text

**Why This Matters:**
- Long inputs cost more and take longer
- Context management is critical
- Token efficiency impacts performance and cost

### 4. Understanding Context
Context is the information available to the AI during a conversation.

**What is a Context Window?**
- The maximum tokens an AI can "remember" at once
- Claude: up to 200K tokens (~150K words)
- GPT-4: 8K-128K tokens depending on version

**Why Context Management Matters:**
- Limited space for instructions, code, and conversation
- Older messages may be dropped or summarized
- Large codebases won't fit entirely
- Strategic context use improves quality

**Management Strategies:**
1. **Summarization**: Compress older context
2. **RAG (Retrieval Augmented Generation)**: Fetch relevant info on-demand
3. **Memory Systems**: Store and retrieve important facts
4. **Smart chunking**: Break large tasks into focused sessions

### 5. The MCP Revolution
Model Context Protocol (MCP) is changing how AI connects to tools and data.

**What is MCP?**
A standardized protocol for AI models to interact with external tools, databases, and services. Think of it as a universal adapter for AI integrations.

**Architecture:**
```
AI Model ↔ MCP Server ↔ External Service
         (standardized)    (filesystem, DB, API)
```

**Key Benefits:**
- **Standardization**: One protocol for all integrations
- **Reusability**: MCP servers work across different AI tools
- **Security**: Controlled access to external resources
- **Extensibility**: Easy to add new capabilities

**Why It Matters:**
Before MCP, every AI tool had custom integrations. MCP provides a universal standard, like USB for AI tools.

### 6. MCP in Action
Real-world examples of MCP servers and their benefits.

**Common MCP Servers:**
- **Filesystem**: Read/write files with permission controls
- **Database**: Query SQL databases securely
- **GitHub**: Access repositories, issues, PRs
- **Slack**: Send messages, read channels
- **Custom APIs**: Connect to any REST API

**How MCP Servers Work:**
1. Server defines available "tools" (functions)
2. AI requests tool execution with parameters
3. Server validates and executes
4. Results returned to AI

**Developer Benefits:**
- Write once, use with any MCP-compatible AI
- Built-in security and access control
- Easy testing and debugging
- Community-shared servers

### 7. Plugins vs Skills
Two different approaches to extending AI capabilities.

**Plugins:**
- External tools and integrations (like MCP servers)
- Connect AI to external services
- Example: Database plugin, API plugin
- **When to use**: Need external data or actions

**Skills:**
- Packaged domain expertise and workflows
- Built-in instructions and patterns
- Example: Code review skill, commit message skill
- **When to use**: Repeated workflows, domain knowledge

**Key Differences:**
| Aspect | Plugins | Skills |
|--------|---------|--------|
| Purpose | External integration | Workflow automation |
| Installation | MCP server setup | Skill package |
| Maintenance | Server updates | Skill updates |
| Scope | Tool access | Knowledge + process |

### 8. Skills Deep Dive
Skills package expertise into reusable workflows.

**What Are Skills?**
Pre-configured prompts, tools, and workflows for specific tasks. They teach AI how to approach domain-specific problems.

**How Skills Work in Claude Code:**
1. User invokes skill: `/commit` or `/review-pr`
2. Skill loads its instructions and tools
3. AI follows skill's guidance
4. Results delivered to user

**Popular Skill Examples:**
- `/commit`: Analyzes changes, writes conventional commits
- `/review-pr`: Reviews PRs for bugs, style, security
- `/test`: Runs tests, analyzes failures
- Custom skills: Deploy scripts, documentation generation

**Creating Skills:**
Skills are defined in `.claude/skills/` with:
- Instructions (how to approach task)
- Tool configurations
- Example workflows

### 9. Claude.MD Files
Project-specific instructions that guide AI behavior.

**What Are .claude.md Files?**
Markdown files that provide context and instructions to Claude about your project. They work like a README for the AI.

**Where to Place Them:**
- Root: `.claude.md` - Project-wide instructions
- Directories: `src/.claude.md` - Directory-specific context
- Both are loaded when AI works in that scope

**What to Include:**
- Architecture overview
- Code conventions and style
- Testing requirements
- Deployment process
- Common pitfalls
- Project-specific terminology

**Best Practices:**
1. Keep it concise - AI reads this each session
2. Update as project evolves
3. Include examples for complex concepts
4. Document "why" not just "what"

### 10. Claude Code Introduction
The official CLI for AI-assisted development.

**What is Claude Code?**
A command-line tool that integrates Claude AI into your development workflow. It's designed for developers who live in the terminal.

**Key Features:**
- **File Operations**: Read, edit, write files intelligently
- **Bash Integration**: Execute commands, git operations
- **Multi-file Editing**: Work across entire codebase
- **Agent Mode**: Autonomous task execution
- **MCP Support**: Connect to external tools
- **Skills System**: Reusable workflows

**Workflow Integration:**
```bash
claude "Add authentication to user service"
# Claude reads code, makes changes, runs tests
```

**Why Developers Love It:**
- Stay in terminal, no context switching
- Handles complex multi-file refactors
- Understands git workflow
- Extensible with hooks and skills

### 11. Claude Code Hooks
Event-driven automation for customizing AI behavior.

**What Are Hooks?**
Shell scripts that run automatically at specific points in the Claude workflow. They're like git hooks but for AI interactions.

**Hook Lifecycle Events:**
- `SessionStart`: When Claude session begins
- `UserPromptSubmit`: Before each user prompt
- `ToolCall`: Before/after tool execution
- `SessionEnd`: When session closes

**Why Hooks Matter:**
- **Automation**: Inject context automatically
- **Customization**: Tailor AI to your workflow
- **Integration**: Connect to external tools
- **Safety**: Validate actions before execution

**Configuration:**
Hooks are defined in `~/.claude/settings.json`:
```json
{
  "hooks": {
    "SessionStart": {
      "command": "~/.claude/hooks/session-start.sh"
    }
  }
}
```

### 12. Hook Example: SessionStart
Runs when Claude session starts - perfect for loading context.

**Use Cases:**
1. **Load Project Context**: Read recent git commits, open PRs
2. **Set Preferences**: Language, coding style, frameworks
3. **Environment Check**: Verify dependencies, node version
4. **Memory Injection**: Load relevant past conversations

**Code Example:**
```bash
#!/bin/bash
# ~/.claude/hooks/session-start.sh

# Load recent git activity
echo "Recent commits:"
git log --oneline -5

# Load project context
if [ -f ".claude-context.md" ]; then
  cat .claude-context.md
fi

# Show current branch and status
echo "Current branch: $(git branch --show-current)"
echo "Working directory: $(pwd)"
```

**Output:**
Hook output is injected into initial context, so Claude knows:
- What you've been working on
- Current project state
- Relevant background info

### 13. Hook Example: UserPromptSubmit
Runs before each user prompt - great for dynamic context.

**Use Cases:**
1. **Inject Fresh Data**: Latest test results, build status
2. **Add Timestamps**: Track when requests made
3. **Load Memories**: Retrieve relevant past decisions
4. **Validate Input**: Check for required info

**Code Example:**
```bash
#!/bin/bash
# ~/.claude/hooks/user-prompt-submit.sh

# Add timestamp
echo "Request time: $(date '+%Y-%m-%d %H:%M:%S')"

# Check if tests passing
if [ -f "test-results.json" ]; then
  echo "Latest test run: $(jq -r '.summary' test-results.json)"
fi

# Load relevant memories
if command -v claude-mem &> /dev/null; then
  claude-mem search "$USER_PROMPT" --limit 3
fi
```

**Key Variables:**
- `$USER_PROMPT`: The user's input text
- Hook output prepended to prompt

**Power Move:**
Combine with memory systems to automatically inject relevant past learnings.

### 14. Hook Example: ToolCall
Runs before/after tool execution - enables logging and validation.

**Use Cases:**
1. **Logging**: Track all AI actions
2. **Validation**: Prevent dangerous operations
3. **Notifications**: Alert on specific actions
4. **Metrics**: Measure AI performance

**Code Example (Before):**
```bash
#!/bin/bash
# ~/.claude/hooks/tool-call-before.sh

TOOL_NAME="$1"
TOOL_PARAMS="$2"

# Log the action
echo "[$(date)] Tool: $TOOL_NAME" >> ~/.claude/tool-log.txt

# Validate dangerous operations
if [[ "$TOOL_NAME" == "Bash" ]] && [[ "$TOOL_PARAMS" =~ "rm -rf" ]]; then
  echo "⚠️  WARNING: Destructive command detected"
  echo "Command: $TOOL_PARAMS"
  # Could exit 1 to block execution
fi
```

**Code Example (After):**
```bash
#!/bin/bash
# ~/.claude/hooks/tool-call-after.sh

TOOL_NAME="$1"
SUCCESS="$2"  # true/false

# Track metrics
if [ "$SUCCESS" == "true" ]; then
  echo "✓ $TOOL_NAME succeeded" >> ~/.claude/metrics.txt
else
  echo "✗ $TOOL_NAME failed" >> ~/.claude/metrics.txt
fi
```

### 15. Building Custom Hooks
How to create your own hooks for specific needs.

**Hook Configuration in settings.json:**
```json
{
  "hooks": {
    "SessionStart": {
      "command": "~/.claude/hooks/session-start.sh",
      "timeout": 5000
    },
    "UserPromptSubmit": {
      "command": "~/.claude/hooks/inject-context.sh"
    },
    "ToolCall": {
      "before": "~/.claude/hooks/validate-action.sh",
      "after": "~/.claude/hooks/log-action.sh"
    }
  }
}
```

**Shell Script Basics:**
```bash
#!/bin/bash
# Make executable: chmod +x hook.sh

# Access environment variables
echo "User: $USER"
echo "PWD: $PWD"

# Read from files
cat .project-context.md

# Call external tools
curl -s api.example.com/status

# Exit codes
exit 0  # Success
exit 1  # Failure (blocks in some hooks)
```

**Common Patterns:**
1. **Context Injection**: `cat context-file.md`
2. **API Calls**: `curl -s api/endpoint | jq`
3. **File Analysis**: `find . -name "*.test.js" | wc -l`
4. **Git Integration**: `git status --short`

**Tips:**
- Keep hooks fast (<1s)
- Handle errors gracefully
- Output only relevant info
- Test hooks independently

### 16. Real-World Hook Use Cases
Practical examples from production systems.

**1. Auto-Loading Project Context:**
```bash
# SessionStart hook
cat <<EOF
Project: E-commerce Platform
Stack: Node.js, React, PostgreSQL
Current Sprint: Authentication refactor
Key Files: src/auth/*, src/api/users.ts
Recent Changes: $(git log --oneline -3)
EOF
```

**2. Enforcing Code Standards:**
```bash
# ToolCall before hook
if [[ "$TOOL_NAME" == "Write" ]] && [[ "$FILE_PATH" =~ \.ts$ ]]; then
  # Validate TypeScript standards
  echo "✓ Remember: Use strict types, no 'any'"
fi
```

**3. Integration with External Tools:**
```bash
# UserPromptSubmit hook
# Load Linear issues assigned to user
linear-cli issue list --assigned-to me --status "In Progress" | \
  jq -r '.[] | "- \(.identifier): \(.title)"'
```

**4. Memory/Context Injection:**
```bash
# UserPromptSubmit hook
# Load relevant past decisions
echo "Relevant past decisions:"
grep -h "$USER_PROMPT" ~/.claude/memory/*.md | head -5
```

**5. Deployment Safety:**
```bash
# ToolCall before hook
if [[ "$TOOL_PARAMS" =~ "kubectl apply" ]]; then
  echo "⚠️  Kubernetes deployment detected"
  echo "Environment: $(kubectl config current-context)"
fi
```

### 17. Best Practices
Guidelines for choosing the right tool for the job.

**When to Use MCP:**
- Need external data or services
- Want reusable integrations
- Require security/permission controls
- Building tools for multiple AI systems

**When to Use Skills:**
- Repeated workflows
- Domain-specific expertise
- Complex multi-step processes
- Teaching AI project conventions

**When to Use Hooks:**
- Automatic context injection
- Validation and safety checks
- Integration with existing tools
- Logging and monitoring

**Context Management Strategies:**
1. **Be Selective**: Only load relevant context
2. **Use Summaries**: Compress large information
3. **Leverage Hooks**: Auto-inject fresh data
4. **Structure .claude.md**: Clear, scannable format

**Security Considerations:**
- **MCP**: Use permission controls, validate inputs
- **Hooks**: Avoid exposing secrets, validate scripts
- **Skills**: Review before installing
- **General**: Principle of least privilege

**Performance Tips:**
- Keep hooks fast (<1s)
- Cache expensive operations
- Use smaller models for simple tasks
- Batch operations when possible

### 18. The Future & Resources
Where AI tooling is heading and how to learn more.

**The Future of AI Development:**
- **Better Context Management**: Infinite context windows
- **Specialized Models**: Domain-specific AI (code, design, etc.)
- **Autonomous Agents**: Multi-agent systems working together
- **IDE Integration**: Deep integration with VS Code, JetBrains
- **Standard Protocols**: MCP adoption across all AI tools

**Learning Resources:**
- **Claude Code Docs**: docs.claude.ai/code
- **MCP Specification**: modelcontextprotocol.io
- **Anthropic Cookbook**: github.com/anthropics/anthropic-cookbook
- **Community Skills**: claude-skills.dev
- **Hooks Examples**: github.com/anthropics/claude-code-hooks

**Getting Started:**
1. Install Claude Code: `npm install -g @anthropic-ai/claude-code`
2. Set up your first .claude.md file
3. Try built-in skills: `/commit`, `/review-pr`
4. Create a simple SessionStart hook
5. Explore MCP servers

**Join the Community:**
- Discord: discord.gg/anthropic
- GitHub Discussions: github.com/anthropics/claude-code
- Share your skills and hooks!

**Key Takeaway:**
AI development tools are rapidly maturing. Understanding models, context, MCP, skills, and hooks gives you superpowers as a developer. Start small, experiment, and build your own workflows.
