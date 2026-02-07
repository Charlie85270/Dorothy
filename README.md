# claude.mgr

A powerful desktop manager and orchestration platform for [Claude Code](https://claude.ai/code) by Anthropic. Manage multiple AI agents, automate workflows, control agents remotely via Telegram and Slack, and coordinate complex multi-agent tasks — all from one place.

![claude.mgr Dashboard](screenshots/0.png)

## Table of Contents

- [Features](#features)
- [MCP Servers & Tools](#mcp-servers--tools)
- [Automations](#automations)
- [Scheduled Tasks](#scheduled-tasks)
- [Kanban Board](#kanban-board)
- [Telegram Integration](#telegram-integration)
- [Slack Integration](#slack-integration)
- [Installation](#installation)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Configuration & Storage](#configuration--storage)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Dashboard
Manage your agents with a clean, UX-friendly UI. Get notified when an agent task completes or needs your input.

### Agent Management
Create, monitor, and control multiple Claude Code agents simultaneously. Each agent runs in its own terminal with full PTY support for real-time interaction.

![Agents View](screenshots/agetns.png)

**Capabilities:**
- Create agents with custom names, skills, and character avatars
- Assign agents to specific project directories
- Start agents with prompts and model selection (sonnet, opus, haiku)
- Send interactive input to running agents
- Real-time terminal output streaming
- Agent states: `idle` → `running` → `completed` / `error` / `waiting`
- Optional secondary project path via `--add-dir`
- Git worktree support for isolated development
- Persistent agent state across app restarts

**Character Avatars:** robot, ninja, wizard, astronaut, knight, pirate, alien, viking

### Super Agent (Orchestrator)
The Super Agent is a meta-agent that coordinates all other agents. Give it high-level tasks and it delegates work to the appropriate agents, monitors their progress, and reports back.

![Super Agent](screenshots/super-agent.png)

- Automatically coordinates multiple agents
- Delegates tasks based on agent capabilities and skills
- Monitors progress and handles errors
- Uses MCP tools to control other agents programmatically
- Responds to Telegram and Slack messages

### Usage Statistics
Track your Claude Code usage with detailed statistics — conversation history, token usage, and activity patterns with visualizations.

![Usage Stats](screenshots/stats.png)

### Skills & Plugins
Browse and manage Claude Code skills with direct [skills.sh](https://skills.sh) integration.

![Skills Management](screenshots/skills.png)

**Plugin Marketplace:**
- **Code Intelligence**: LSP plugins for TypeScript, Python, Rust, Go, and more
- **External Integrations**: GitHub, GitLab, Jira, Figma, Slack, Vercel
- **Development Workflows**: Commit commands, PR review tools
- **Output Styles**: Customize Claude's response format

### 3D Agent View
Watch your agents work in a beautiful 3D office environment with animated characters.

![3D View](screenshots/3d.png)

### Persistent Memory
Powered by [claude-mem](https://github.com/thedotmack/claude-mem), agents recall past decisions, learnings, and context across sessions.

- One-click activation from Settings
- Automatic memory capture of decisions and learnings
- Cross-session context persistence
- AI-powered summarization for efficient storage
- Works across all Claude Code sessions

### Settings Management
Configure Claude Code settings directly from the app — permissions, environment variables, hooks, and more.

---

## MCP Servers & Tools

Claude Manager includes **three MCP (Model Context Protocol) servers** that expose **30+ tools** for programmatic agent control. These tools are used by the Super Agent and can be added to any Claude Code session.

### mcp-orchestrator

The main orchestration server providing agent management, messaging, scheduling, and automation tools.

**Location:** `mcp-orchestrator/`

#### Agent Management Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `list_agents` | — | List all agents with status, ID, name, project, and current task |
| `get_agent` | `id` | Get detailed info about a specific agent including full output history |
| `get_agent_output` | `id`, `lines?` (default: 100) | Read an agent's recent terminal output |
| `create_agent` | `projectPath`, `name?`, `skills?`, `character?`, `skipPermissions?` (default: true), `secondaryProjectPath?` | Create a new agent in idle state |
| `start_agent` | `id`, `prompt`, `model?` | Start an agent with a task (or send message if already running) |
| `send_message` | `id`, `message` | Send input to a running agent (auto-starts idle agents) |
| `stop_agent` | `id` | Terminate a running agent (returns to idle) |
| `remove_agent` | `id` | Permanently delete an agent |
| `wait_for_agent` | `id`, `timeoutSeconds?` (default: 300), `pollIntervalSeconds?` (default: 5) | Poll agent status until completion, error, or waiting state |

#### Messaging Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `send_telegram` | `message` | Send a text message to Telegram (truncates at 4096 chars) |
| `send_slack` | `message` | Send a text message to Slack (truncates at 4000 chars) |

#### Scheduler Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `list_scheduled_tasks` | — | List all recurring tasks with schedule and next run time |
| `create_scheduled_task` | `prompt`, `schedule` (cron), `projectPath`, `autonomous?` (default: true) | Create a recurring task with cron expression |
| `delete_scheduled_task` | `taskId` | Remove a scheduled task and clean up files |
| `run_scheduled_task` | `taskId` | Manually execute a task immediately |
| `get_scheduled_task_logs` | `taskId`, `lines?` (default: 50) | Get execution logs for a task |

#### Automation Tools

| Tool | Parameters | Description |
|------|-----------|-------------|
| `list_automations` | — | List all automations with status, source, schedule |
| `get_automation` | `id` | Get automation details including recent runs |
| `create_automation` | `name`, `sourceType`, `sourceConfig`, + [options](#automation-options) | Create a new automation |
| `update_automation` | `id`, + optional fields | Update automation configuration |
| `delete_automation` | `id` | Remove an automation |
| `run_automation` | `id` | Manually trigger an automation |
| `pause_automation` | `id` | Pause scheduled execution |
| `resume_automation` | `id` | Resume a paused automation |
| `run_due_automations` | — | Check and run all automations that are due |
| `get_automation_logs` | `id`, `limit?` (default: 10) | Get recent execution history |

##### Automation Options

| Parameter | Type | Description |
|-----------|------|-------------|
| `description` | string | What the automation does |
| `sourceType` | enum | `github`, `jira`, `pipedrive`, `twitter`, `rss`, `custom` |
| `sourceConfig` | JSON string | Source configuration (e.g., `{"repos": ["owner/repo"], "pollFor": ["pull_requests"]}`) |
| `scheduleMinutes` | number | Poll interval in minutes (default: 30) |
| `scheduleCron` | string | Cron expression (alternative to scheduleMinutes) |
| `eventTypes` | string[] | Event types to trigger on (e.g., `["pr", "issue"]`) |
| `onNewItem` | boolean | Trigger on new items (default: true) |
| `onUpdatedItem` | boolean | Trigger when items are updated |
| `agentEnabled` | boolean | Enable Claude agent processing (default: true) |
| `agentPrompt` | string | Prompt template with `{{variables}}` |
| `agentProjectPath` | string | Project path for the agent |
| `agentModel` | enum | `sonnet`, `opus`, or `haiku` |
| `outputTelegram` | boolean | Send output to Telegram |
| `outputSlack` | boolean | Send output to Slack |
| `outputGitHubComment` | boolean | Post output as GitHub comment |
| `outputTemplate` | string | Custom output message template |

---

### mcp-telegram

Independent MCP server for rich Telegram messaging with media support.

**Location:** `mcp-telegram/`

| Tool | Parameters | Description |
|------|-----------|-------------|
| `send_telegram` | `message`, `chat_id?` | Send a text message |
| `send_telegram_photo` | `photo_path`, `chat_id?`, `caption?` | Send a photo/image |
| `send_telegram_video` | `video_path`, `chat_id?`, `caption?` | Send a video |
| `send_telegram_document` | `document_path`, `chat_id?`, `caption?` | Send a document/PDF |

- Direct HTTPS API calls to Telegram
- File uploads via multipart form data
- Markdown formatting support

---

### mcp-kanban

MCP server for Kanban task management with agent assignment.

**Location:** `mcp-kanban/`

| Tool | Parameters | Description |
|------|-----------|-------------|
| `list_tasks` | `column?`, `assigned_to_me?` | List tasks, optionally filtered by column or assignment |
| `get_task` | `task_id` (supports prefix matching) | Get full task details |
| `create_task` | `title`, `description`, `project_path?`, `priority?`, `labels?` | Create a new task in backlog |
| `move_task` | `task_id`, `column` | Move task between columns |
| `update_task_progress` | `task_id`, `progress` (0-100) | Update progress percentage |
| `mark_task_done` | `task_id`, `summary` | Complete a task with summary |
| `assign_task` | `task_id`, `agent_id?` | Assign task to an agent |
| `delete_task` | `task_id` | Remove a task |

**Columns:** `backlog` → `planned` → `ongoing` → `done`

---

## Automations

Automations poll external sources, detect new or updated items, and trigger Claude agents to process them with custom prompts.

### Supported Sources

| Source | Status | Polling Method |
|--------|--------|---------------|
| **GitHub** | Active | `gh` CLI — pull requests, issues, releases |
| **JIRA** | Planned | — |
| **Pipedrive** | Planned | — |
| **Twitter** | Planned | — |
| **RSS** | Planned | — |
| **Custom** | Planned | Webhook support |

### How It Works

1. **Scheduler** triggers the automation on its cron schedule or interval
2. **Poller** fetches items from the source (e.g., GitHub PRs via `gh` CLI)
3. **Filter** applies trigger conditions (event type, new vs. updated)
4. **Deduplication** skips already-processed items using content hashing
5. **Agent creation** — a temporary agent is created for each item
6. **Prompt injection** — item data injected via template variables
7. **Agent execution** — agent runs autonomously with MCP tools
8. **Output delivery** — agent sends results via Telegram, Slack, or GitHub comments
9. **Cleanup** — temporary agent is deleted after completion

### Template Variables

Use these in your `agentPrompt` and `outputTemplate`:

| Variable | Description |
|----------|-------------|
| `{{title}}` | Item title (PR title, issue title, etc.) |
| `{{url}}` | Item URL |
| `{{author}}` | Item author |
| `{{body}}` | Item body/description |
| `{{labels}}` | Item labels |
| `{{repo}}` | Repository name |
| `{{number}}` | Item number (PR #, issue #) |
| `{{type}}` | Item type (pull_request, issue, etc.) |

### Example: GitHub PR Marketing Bot

```
create_automation({
  name: "PR Tweet Generator",
  sourceType: "github",
  sourceConfig: '{"repos": ["myorg/myrepo"], "pollFor": ["pull_requests"]}',
  scheduleMinutes: 30,
  agentEnabled: true,
  agentPrompt: "Write a marketing tweet for this PR: {{title}} - {{url}}",
  outputTelegram: true,
  outputGitHubComment: true
})
```

---

## Scheduled Tasks

Create recurring tasks that run Claude Code on a cron schedule.

### Cron Format

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-7, 0 and 7 = Sunday)
│ │ │ │ │
* * * * *
```

### Examples

| Expression | Schedule |
|-----------|----------|
| `0 9 * * *` | Daily at 9:00 AM |
| `0 9 * * 1-5` | Weekdays at 9:00 AM |
| `*/15 * * * *` | Every 15 minutes |
| `0 */2 * * *` | Every 2 hours |
| `30 14 * * 1` | Mondays at 2:30 PM |

### Platform Support

- **macOS**: Uses `launchd` (launchctl) for reliable background execution
- **Linux**: Uses `cron` (crontab)

### Storage

- Task definitions: `~/.claude/schedules.json`
- Generated scripts: `~/.claude-manager/scripts/`
- Execution logs: `~/.claude/logs/`

---

## Kanban Board

A visual task management board integrated with agent assignment and progress tracking.

### Features

- **4 columns**: Backlog → Planned → Ongoing → Done
- **Drag-and-drop** task movement between columns
- **Priority levels**: Low, Medium, High
- **Progress tracking**: 0-100% per task
- **Agent assignment**: Assign tasks to specific agents
- **Labels and tags**: Organize tasks with custom labels
- **Skill requirements**: Define required skills for tasks

### Kanban Automation

The `kanban-automation` service watches for new tasks and:
1. Finds agents with matching skills
2. Auto-creates agents if needed
3. Assigns tasks to agents
4. Updates task progress as agents work

---

## Telegram Integration

Control your agents remotely via Telegram.

### Commands

| Command | Description |
|---------|-------------|
| `/status` | Quick overview of all agents |
| `/agents` | Detailed list of all agents |
| `/projects` | List all projects with their agents |
| `/start_agent <name> <task>` | Create and start an agent with a task |
| `/stop_agent <name>` | Stop a running agent |
| `/ask <message>` | Send a task to the Super Agent |
| `/usage` | Show API usage and cost statistics |
| `/help` | Show available commands |

Send any message without a command to talk directly to the Super Agent.

### Setup

1. Create a bot via [@BotFather](https://t.me/botfather) and copy the token
2. Go to **Settings** in Claude Manager
3. Paste the bot token and save
4. Send `/start` to your bot to register your chat ID
5. Multiple users can authorize by sending `/start`

### Media Support (via MCP)

The `mcp-telegram` server supports sending rich media:
- Photos and images
- Videos
- Documents and PDFs

---

## Slack Integration

Control your agents via Slack with @mentions or direct messages.

### Commands

| Command | Description |
|---------|-------------|
| `status` | Quick overview of all agents |
| `agents` | Detailed list of all agents |
| `projects` | List all projects with their agents |
| `start <name> <task>` | Create and start an agent |
| `stop <name>` | Stop a running agent |
| `usage` | Show API usage and cost statistics |
| `help` | Show available commands |

Send any message without a command to talk directly to the Super Agent.

### Features

- **@mentions** in channels
- **Direct messages** (DMs)
- **Socket Mode** — no public URL required
- **Thread-aware** — replies stay in the same thread

### Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Name it "Claude Manager" and select your workspace
3. **Socket Mode** → Enable → Generate App Token with scope `connections:write` (starts with `xapp-`)
4. **OAuth & Permissions** → Add Bot Token Scopes:
   - `app_mentions:read`, `chat:write`, `im:history`, `im:read`, `im:write`
5. **Install to Workspace** → Copy Bot Token (starts with `xoxb-`)
6. **Event Subscriptions** → Enable → Subscribe to: `app_mention`, `message.im`
7. **App Home** → Enable "Messages Tab" → Check "Allow users to send Slash commands and messages"
8. Paste both tokens in **Settings → Slack** and enable
9. Mention @Claude Manager in any channel or DM the bot

---

## Installation

### Prerequisites

- **Node.js** 18+
- **npm** or yarn
- **Claude Code CLI** installed: `npm install -g @anthropic-ai/claude-code`
- **GitHub CLI** (`gh`) for GitHub automations

### Clone

```bash
git clone https://github.com/your-username/claude-manager.git
cd claude-manager/app/claude-manager
```

### Option 1: Electron App (Recommended)

```bash
# Install dependencies
npm install

# Rebuild native modules for Electron
npx @electron/rebuild

# Development mode
npm run electron:dev

# Production build
npm run electron:build
```

The built app will be in `release/`:
- **macOS**: `release/mac-arm64/claude.mgr.app` (Apple Silicon) or `release/mac/claude.mgr.app` (Intel)
- DMG installer also available

### Option 2: Web Browser (Development)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Some features (agent management, terminal) require the Electron app.

### Option 3: Landing Page

```bash
cd landing
npm install
npm run dev
```

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Electron App                          │
│                                                          │
│  ┌──────────────────┐  ┌─────────────────────────────┐  │
│  │   React/Next.js   │  │    Electron Main Process     │  │
│  │   (Renderer)      │←→│                              │  │
│  │                   │  │  ┌────────────────────────┐  │  │
│  │  - Agents UI      │  │  │   Agent Manager        │  │  │
│  │  - Kanban Board   │  │  │   (node-pty spawning)  │  │  │
│  │  - Automations    │  │  ├────────────────────────┤  │  │
│  │  - Settings       │  │  │   PTY Manager          │  │  │
│  │  - Usage Stats    │  │  │   (terminal sessions)  │  │  │
│  │  - 3D View        │  │  ├────────────────────────┤  │  │
│  │  - Skills         │  │  │   Window Manager       │  │  │
│  │                   │  │  ├────────────────────────┤  │  │
│  └──────────────────┘  │  │   Services:            │  │  │
│         ↕ IPC           │  │   - Telegram Bot       │  │  │
│  ┌──────────────────┐  │  │   - Slack Bot          │  │  │
│  │   API Routes      │  │  │   - API Server         │  │  │
│  │   (Next.js)       │←→│  │   - MCP Launcher      │  │  │
│  └──────────────────┘  │  │   - Kanban Automation  │  │  │
│                         │  └────────────────────────┘  │  │
│                         └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
          ↕ stdio                    ↕ stdio
┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
│ mcp-orchestrator │  │ mcp-telegram │  │  mcp-kanban  │
│ (30+ tools)      │  │ (4 tools)    │  │  (8 tools)   │
└──────────────────┘  └──────────────┘  └──────────────┘
```

### Data Flow: Agent Execution

1. User creates agent → API route → Agent Manager
2. Agent Manager spawns `claude` CLI process via node-pty
3. PTY output streamed in real-time to the renderer via IPC
4. Status detected by parsing output patterns (running/waiting/completed/error)
5. Services notified (Telegram, Slack, Kanban) on status changes
6. Agent state persisted to `~/.claude-manager/agents.json`

### Data Flow: Automation Execution

1. Scheduler triggers automation on schedule
2. Poller fetches items from source (GitHub via `gh` CLI)
3. Filter applies trigger conditions and checks for duplicates
4. Temporary agent created for each new/updated item
5. Prompt injected with item data via template variables
6. Agent runs autonomously with MCP tools available
7. Agent uses MCP tools (send_telegram, etc.) to deliver output
8. Temporary agent deleted after completion
9. Item marked as processed with content hash

### MCP Communication

All MCP servers communicate via **stdio** (standard input/output):

```
Claude Code ←→ stdio ←→ MCP Server
                         ├── Tool handlers (Zod-validated schemas)
                         └── @modelcontextprotocol/sdk
```

---

## Project Structure

```
claude-manager/app/claude-manager/
├── src/                           # Next.js frontend (React)
│   ├── app/                       # Page routes
│   │   ├── agents/                # Agent management UI
│   │   ├── kanban/                # Kanban board UI
│   │   ├── automations/           # Automation management UI
│   │   ├── settings/              # Settings page
│   │   ├── skills/                # Skills management
│   │   ├── usage/                 # Usage statistics
│   │   ├── projects/              # Projects overview
│   │   ├── recurring-tasks/       # Scheduled tasks UI
│   │   ├── plugins/               # Plugin marketplace
│   │   └── api/                   # Backend API routes
│   ├── components/                # React components
│   ├── hooks/                     # Custom React hooks
│   ├── lib/                       # Utility functions
│   ├── store/                     # Zustand state management
│   └── types/                     # TypeScript type definitions
├── electron/                      # Electron main process
│   ├── main.ts                    # Entry point
│   ├── preload.ts                 # Preload script
│   ├── core/                      # Core modules
│   │   ├── agent-manager.ts       # Agent lifecycle management
│   │   ├── pty-manager.ts         # Terminal PTY management
│   │   └── window-manager.ts      # Window management
│   ├── services/                  # External service integrations
│   │   ├── telegram-bot.ts        # Telegram bot integration
│   │   ├── slack-bot.ts           # Slack bot integration
│   │   ├── api-server.ts          # HTTP API server
│   │   ├── mcp-orchestrator.ts    # MCP server launcher
│   │   ├── claude-service.ts      # Claude Code integration
│   │   ├── hooks-manager.ts       # Git hooks management
│   │   └── kanban-automation.ts   # Kanban task automation
│   └── handlers/                  # IPC handlers
├── mcp-orchestrator/              # MCP server (orchestration)
│   └── src/
│       ├── tools/
│       │   ├── agents.ts          # Agent management tools (9 tools)
│       │   ├── messaging.ts       # Telegram/Slack tools (2 tools)
│       │   ├── scheduler.ts       # Scheduled task tools (5 tools)
│       │   └── automations.ts     # Automation tools (10+ tools)
│       └── utils/
├── mcp-telegram/                  # MCP server (Telegram media)
│   └── src/index.ts               # Photo, video, document tools (4 tools)
├── mcp-kanban/                    # MCP server (task management)
│   └── src/index.ts               # Kanban task tools (8 tools)
├── landing/                       # Marketing landing page
├── public/                        # Static assets
└── screenshots/                   # App screenshots
```

---

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| **Framework** | Next.js (App Router) | 16 |
| **Frontend** | React | 19 |
| **Desktop** | Electron | 33 |
| **Styling** | Tailwind CSS | 4 |
| **State** | Zustand | 5 |
| **3D Graphics** | React Three Fiber | 9 |
| **Animations** | Framer Motion | 12 |
| **Terminal** | xterm.js + node-pty | 5 / 1.1 |
| **Database** | better-sqlite3 | 11 |
| **MCP** | @modelcontextprotocol/sdk | 1.0 |
| **Telegram** | node-telegram-bot-api | 0.67 |
| **Slack** | @slack/bolt | 4.0 |
| **Validation** | Zod | 3.22 |
| **Icons** | Lucide React | 0.563 |
| **Language** | TypeScript | 5 |

---

## Configuration & Storage

### Configuration Files

| File | Description |
|------|-------------|
| `~/.claude-manager/app-settings.json` | App settings (Telegram token, Slack tokens, preferences) |
| `~/.claude-manager/cli-paths.json` | CLI tool paths for automations |
| `~/.claude/settings.json` | Claude Code user settings |

### Data Files

| File | Description |
|------|-------------|
| `~/.claude-manager/agents.json` | Persisted agent state |
| `~/.claude-manager/kanban-tasks.json` | Kanban board tasks |
| `~/.claude-manager/automations.json` | Automation definitions |
| `~/.claude-manager/processed-items.json` | Automation processed items tracking |
| `~/.claude/schedules.json` | Scheduled task definitions |

### Generated Files

| Location | Description |
|----------|-------------|
| `~/.claude-manager/scripts/` | Generated task runner scripts |
| `~/.claude/logs/` | Task execution logs |

---

## Development

### Scripts

```bash
# Development
npm run dev              # Start Next.js dev server
npm run electron:dev     # Start Electron in dev mode (concurrent)

# Building
npm run build            # Build Next.js for production
npm run electron:build   # Build distributable Electron app (DMG)
npm run electron:pack    # Pack Electron app (directory only)

# Linting
npm run lint             # Run ESLint
```

### Build Pipeline

1. Next.js production build
2. TypeScript compilation (electron + MCP servers)
3. MCP servers built independently
4. `electron-builder` packages everything into a distributable

### Environment

The app reads Claude Code configuration from:
- `~/.claude/settings.json` — User settings
- `~/.claude/statsig_metadata.json` — Usage statistics
- `~/.claude/projects/` — Project-specific data

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- [Anthropic](https://anthropic.com) for Claude Code
- [skills.sh](https://skills.sh) for the skills ecosystem
- [claude-mem](https://github.com/thedotmack/claude-mem) for persistent memory
- All contributors and users of this project

---

<p align="center">
  Made with care for the Claude Code community
</p>
