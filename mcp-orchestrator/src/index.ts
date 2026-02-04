#!/usr/bin/env node

/**
 * Claude Manager Orchestrator MCP Server
 *
 * Provides tools for:
 * - Agent management (create, start, stop, monitor)
 * - Messaging (Telegram, Slack)
 * - Scheduler (create, delete, run recurring tasks)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerAgentTools, registerMessagingTools, registerSchedulerTools, registerAutomationTools } from "./tools/index.js";

// Create MCP server
const server = new McpServer({
  name: "claude-mgr-orchestrator",
  version: "1.0.0",
});

// Register all tool categories
registerAgentTools(server);
registerMessagingTools(server);
registerSchedulerTools(server);
registerAutomationTools(server);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Claude Manager Orchestrator MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
