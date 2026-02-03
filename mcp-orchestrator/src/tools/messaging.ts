/**
 * Messaging tools (Telegram, Slack) for the MCP server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest } from "../utils/api.js";

export function registerMessagingTools(server: McpServer): void {
  // Tool: Send message to Telegram
  server.tool(
    "send_telegram",
    "Send a message to Telegram. Use this to respond to the user when the request came from Telegram.",
    {
      message: z.string().describe("The message to send to Telegram"),
    },
    async ({ message }) => {
      try {
        await apiRequest("/api/telegram/send", "POST", { message });
        return {
          content: [
            {
              type: "text",
              text: `Message sent to Telegram: "${message.slice(0, 100)}${message.length > 100 ? "..." : ""}"`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error sending to Telegram: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Tool: Send message to Slack
  server.tool(
    "send_slack",
    "Send a message to Slack. Use this to respond to the user when the request came from Slack.",
    {
      message: z.string().describe("The message to send to Slack"),
    },
    async ({ message }) => {
      try {
        await apiRequest("/api/slack/send", "POST", { message });
        return {
          content: [
            {
              type: "text",
              text: `Message sent to Slack: "${message.slice(0, 100)}${message.length > 100 ? "..." : ""}"`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error sending to Slack: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
