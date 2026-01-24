import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis client (only if env vars are set)
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

export async function GET() {
  if (!redis) {
    return NextResponse.json({
      total: 0,
      today: 0,
      platforms: { mac: 0, windows: 0, linux: 0 },
    });
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    const [total, todayCount, mac, windows, linux] = await Promise.all([
      redis.get<number>('downloads:total') || 0,
      redis.get<number>(`downloads:daily:${today}`) || 0,
      redis.get<number>('downloads:platform:mac') || 0,
      redis.get<number>('downloads:platform:windows') || 0,
      redis.get<number>('downloads:platform:linux') || 0,
    ]);

    return NextResponse.json({
      total: total || 0,
      today: todayCount || 0,
      platforms: {
        mac: mac || 0,
        windows: windows || 0,
        linux: linux || 0,
      },
    });
  } catch (error) {
    console.error('Failed to get stats:', error);
    return NextResponse.json({
      total: 0,
      today: 0,
      platforms: { mac: 0, windows: 0, linux: 0 },
    });
  }
}
