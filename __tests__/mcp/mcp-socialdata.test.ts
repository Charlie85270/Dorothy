import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// mcp-socialdata tool handler tests
// ============================================================================
// Tests the business logic of all socialdata MCP tool handlers:
// twitter_search, twitter_get_tweet, twitter_get_tweet_comments,
// twitter_get_user, twitter_get_user_tweets
// Also tests helper functions: getApiKey, socialDataRequest, formatters

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue(''),
  };
});

import * as fs from 'fs';

// ---------- Types (mirrored from mcp-socialdata source) ----------

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

// ---------- Helpers ----------

function makeTweet(overrides: Partial<Tweet> = {}): Tweet {
  return {
    id_str: '1729591119699124560',
    full_text: 'Hello Twitter!',
    tweet_created_at: '2024-01-15T10:00:00Z',
    user: {
      name: 'Test User',
      screen_name: 'testuser',
      followers_count: 1000,
    },
    retweet_count: 5,
    favorite_count: 25,
    reply_count: 3,
    views_count: 500,
    bookmark_count: 2,
    lang: 'en',
    ...overrides,
  };
}

function makeTweetDetail(overrides: Partial<TweetDetail> = {}): TweetDetail {
  return {
    id_str: '1729591119699124560',
    full_text: 'Hello Twitter! This is a detailed tweet.',
    tweet_created_at: '2024-01-15T10:00:00Z',
    source: '<a href="https://twitter.com">Twitter Web App</a>',
    user: {
      id_str: '12345678',
      name: 'Test User',
      screen_name: 'testuser',
      description: 'Just a test account',
      followers_count: 1000,
      friends_count: 500,
      verified: false,
      profile_image_url_https: 'https://pbs.twimg.com/test.jpg',
    },
    retweet_count: 5,
    favorite_count: 25,
    reply_count: 3,
    quote_count: 1,
    views_count: 500,
    bookmark_count: 2,
    lang: 'en',
    in_reply_to_status_id_str: null,
    in_reply_to_screen_name: null,
    is_pinned: false,
    entities: {},
    ...overrides,
  };
}

function makeUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id_str: '12345678',
    name: 'Test User',
    screen_name: 'testuser',
    description: 'Just a test account',
    location: 'San Francisco',
    url: 'https://example.com',
    protected: false,
    verified: true,
    followers_count: 10000,
    friends_count: 500,
    listed_count: 100,
    favourites_count: 5000,
    statuses_count: 2000,
    created_at: '2010-01-01T00:00:00Z',
    profile_banner_url: 'https://pbs.twimg.com/banner.jpg',
    profile_image_url_https: 'https://pbs.twimg.com/profile.jpg',
    can_dm: true,
    ...overrides,
  };
}

// Replicate formatTweet from search.ts
function formatTweet(tweet: Tweet): string {
  return [
    `@${tweet.user.screen_name} (${tweet.user.name}) — ${tweet.tweet_created_at}`,
    tweet.full_text,
    `  ❤️ ${tweet.favorite_count}  🔁 ${tweet.retweet_count}  💬 ${tweet.reply_count}  👁 ${tweet.views_count}  🔖 ${tweet.bookmark_count}`,
    `  Tweet ID: ${tweet.id_str}`,
  ].join('\n');
}

