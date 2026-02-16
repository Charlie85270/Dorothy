#!/usr/bin/env node
/**
 * MCP server for posting tweets via X API v2 (OAuth 1.0a)
 * Available to all Claude agents for publishing content on X/Twitter.
 *
 * Credentials are read from ~/.dorothy/app-settings.json:
 *   xApiKey, xApiSecret, xAccessToken, xAccessTokenSecret
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerPostTools } from "./tools/post.js";

// Create MCP server
const server = new McpServer({
  name: "dorothy-x",
  version: "1.0.0",
});

// Register all tools
registerPostTools(server);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP X server running on stdio");
}

main().catch(console.error);
