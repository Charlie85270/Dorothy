#!/usr/bin/env node
/**
 * MCP server for Vault document management
 * Available to all Claude agents for creating, reading, and searching documents
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerDocumentTools } from "./tools/documents.js";
import { registerFolderTools } from "./tools/folders.js";
import { registerSearchTools } from "./tools/search.js";

// Create MCP server
const server = new McpServer({
  name: "claude-mgr-vault",
  version: "1.0.0",
});

// Register all tools
registerDocumentTools(server);
registerFolderTools(server);
registerSearchTools(server);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Vault server running on stdio");
}

main().catch(console.error);