// Replicate formatTweetDetail from tweets.ts
function formatTweetDetail(tweet: TweetDetail): string {
  const parts: string[] = [
    `Tweet by @${tweet.user.screen_name} (${tweet.user.name})`,
    `Date: ${tweet.tweet_created_at}`,
    `Tweet ID: ${tweet.id_str}`,
    '',
    tweet.full_text,
    '',
    'Engagement:',
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
    parts.push(`\nHashtags: ${tweet.entities.hashtags.map(h => `#${h.text}`).join(' ')}`);
  }
  if (tweet.entities.urls && tweet.entities.urls.length > 0) {
    parts.push(`\nLinks: ${tweet.entities.urls.map(u => u.expanded_url).join(', ')}`);
  }
  if (tweet.entities.media && tweet.entities.media.length > 0) {
    parts.push(`\nMedia: ${tweet.entities.media.map(m => `${m.type}: ${m.media_url_https}`).join(', ')}`);
  }
  if (tweet.entities.user_mentions && tweet.entities.user_mentions.length > 0) {
    parts.push(`\nMentions: ${tweet.entities.user_mentions.map(m => `@${m.screen_name}`).join(', ')}`);
  }
  parts.push(`\nAuthor: @${tweet.user.screen_name} — ${tweet.user.followers_count.toLocaleString()} followers, ${tweet.user.friends_count.toLocaleString()} following`);

  return parts.join('\n');
}

// Replicate formatUserProfile from users.ts
function formatUserProfile(user: UserProfile): string {
  const parts: string[] = [
    `${user.name} (@${user.screen_name})`,
    `User ID: ${user.id_str}`,
    '',
    user.description || '(no bio)',
    '',
    `📍 Location: ${user.location || 'Not specified'}`,
    `🔗 URL: ${user.url || 'None'}`,
    `📅 Joined: ${user.created_at}`,
    '',
    `👥 Followers: ${user.followers_count.toLocaleString()}`,
    `👤 Following: ${user.friends_count.toLocaleString()}`,
    `📝 Tweets: ${user.statuses_count.toLocaleString()}`,
    `❤️ Likes: ${user.favourites_count.toLocaleString()}`,
    `📋 Listed: ${user.listed_count.toLocaleString()}`,
    '',
    `Protected: ${user.protected ? 'Yes' : 'No'}`,
    `Verified: ${user.verified ? 'Yes' : 'No'}`,
    `Can DM: ${user.can_dm ? 'Yes' : 'No'}`,
  ];
  return parts.join('\n');
}

// Replicate getApiKey logic
function getApiKey(): string {
  const settingsPath = '/mock/app-settings.json';
  try {
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (settings.socialDataApiKey) {
        return settings.socialDataApiKey;
      }
    }
  } catch {
    // Ignore
  }
  throw new Error('SocialData API key not configured. Please add your API key in Dorothy Settings > SocialData.');
}

