import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis client (only if env vars are set)
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Download URL - update this to your actual release URL
const DOWNLOAD_URL = 'https://github.com/Charlie85270/dorothy/releases/download/1.0.6/dorothy-1.0.6-arm64.dmg';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform') || 'mac';

  try {
    // Track download in Redis if available
    if (redis) {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      // Increment total downloads
      await redis.incr('downloads:total');

      // Increment daily downloads
      await redis.incr(`downloads:daily:${today}`);

      // Increment platform-specific downloads
      await redis.incr(`downloads:platform:${platform}`);

      // Add to download log (keep last 1000)
      await redis.lpush('downloads:log', JSON.stringify({
        timestamp: new Date().toISOString(),
        platform,
        userAgent: request.headers.get('user-agent') || 'unknown',
      }));
      await redis.ltrim('downloads:log', 0, 999);
    }
  } catch (error) {
    // Don't fail the download if tracking fails
    console.error('Failed to track download:', error);
  }

  // Redirect to the actual download
  return NextResponse.redirect(DOWNLOAD_URL);
}
