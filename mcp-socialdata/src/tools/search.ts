import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { socialDataRequest } from "../utils/api.js";

interface Tweet {
  id_str: string;
  full_text: string;
  tweet_created_at: string;
  user: {
    name: string;
    screen_name: string;
    followers_count: number;
  };
  retweet_count: number;
  favorite_count: number;
  reply_count: number;
  views_count: number;
  bookmark_count: number;
  lang: string;
}

function formatTweet(tweet: Tweet): string {
  return [
    `@${tweet.user.screen_name} (${tweet.user.name}) — ${tweet.tweet_created_at}`,
    tweet.full_text,
    `  ❤️ ${tweet.favorite_count}  🔁 ${tweet.retweet_count}  💬 ${tweet.reply_count}  👁 ${tweet.views_count}  🔖 ${tweet.bookmark_count}`,
    `  Tweet ID: ${tweet.id_str}`,
  ].join("\n");
}

export function registerSearchTools(server: McpServer): void {
  server.tool(
    "twitter_search",
    "Search tweets on Twitter/X. Supports Twitter Advanced Search operators like from:user, since:2024-01-01, min_faves:100, filter:images, lang:en, etc. Returns up to ~20 results per page with pagination.",
    {
      query: z
        .string()
        .describe(
          "Search query. Supports Twitter operators: from:user, to:user, since:YYYY-MM-DD, until:YYYY-MM-DD, min_faves:N, min_retweets:N, filter:images, filter:videos, filter:links, lang:en, url:domain.com, etc."
        ),
      type: z
        .enum(["Latest", "Top"])
        .optional()
        .describe("Sort order: 'Latest' (default) for recent tweets, 'Top' for most popular"),
      cursor: z
        .string()
        .optional()
        .describe("Pagination cursor from a previous search result's next_cursor"),
    },
    async ({ query, type, cursor }) => {
      try {
        const params: Record<string, string> = { query };
        if (type) params.type = type;
        if (cursor) params.cursor = cursor;

        const result = (await socialDataRequest("GET", "/twitter/search", params)) as {
          tweets: Tweet[];
          next_cursor: string | null;
        };

        if (!result.tweets || result.tweets.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No tweets found for this search query.",
              },
            ],
          };
        }

        const formatted = result.tweets.map(formatTweet).join("\n\n---\n\n");
        let text = `Found ${result.tweets.length} tweets:\n\n${formatted}`;

        if (result.next_cursor) {
          text += `\n\n📄 More results available. Use cursor: "${result.next_cursor}" to get the next page.`;
        }

        return {
          content: [{ type: "text" as const, text }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error searching tweets: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
