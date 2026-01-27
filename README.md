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

### ⚙️ Settings Management
Configure your Claude Code settings directly from the app. Manage permissions, environment variables, hooks, and more.

### 🌐 3D Agent View
Watch your agents work in a beautiful 3D office environment with animated characters.

![3D View](screenshots/3d.png)

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
│   │   └── skills/        # Skills management
│   ├── components/        # React components
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Utilities
│   ├── store/             # Zustand stores
│   └── types/             # TypeScript types
├── electron/              # Electron main process
│   ├── main.ts            # Main process entry
│   └── preload.ts         # Preload script
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
