# Claude Manager Orchestrator MCP Server

An MCP (Model Context Protocol) server that allows Claude to manage other Claude agents in the Claude Manager app.

## Installation

```bash
cd mcp-orchestrator
npm install
npm run build
```

## Configuration

Add to your Claude Code MCP settings (`~/.claude/mcp.json`):

```json
{
  "mcpServers": {
    "claude-mgr-orchestrator": {
      "command": "node",
      "args": ["/path/to/dorothy/mcp-orchestrator/dist/index.js"]
    }
  }
}
```

Or for development:

```json
{
  "mcpServers": {
    "claude-mgr-orchestrator": {
      "command": "npx",
      "args": ["tsx", "/path/to/dorothy/mcp-orchestrator/src/index.ts"]
    }
  }
}
```

## Requirements

The Claude Manager Electron app must be running for the MCP server to work. It exposes a local API on port 31415.

## Available Tools

### `list_agents`
List all agents and their current status.

### `get_agent`
Get detailed information about a specific agent.
- `id`: The agent ID

### `get_agent_output`
Get the recent terminal output from an agent.
- `id`: The agent ID
- `lines`: Number of lines to retrieve (default: 100)

### `create_agent`
Create a new agent for a specific project.
- `projectPath`: Absolute path to the project directory
- `name`: Name for the agent (optional)
- `skills`: List of skill names to enable (optional)
- `character`: Visual character (optional)
- `skipPermissions`: Run with --dangerously-skip-permissions (optional)
- `secondaryProjectPath`: Additional project context (optional)

### `start_agent`
Start an agent with a specific task/prompt.
- `id`: The agent ID
- `prompt`: The task or instruction
- `model`: Optional model to use

### `stop_agent`
Stop a running agent.
- `id`: The agent ID

### `send_message`
Send input to an agent waiting for input.
- `id`: The agent ID
- `message`: The message to send

### `remove_agent`
Permanently remove an agent.
- `id`: The agent ID

### `wait_for_agent`
Poll an agent's status until it completes or errors.
- `id`: The agent ID
- `timeoutSeconds`: Maximum wait time (default: 300)
- `pollIntervalSeconds`: Poll interval (default: 5)

## Example Usage

When configured, the Super Agent can:

```
"Create 3 agents for my project at /Users/me/myapp:
1. Backend agent to refactor the API
2. Frontend agent to update the UI
3. Test agent to write tests

Start them in sequence, waiting for each to complete before starting the next."
```

The orchestrator will use the tools to create, start, monitor, and coordinate the agents.
