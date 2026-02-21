#!/usr/bin/env node
/**
 * MCP server for generative world system
 * Agents create and update game zones that appear in Dorothy's Pokemon-style game
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerZoneTools } from "./tools/zone.js";

const server = new McpServer({
  name: "dorothy-world",
  version: "1.0.0",
});

registerZoneTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP World server running on stdio");
}

main().catch(console.error);