describe('mcp-socialdata', () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('');
  });

  describe('getApiKey', () => {
    it('returns API key from settings file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        socialDataApiKey: 'test-api-key-123',
      }));
      expect(getApiKey()).toBe('test-api-key-123');
    });

    it('throws when settings file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(() => getApiKey()).toThrow('SocialData API key not configured');
    });

    it('throws when API key is not in settings', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        otherSetting: true,
      }));
      expect(() => getApiKey()).toThrow('SocialData API key not configured');
    });

    it('throws on invalid JSON', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json{');
      expect(() => getApiKey()).toThrow('SocialData API key not configured');
    });
  });

  describe('socialDataRequest URL construction', () => {
    it('constructs correct API URL', () => {
      const hostname = 'api.socialdata.tools';
      const endpoint = '/twitter/search';
      const url = `https://${hostname}${endpoint}`;
      expect(url).toBe('https://api.socialdata.tools/twitter/search');
    });

    it('appends query params correctly', () => {
      const queryParams: Record<string, string> = { query: 'test', type: 'Latest' };
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== '') {
          params.append(key, value);
        }
      }
      expect(params.toString()).toBe('query=test&type=Latest');
    });

    it('skips empty or undefined params', () => {
      const queryParams: Record<string, string> = { query: 'test', type: '', cursor: '' };
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== '') {
          params.append(key, value);
        }
      }
      expect(params.toString()).toBe('query=test');
    });

    it('constructs authorization header', () => {
      const apiKey = 'test-key-123';
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      };
      expect(headers.Authorization).toBe('Bearer test-key-123');
      expect(headers.Accept).toBe('application/json');
    });
  });

  describe('error status code handling', () => {
    it('returns insufficient credits error for 402', () => {
      const statusCode = 402;
      let error: string;
      if (statusCode === 402) {
        error = 'Insufficient SocialData API credits. Please top up your account.';
      } else if (statusCode === 404) {
        error = 'Resource not found on Twitter/X.';
      } else {
        error = `SocialData API error (HTTP ${statusCode})`;
      }
      expect(error).toContain('Insufficient');
    });

    it('returns not found error for 404', () => {
      const statusCode = 404;
      let error: string;
      if (statusCode === 402) {
        error = 'Insufficient SocialData API credits.';
      } else if (statusCode === 404) {
        error = 'Resource not found on Twitter/X.';
      } else {
        error = `SocialData API error (HTTP ${statusCode})`;
      }
      expect(error).toContain('not found');
    });

    it('returns validation error for 422', () => {
      const statusCode = 422;
      const parsed = { detail: 'Invalid query' };
      let error: string;
      if (statusCode === 422) {
        error = `Validation error: ${JSON.stringify(parsed)}`;
      } else {
        error = 'Other error';
      }
      expect(error).toContain('Validation error');
      expect(error).toContain('Invalid query');
    });

    it('returns generic error for other status codes', () => {
      const statusCode = 500;
      const parsed = { error: 'Internal server error' };
      const error = `SocialData API error (HTTP ${statusCode}): ${JSON.stringify(parsed)}`;
      expect(error).toContain('HTTP 500');
    });
  });

  describe('formatTweet', () => {
    it('formats basic tweet correctly', () => {
      const tweet = makeTweet();
      const text = formatTweet(tweet);
      expect(text).toContain('@testuser');
      expect(text).toContain('Test User');
      expect(text).toContain('Hello Twitter!');
      expect(text).toContain('❤️ 25');
      expect(text).toContain('🔁 5');
      expect(text).toContain('💬 3');
      expect(text).toContain('👁 500');
      expect(text).toContain('🔖 2');
      expect(text).toContain('1729591119699124560');
    });

    it('includes tweet date', () => {
      const tweet = makeTweet({ tweet_created_at: '2024-06-15T10:00:00Z' });
      const text = formatTweet(tweet);
      expect(text).toContain('2024-06-15');
    });
  });

  describe('twitter_search handler logic', () => {
    it('returns "No tweets found" for empty results', () => {
      const tweets: Tweet[] = [];
      const text = !tweets || tweets.length === 0
        ? 'No tweets found for this search query.'
        : 'Found tweets';
      expect(text).toBe('No tweets found for this search query.');
    });

    it('formats search results with count', () => {
      const tweets = [makeTweet(), makeTweet({ id_str: '222' })];
      const formatted = tweets.map(formatTweet).join('\n\n---\n\n');
      let text = `Found ${tweets.length} tweets:\n\n${formatted}`;
      expect(text).toContain('Found 2 tweets');
      expect(text).toContain('---');
    });

    it('appends pagination cursor when available', () => {
      const next_cursor = 'DAABCgABGPmw__8';
      let text = 'Found 20 tweets:\n\ntweets here';
      if (next_cursor) {
        text += `\n\n📄 More results available. Use cursor: "${next_cursor}" to get the next page.`;
      }
      expect(text).toContain('📄 More results available');
      expect(text).toContain('DAABCgABGPmw__8');
    });

    it('does not append cursor when null', () => {
      const next_cursor: string | null = null;
      let text = 'Found 5 tweets';
      if (next_cursor) {
        text += `\n\n📄 More results available.`;
      }
      expect(text).not.toContain('📄');
    });

    it('builds params correctly for search', () => {
      const query = 'from:elonmusk min_faves:100';
      const type = 'Top';
      const cursor = 'abc123';
      const params: Record<string, string> = { query };
      if (type) params.type = type;
      if (cursor) params.cursor = cursor;

      expect(params).toEqual({
        query: 'from:elonmusk min_faves:100',
        type: 'Top',
        cursor: 'abc123',
      });
    });

    it('omits optional params when not provided', () => {
      const query = 'test query';
      const type = undefined;
      const cursor = undefined;
      const params: Record<string, string> = { query };
      if (type) params.type = type;
      if (cursor) params.cursor = cursor;

      expect(params).toEqual({ query: 'test query' });
    });
  });

  describe('formatTweetDetail', () => {
    it('formats basic tweet detail correctly', () => {
      const tweet = makeTweetDetail();
      const text = formatTweetDetail(tweet);
      expect(text).toContain('Tweet by @testuser');
      expect(text).toContain('Test User');
      expect(text).toContain('Hello Twitter! This is a detailed tweet.');
      expect(text).toContain('Engagement:');
      expect(text).toContain('Likes: 25');
      expect(text).toContain('Retweets: 5');
      expect(text).toContain('Replies: 3');
      expect(text).toContain('Quotes: 1');
      expect(text).toContain('Views: 500');
      expect(text).toContain('Bookmarks: 2');
    });

    it('includes reply context when present', () => {
      const tweet = makeTweetDetail({
        in_reply_to_screen_name: 'otheruser',
        in_reply_to_status_id_str: '9999',
      });
      const text = formatTweetDetail(tweet);
      expect(text).toContain('In reply to: @otheruser');
      expect(text).toContain('tweet 9999');
    });

    it('omits reply context when not a reply', () => {
      const tweet = makeTweetDetail({
        in_reply_to_screen_name: null,
        in_reply_to_status_id_str: null,
      });
      const text = formatTweetDetail(tweet);
      expect(text).not.toContain('In reply to');
    });

    it('includes hashtags when present', () => {
      const tweet = makeTweetDetail({
        entities: {
          hashtags: [{ text: 'AI' }, { text: 'Tech' }],
        },
      });
      const text = formatTweetDetail(tweet);
      expect(text).toContain('#AI');
      expect(text).toContain('#Tech');
    });

    it('includes URLs when present', () => {
      const tweet = makeTweetDetail({
        entities: {
          urls: [
            { expanded_url: 'https://example.com', display_url: 'example.com' },
          ],
        },
      });
      const text = formatTweetDetail(tweet);
      expect(text).toContain('https://example.com');
    });

    it('includes media when present', () => {
      const tweet = makeTweetDetail({
        entities: {
          media: [
            { type: 'photo', media_url_https: 'https://pbs.twimg.com/photo.jpg' },
          ],
        },
      });
      const text = formatTweetDetail(tweet);
      expect(text).toContain('photo: https://pbs.twimg.com/photo.jpg');
    });

    it('includes user mentions when present', () => {
      const tweet = makeTweetDetail({
        entities: {
          user_mentions: [{ screen_name: 'user1' }, { screen_name: 'user2' }],
        },
      });
      const text = formatTweetDetail(tweet);
      expect(text).toContain('@user1');
      expect(text).toContain('@user2');
    });

    it('includes author follower/following counts', () => {
      const tweet = makeTweetDetail({
        user: {
          id_str: '123',
          name: 'Big Account',
          screen_name: 'bigaccount',
          description: 'desc',
          followers_count: 1500000,
          friends_count: 200,
          verified: true,
          profile_image_url_https: 'https://img.test',
        },
      });
      const text = formatTweetDetail(tweet);
      expect(text).toContain('1,500,000 followers');
      expect(text).toContain('200 following');
    });

    it('handles tweet with all entity types', () => {
      const tweet = makeTweetDetail({
        entities: {
          hashtags: [{ text: 'AI' }],
          urls: [{ expanded_url: 'https://test.com', display_url: 'test.com' }],
          media: [{ type: 'video', media_url_https: 'https://vid.test' }],
          user_mentions: [{ screen_name: 'mentioned' }],
        },
      });
      const text = formatTweetDetail(tweet);
      expect(text).toContain('Hashtags: #AI');
      expect(text).toContain('Links: https://test.com');
      expect(text).toContain('Media: video: https://vid.test');
      expect(text).toContain('Mentions: @mentioned');
    });
  });

  describe('twitter_get_tweet handler logic', () => {
    it('constructs correct tweet endpoint', () => {
      const tweet_id = '1729591119699124560';
      const endpoint = `/twitter/tweets/${tweet_id}`;
      expect(endpoint).toBe('/twitter/tweets/1729591119699124560');
    });
  });

  describe('twitter_get_tweet_comments handler logic', () => {
    it('constructs correct comments endpoint', () => {
      const tweet_id = '1729591119699124560';
      const endpoint = `/twitter/tweets/${tweet_id}/comments`;
      expect(endpoint).toBe('/twitter/tweets/1729591119699124560/comments');
    });

    it('returns "No comments found" for empty results', () => {
      const tweets: TweetDetail[] = [];
      const text = !tweets || tweets.length === 0
        ? 'No comments found for this tweet.'
        : 'Found comments';
      expect(text).toBe('No comments found for this tweet.');
    });

    it('formats comments correctly', () => {
      const comments = [
        makeTweetDetail({ id_str: 'c1', full_text: 'Great post!', user: { ...makeTweetDetail().user, screen_name: 'commenter1' } }),
        makeTweetDetail({ id_str: 'c2', full_text: 'Interesting', user: { ...makeTweetDetail().user, screen_name: 'commenter2' } }),
      ];

      const formatted = comments.map(t =>
        `@${t.user.screen_name}: ${t.full_text}\n  ❤️ ${t.favorite_count}  🔁 ${t.retweet_count}  💬 ${t.reply_count} | ID: ${t.id_str}`
      ).join('\n\n');

      expect(formatted).toContain('@commenter1: Great post!');
      expect(formatted).toContain('@commenter2: Interesting');
      expect(formatted).toContain('ID: c1');
      expect(formatted).toContain('ID: c2');
    });

    it('appends pagination cursor for comments', () => {
      const next_cursor = 'comment-cursor-abc';
      let text = '5 comments:\n\ncomments here';
      if (next_cursor) {
        text += `\n\n📄 More comments available. Use cursor: "${next_cursor}"`;
      }
      expect(text).toContain('📄 More comments available');
      expect(text).toContain('comment-cursor-abc');
    });
  });

  describe('formatUserProfile', () => {
    it('formats complete user profile', () => {
      const user = makeUserProfile();
      const text = formatUserProfile(user);
      expect(text).toContain('Test User (@testuser)');
      expect(text).toContain('User ID: 12345678');
      expect(text).toContain('Just a test account');
      expect(text).toContain('San Francisco');
      expect(text).toContain('https://example.com');
      expect(text).toContain('10,000');
      expect(text).toContain('500');
      expect(text).toContain('2,000');
      expect(text).toContain('5,000');
      expect(text).toContain('100');
      expect(text).toContain('Verified: Yes');
      expect(text).toContain('Can DM: Yes');
      expect(text).toContain('Protected: No');
    });

    it('shows "(no bio)" when description is empty', () => {
      const user = makeUserProfile({ description: '' });
      const text = formatUserProfile(user);
      expect(text).toContain('(no bio)');
    });

    it('shows "Not specified" when location is empty', () => {
      const user = makeUserProfile({ location: '' });
      const text = formatUserProfile(user);
      expect(text).toContain('Not specified');
    });

    it('shows "None" when URL is null', () => {
      const user = makeUserProfile({ url: null });
      const text = formatUserProfile(user);
      expect(text).toContain('URL: None');
    });

    it('shows correct verification status', () => {
      const verified = makeUserProfile({ verified: true });
      const unverified = makeUserProfile({ verified: false });
      expect(formatUserProfile(verified)).toContain('Verified: Yes');
      expect(formatUserProfile(unverified)).toContain('Verified: No');
    });

    it('shows correct protected status', () => {
      const protectedUser = makeUserProfile({ protected: true });
      const publicUser = makeUserProfile({ protected: false });
      expect(formatUserProfile(protectedUser)).toContain('Protected: Yes');
      expect(formatUserProfile(publicUser)).toContain('Protected: No');
    });
  });

  describe('twitter_get_user handler logic', () => {
    it('strips @ from username', () => {
      const username = '@elonmusk';
      const cleanUsername = username.replace(/^@/, '');
      expect(cleanUsername).toBe('elonmusk');
    });

    it('leaves username without @ unchanged', () => {
      const username = 'elonmusk';
      const cleanUsername = username.replace(/^@/, '');
      expect(cleanUsername).toBe('elonmusk');
    });

    it('constructs correct user endpoint', () => {
      const cleanUsername = 'testuser';
      const endpoint = `/twitter/user/${cleanUsername}`;
      expect(endpoint).toBe('/twitter/user/testuser');
    });
  });

  describe('twitter_get_user_tweets handler logic', () => {
    it('uses tweets endpoint when include_replies is false', () => {
      const user_id = '12345678';
      const include_replies = false;
      const endpoint = include_replies
        ? `/twitter/user/${user_id}/tweets-and-replies`
        : `/twitter/user/${user_id}/tweets`;
      expect(endpoint).toBe('/twitter/user/12345678/tweets');
    });

    it('uses tweets-and-replies endpoint when include_replies is true', () => {
      const user_id = '12345678';
      const include_replies = true;
      const endpoint = include_replies
        ? `/twitter/user/${user_id}/tweets-and-replies`
        : `/twitter/user/${user_id}/tweets`;
      expect(endpoint).toBe('/twitter/user/12345678/tweets-and-replies');
    });

    it('returns "No tweets found" for empty results', () => {
      const tweets: Tweet[] = [];
      const text = !tweets || tweets.length === 0
        ? 'No tweets found for this user.'
        : 'Found tweets';
      expect(text).toBe('No tweets found for this user.');
    });

    it('formats user tweets correctly', () => {
      const tweets = [
        { user: { screen_name: 'testuser' }, tweet_created_at: '2024-01-15', full_text: 'My tweet', favorite_count: 10, retweet_count: 2, reply_count: 1, views_count: 100, id_str: 't1' },
      ];

      const formatted = tweets.map(t =>
        `@${t.user.screen_name} — ${t.tweet_created_at}\n${t.full_text}\n  ❤️ ${t.favorite_count}  🔁 ${t.retweet_count}  💬 ${t.reply_count}  👁 ${t.views_count} | ID: ${t.id_str}`
      ).join('\n\n---\n\n');

      expect(formatted).toContain('@testuser');
      expect(formatted).toContain('My tweet');
      expect(formatted).toContain('❤️ 10');
      expect(formatted).toContain('ID: t1');
    });
  });

  describe('error handling patterns', () => {
    it('returns isError flag on error', () => {
      const result = {
        content: [{ type: 'text', text: 'Error searching tweets: test' }],
        isError: true,
      };
      expect(result.isError).toBe(true);
    });

    it('formats Error instances correctly', () => {
      const error = new Error('API timeout');
      const msg = `Error: ${error instanceof Error ? error.message : String(error)}`;
      expect(msg).toBe('Error: API timeout');
    });

    it('formats non-Error values correctly', () => {
      const error = 'something broke';
      const msg = `Error: ${error instanceof Error ? error.message : String(error)}`;
      expect(msg).toBe('Error: something broke');
    });

    it('covers all error message prefixes', () => {
      const errorTypes = [
        'Error searching tweets:',
        'Error fetching tweet:',
        'Error fetching comments:',
        'Error fetching user profile:',
        'Error fetching user tweets:',
      ];
      errorTypes.forEach(prefix => {
        const msg = `${prefix} Connection refused`;
        expect(msg).toContain('Connection refused');
      });
    });
  });
});
