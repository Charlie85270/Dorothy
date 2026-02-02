# claude.mgr

A beautiful desktop manager for [Claude Code](https://claude.ai/code) - the AI coding assistant by Anthropic. Monitor your agents, manage skills, track usage, and visualize your Claude Code activity all in one place.

![claude.mgr Dashboard](screenshots/0.png)

## Features

### 🎨 Beautiful Dashboard
Manage your agents like never before with a simple and UX friendly UI. Get notified when your agent task is done or needs your input.

### 🤖 Agent Management
Create, monitor, and control multiple Claude Code agents simultaneously. Each agent runs in its own terminal with full PTY support, allowing you to interact with them in real-time.

![Agents View](screenshots/agetns.png)

### 📊 Usage Statistics
Track your Claude Code usage with detailed statistics. View your conversation history, token usage, and activity patterns with beautiful visualizations.

![Usage Stats](screenshots/stats.png)

### 🧩 Skills & Plugins
Browse and manage your Claude Code skills. Directly integrated with [skills.sh](https://skills.sh) - the most popular skills library for AI agents.

![Skills Management](screenshots/skills.png)

### 🔌 Plugin Marketplace
Discover and install official Claude Code plugins directly from the app. Browse plugins by category:

- **Code Intelligence**: LSP plugins for TypeScript, Python, Rust, Go, and more
- **External Integrations**: GitHub, GitLab, Jira, Figma, Slack, Vercel, and other services
- **Development Workflows**: Commit commands, PR review tools, and more
- **Output Styles**: Customize how Claude responds

Filter by category or marketplace source, search by name or tags, and install with one click.

### ⚙️ Settings Management
Configure your Claude Code settings directly from the app. Manage permissions, environment variables, hooks, and more.

### 🌐 3D Agent View
Watch your agents work in a beautiful 3D office environment with animated characters.

![3D View](screenshots/3d.png)

### 👑 Super Agent (Orchestrator)
The Super Agent is a powerful orchestrator that can manage and coordinate all your other agents. Give it high-level tasks and it will delegate work to the appropriate agents, monitor their progress, and report back to you.

![Super Agent](screenshots/super-agent.png)

- Automatically coordinates multiple agents
- Delegates tasks based on agent capabilities
- Monitors progress and handles errors
- Uses MCP tools to control other agents

### 🔌 MCP Server Integration
Claude Manager includes a built-in MCP (Model Context Protocol) server that allows the Super Agent to control other agents programmatically.

Available MCP tools:
- `list_agents` - List all agents with their status
- `get_agent_output` - Read an agent's terminal output
- `start_agent` - Start an agent with a task
- `send_message` - Send a message to an agent
- `stop_agent` - Stop a running agent
- `create_agent` - Create a new agent
- `remove_agent` - Delete an agent
- `send_telegram` - Send messages to Telegram
- `send_slack` - Send messages to Slack

### 🧠 Persistent Memory with claude-mem
Enable persistent memory for all your Claude Code sessions! Powered by [claude-mem](https://github.com/thedotmack/claude-mem), agents can recall past decisions, learnings, and context across sessions.

- **One-click activation** - Enable memory from the Settings page
- **Automatic memory capture** - Tool uses, decisions, and learnings are stored automatically
- **Cross-session context** - Agents remember what they learned in previous sessions
- **Smart compression** - AI-powered summarization keeps memories efficient
- **Works everywhere** - Memory works across all Claude Code sessions, not just claude.mgr

### 📱 Telegram Bot Integration
Control your agents remotely via Telegram! Connect your Telegram bot and manage your agents from anywhere.

**Available Commands:**
- `/status` - Quick overview of all agents
- `/agents` - Detailed list of all agents
- `/projects` - List all projects with their agents
- `/start_agent <name> <task>` - Start an agent with a task
- `/stop_agent <name>` - Stop a running agent
- `/ask <message>` - Send a message to Super Agent
- `/usage` - Show API usage and cost statistics
- `/help` - Show all available commands

Or just send a message to talk directly to the Super Agent!

**File Support:** Send images, PDFs, documents, audio, video, or voice messages - the Super Agent can read and analyze them!

**Setup:**
1. Create a Telegram bot via [@BotFather](https://t.me/botfather)
2. Copy the bot token
3. Go to Settings in Claude Manager
4. Paste your bot token and save
5. Send `/start` to your bot to connect

### 💬 Slack Bot Integration
Control your agents remotely via Slack! Connect your Slack app and manage your agents from any channel or DM.

**Available Commands (via @mention or DM):**
- `status` - Quick overview of all agents
- `agents` - Detailed list of all agents
- `projects` - List all projects with their agents
- `start <name> <task>` - Start an agent with a task
- `stop <name>` - Stop a running agent
- `usage` - Show API usage and cost statistics
- `help` - Show all available commands

Or just send a message to talk directly to the Super Agent!

**File Support:** Send images, PDFs, documents, or any files with your message - the Super Agent can read and analyze them!

**Setup:**
1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click "Create New App"
2. Choose "From scratch", name it "Claude Manager", select workspace
3. Go to "Socket Mode" → Enable → Generate App Token with scope `connections:write` (xapp-...)
4. Go to "OAuth & Permissions" → Add Bot Token Scopes:
   - `app_mentions:read`, `chat:write`, `im:history`, `im:read`, `im:write`, `files:read`
5. Install to Workspace → Copy Bot Token (xoxb-...)
6. Go to "Event Subscriptions" → Enable → Subscribe to: `app_mention`, `message.im`
7. Go to "App Home" → Enable "Messages Tab" → Check "Allow users to send Slash commands and messages from the messages tab"
8. Paste both tokens in Settings → Slack and enable the integration
9. Mention @Claude Manager in any channel or DM the bot to start!

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- Claude Code CLI installed (`npm install -g @anthropic-ai/claude-code`)

### Clone the Repository

```bash
git clone https://github.com/your-username/claude-manager.git
cd claude-manager
```

## Running the App

### Option 1: Web Browser (Development)

Run the app in your browser for development:

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> **Note:** Some features like agent management and terminal access require the Electron app to work fully.

### Option 2: Electron App (Recommended)

Run as a native desktop application with full functionality:

#### Development Mode

```bash
# Install dependencies
npm install

# Rebuild native modules for Electron
npx @electron/rebuild

# Start in development mode
npm run electron:dev
```

#### Build for Production

```bash
# Build the Electron app
npm run electron:build
```

The built app will be in `release/`:
- **macOS**: `release/mac-arm64/claude.mgr.app` (Apple Silicon) or `release/mac/claude.mgr.app` (Intel)
- DMG installer also available in the release folder

### Option 3: Landing Page

To run the marketing landing page:

```bash
cd landing

# Install dependencies
npm install

# Start the development server
npm run dev
```

## Project Structure

```
claude-manager/
├── src/
│   ├── app/               # Next.js pages
│   │   ├── agents/        # Agent management
│   │   ├── chats/         # Chat history
│   │   ├── projects/      # Projects overview
│   │   ├── settings/      # Settings page
│   │   ├── skills/        # Skills management
│   │   └── usage/         # Usage statistics
│   ├── components/        # React components
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Utilities
│   ├── store/             # Zustand stores
│   └── types/             # TypeScript types
├── electron/              # Electron main process
│   ├── main.ts            # Main process entry
│   └── preload.ts         # Preload script
├── mcp-orchestrator/      # MCP server for Super Agent
│   └── src/index.ts       # MCP tools implementation
├── landing/               # Marketing landing page
├── public/                # Static assets
└── screenshots/           # App screenshots
```

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) with App Router
- **Desktop**: [Electron](https://www.electronjs.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **3D Graphics**: [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Terminal**: [xterm.js](https://xtermjs.org/) with node-pty
- **Icons**: [Lucide React](https://lucide.dev/)

## Features in Detail

### Agent Management
- Create agents with custom configurations
- Assign skills to agents
- Optional git worktree support for isolated development
- Real-time terminal output with full PTY support
- Send input to running agents
- Stop/restart agents

### Skills Integration
- View all installed skills (user, plugin, project)
- Direct integration with [skills.sh](https://skills.sh)
- Install new skills from GitHub repositories
- Interactive installation with terminal output

### Usage Tracking
- View total conversations and messages
- Track token usage over time
- See recent activity history
- Visualize usage patterns

### Settings
- Manage Claude Code permissions (allow/deny lists)
- Configure environment variables
- Set up hooks
- Toggle Git co-authored-by messages
- View system information

### Super Agent & MCP
- Orchestrate multiple agents from a single command
- Built-in MCP server for programmatic control
- Automatic task delegation and monitoring
- Real-time status updates across all agents

### Telegram Integration
- Remote agent control via Telegram bot
- Status monitoring on the go
- Start/stop agents from anywhere
- Direct communication with Super Agent
- Autonomous task execution for remote requests

### Slack Integration
- Remote agent control via Slack app
- Works with @mentions and direct messages
- Same commands as Telegram
- Thread-aware responses (replies in the same conversation)
- Socket Mode for easy setup (no public URL required)

## Development

### Scripts

```bash
# Development
npm run dev              # Start Next.js dev server
npm run electron:dev     # Start Electron in dev mode

# Building
npm run build            # Build Next.js
npm run electron:build   # Build Electron app for distribution
npm run electron:pack    # Pack Electron app (no installer)

# Linting
npm run lint             # Run ESLint
```

### Environment

The app reads Claude Code configuration from:
- `~/.claude/settings.json` - User settings
- `~/.claude/statsig_metadata.json` - Usage statistics
- `~/.claude/projects/` - Project-specific data

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
- [skills.sh](https://skills.sh) for the amazing skills ecosystem
- All contributors and users of this project

---

<p align="center">
  Made with ❤️ for the Claude Code community
</p>
