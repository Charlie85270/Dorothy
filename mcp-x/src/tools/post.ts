import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { xApiRequest } from "../utils/api.js";

export function registerPostTools(server: McpServer): void {
  // Post a new tweet
  server.tool(
    "x_post_tweet",
    "Post a new tweet on X (Twitter). The tweet text must be 280 characters or less.",
    {
      text: z
        .string()
        .max(280)
        .describe("The text content of the tweet (max 280 characters)"),
      quote_tweet_id: z
        .string()
        .optional()
        .describe("Optional tweet ID to quote-tweet"),
    },
    async ({ text, quote_tweet_id }) => {
      try {
        const body: Record<string, unknown> = { text };
        if (quote_tweet_id) {
          body.quote_tweet_id = quote_tweet_id;
        }

        const result = (await xApiRequest("POST", "/2/tweets", body)) as {
          data?: { id: string; text: string };
        };

        if (result.data) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Tweet posted successfully!\n\nID: ${result.data.id}\nText: ${result.data.text}\nURL: https://x.com/i/status/${result.data.id}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Tweet posted. Response: ${JSON.stringify(result)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error posting tweet: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Reply to a tweet
  server.tool(
    "x_reply_tweet",
    "Reply to an existing tweet on X (Twitter).",
    {
      text: z
        .string()
        .max(280)
        .describe("The reply text (max 280 characters)"),
      reply_to_id: z
        .string()
        .describe("The ID of the tweet to reply to"),
    },
    async ({ text, reply_to_id }) => {
      try {
        const body: Record<string, unknown> = {
          text,
          reply: {
            in_reply_to_tweet_id: reply_to_id,
          },
        };

        const result = (await xApiRequest("POST", "/2/tweets", body)) as {
          data?: { id: string; text: string };
        };

        if (result.data) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Reply posted successfully!\n\nID: ${result.data.id}\nText: ${result.data.text}\nURL: https://x.com/i/status/${result.data.id}`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Reply posted. Response: ${JSON.stringify(result)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error replying to tweet: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Delete a tweet
  server.tool(
    "x_delete_tweet",
    "Delete a tweet by its ID. You can only delete tweets you own.",
    {
      tweet_id: z.string().describe("The ID of the tweet to delete"),
    },
    async ({ tweet_id }) => {
      try {
        const result = (await xApiRequest(
          "DELETE",
          `/2/tweets/${tweet_id}`
        )) as {
          data?: { deleted: boolean };
        };

        if (result.data?.deleted) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Tweet ${tweet_id} deleted successfully.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Delete response: ${JSON.stringify(result)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error deleting tweet: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
