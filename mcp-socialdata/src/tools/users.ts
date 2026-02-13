import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { socialDataRequest } from "../utils/api.js";

interface UserProfile {
  id_str: string;
  name: string;
  screen_name: string;
  description: string;
  location: string;
  url: string | null;
  protected: boolean;
  verified: boolean;
  followers_count: number;
  friends_count: number;
  listed_count: number;
  favourites_count: number;
  statuses_count: number;
  created_at: string;
  profile_banner_url: string;
  profile_image_url_https: string;
  can_dm: boolean;
}

interface UserTweet {
  id_str: string;
  full_text: string;
  tweet_created_at: string;
  user: {
    name: string;
    screen_name: string;
  };
  retweet_count: number;
  favorite_count: number;
  reply_count: number;
  views_count: number;
}

function formatUserProfile(user: UserProfile): string {
  const parts: string[] = [
    `${user.name} (@${user.screen_name})`,
    `User ID: ${user.id_str}`,
    "",
    user.description || "(no bio)",
    "",
    `📍 Location: ${user.location || "Not specified"}`,
    `🔗 URL: ${user.url || "None"}`,
    `📅 Joined: ${user.created_at}`,
    "",
    `👥 Followers: ${user.followers_count.toLocaleString()}`,
    `👤 Following: ${user.friends_count.toLocaleString()}`,
    `📝 Tweets: ${user.statuses_count.toLocaleString()}`,
    `❤️ Likes: ${user.favourites_count.toLocaleString()}`,
    `📋 Listed: ${user.listed_count.toLocaleString()}`,
    "",
    `Protected: ${user.protected ? "Yes" : "No"}`,
    `Verified: ${user.verified ? "Yes" : "No"}`,
    `Can DM: ${user.can_dm ? "Yes" : "No"}`,
  ];

  return parts.join("\n");
}

export function registerUserTools(server: McpServer): void {
  server.tool(
    "twitter_get_user",
    "Get a Twitter/X user's profile by username. Returns bio, follower counts, join date, and other profile information.",
    {
      username: z
        .string()
        .describe("Twitter username without the @ symbol (e.g. 'elonmusk')"),
    },
    async ({ username }) => {
      try {
        // Strip @ if accidentally included
        const cleanUsername = username.replace(/^@/, "");
        const user = (await socialDataRequest(
          "GET",
          `/twitter/user/${cleanUsername}`
        )) as UserProfile;

        return {
          content: [{ type: "text" as const, text: formatUserProfile(user) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching user profile: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "twitter_get_user_tweets",
    "Get recent tweets from a Twitter/X user by their user ID. Returns up to ~20 tweets per page with pagination.",
    {
      user_id: z
        .string()
        .describe(
          "The numerical user ID (get this from twitter_get_user first). E.g. '44196397' for Elon Musk."
        ),
      include_replies: z
        .boolean()
        .optional()
        .describe("If true, includes replies in addition to tweets. Default: false (tweets only)."),
      cursor: z
        .string()
        .optional()
        .describe("Pagination cursor from a previous result's next_cursor"),
    },
    async ({ user_id, include_replies, cursor }) => {
      try {
        const endpoint = include_replies
          ? `/twitter/user/${user_id}/tweets-and-replies`
          : `/twitter/user/${user_id}/tweets`;

        const params: Record<string, string> = {};
        if (cursor) params.cursor = cursor;

        const result = (await socialDataRequest("GET", endpoint, params)) as {
          tweets: UserTweet[];
          next_cursor: string | null;
        };

        if (!result.tweets || result.tweets.length === 0) {
          return {
            content: [
              { type: "text" as const, text: "No tweets found for this user." },
            ],
          };
        }

        const formatted = result.tweets
          .map(
            (t) =>
              `@${t.user.screen_name} — ${t.tweet_created_at}\n${t.full_text}\n  ❤️ ${t.favorite_count}  🔁 ${t.retweet_count}  💬 ${t.reply_count}  👁 ${t.views_count} | ID: ${t.id_str}`
          )
          .join("\n\n---\n\n");

        let text = `${result.tweets.length} tweets:\n\n${formatted}`;

        if (result.next_cursor) {
          text += `\n\n📄 More tweets available. Use cursor: "${result.next_cursor}"`;
        }

        return {
          content: [{ type: "text" as const, text }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching user tweets: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
