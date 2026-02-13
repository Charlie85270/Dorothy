import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { socialDataRequest } from "../utils/api.js";

interface TweetDetail {
  id_str: string;
  full_text: string;
  tweet_created_at: string;
  source: string;
  user: {
    id_str: string;
    name: string;
    screen_name: string;
    description: string;
    followers_count: number;
    friends_count: number;
    verified: boolean;
    profile_image_url_https: string;
  };
  retweet_count: number;
  favorite_count: number;
  reply_count: number;
  quote_count: number;
  views_count: number;
  bookmark_count: number;
  lang: string;
  in_reply_to_status_id_str: string | null;
  in_reply_to_screen_name: string | null;
  is_pinned: boolean;
  entities: {
    urls?: Array<{ expanded_url: string; display_url: string }>;
    user_mentions?: Array<{ screen_name: string }>;
    hashtags?: Array<{ text: string }>;
    media?: Array<{ type: string; media_url_https: string }>;
  };
}

function formatTweetDetail(tweet: TweetDetail): string {
  const parts: string[] = [
    `Tweet by @${tweet.user.screen_name} (${tweet.user.name})`,
    `Date: ${tweet.tweet_created_at}`,
    `Tweet ID: ${tweet.id_str}`,
    "",
    tweet.full_text,
    "",
    "Engagement:",
    `  ❤️ Likes: ${tweet.favorite_count}`,
    `  🔁 Retweets: ${tweet.retweet_count}`,
    `  💬 Replies: ${tweet.reply_count}`,
    `  🔄 Quotes: ${tweet.quote_count}`,
    `  👁 Views: ${tweet.views_count}`,
    `  🔖 Bookmarks: ${tweet.bookmark_count}`,
  ];

  if (tweet.in_reply_to_screen_name) {
    parts.push(`\nIn reply to: @${tweet.in_reply_to_screen_name} (tweet ${tweet.in_reply_to_status_id_str})`);
  }

  if (tweet.entities.hashtags && tweet.entities.hashtags.length > 0) {
    parts.push(`\nHashtags: ${tweet.entities.hashtags.map((h) => `#${h.text}`).join(" ")}`);
  }

  if (tweet.entities.urls && tweet.entities.urls.length > 0) {
    parts.push(`\nLinks: ${tweet.entities.urls.map((u) => u.expanded_url).join(", ")}`);
  }

  if (tweet.entities.media && tweet.entities.media.length > 0) {
    parts.push(
      `\nMedia: ${tweet.entities.media.map((m) => `${m.type}: ${m.media_url_https}`).join(", ")}`
    );
  }

  if (tweet.entities.user_mentions && tweet.entities.user_mentions.length > 0) {
    parts.push(
      `\nMentions: ${tweet.entities.user_mentions.map((m) => `@${m.screen_name}`).join(", ")}`
    );
  }

  parts.push(
    `\nAuthor: @${tweet.user.screen_name} — ${tweet.user.followers_count.toLocaleString()} followers, ${tweet.user.friends_count.toLocaleString()} following`
  );

  return parts.join("\n");
}

export function registerTweetTools(server: McpServer): void {
  server.tool(
    "twitter_get_tweet",
    "Get full details of a specific tweet by its ID. Returns engagement stats, media, mentions, hashtags, and author info.",
    {
      tweet_id: z
        .string()
        .describe("The numerical tweet ID (e.g. '1729591119699124560')"),
    },
    async ({ tweet_id }) => {
      try {
        const tweet = (await socialDataRequest(
          "GET",
          `/twitter/tweets/${tweet_id}`
        )) as TweetDetail;

        return {
          content: [{ type: "text" as const, text: formatTweetDetail(tweet) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching tweet: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "twitter_get_tweet_comments",
    "Get replies/comments on a specific tweet. Returns up to ~20 comments per page with pagination.",
    {
      tweet_id: z.string().describe("The numerical tweet ID to get comments for"),
      cursor: z
        .string()
        .optional()
        .describe("Pagination cursor from a previous result's next_cursor"),
    },
    async ({ tweet_id, cursor }) => {
      try {
        const params: Record<string, string> = {};
        if (cursor) params.cursor = cursor;

        const result = (await socialDataRequest(
          "GET",
          `/twitter/tweets/${tweet_id}/comments`,
          params
        )) as {
          tweets: TweetDetail[];
          next_cursor: string | null;
        };

        if (!result.tweets || result.tweets.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No comments found for this tweet." },
            ],
          };
        }

        const formatted = result.tweets
          .map(
            (t) =>
              `@${t.user.screen_name}: ${t.full_text}\n  ❤️ ${t.favorite_count}  🔁 ${t.retweet_count}  💬 ${t.reply_count} | ID: ${t.id_str}`
          )
          .join("\n\n");

        let text = `${result.tweets.length} comments:\n\n${formatted}`;

        if (result.next_cursor) {
          text += `\n\n📄 More comments available. Use cursor: "${result.next_cursor}"`;
        }

        return {
          content: [{ type: "text" as const, text }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching comments: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
