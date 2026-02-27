import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // ISR: revalidate every hour

interface RawSkill {
  source: string;
  skillId: string;
  name: string;
  installs: number;
}

function formatInstalls(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

let cache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET() {
  // In-memory cache
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const res = await fetch('https://skills.sh/', {
      next: { revalidate: 3600 },
      headers: { 'User-Agent': 'Dorothy/1.0' },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch skills.sh' }, { status: 502 });
    }

    const html = await res.text();

    // Extract the initialSkills JSON array from the SSR payload
    const match = html.match(/initialSkills.*?(\[\{.*?\}\])/);
    if (!match) {
      return NextResponse.json({ error: 'Could not parse skills data' }, { status: 502 });
    }

    const raw = match[1].replace(/\\"/g, '"');
    const allSkills: RawSkill[] = JSON.parse(raw);

    // Take top 300, map to our Skill shape
    const skills = allSkills.slice(0, 300).map((s, i) => ({
      rank: i + 1,
      name: s.name,
      repo: s.source,
      installs: formatInstalls(s.installs),
      installsNum: s.installs,
    }));

    const result = { skills, fetchedAt: new Date().toISOString() };
    cache = { data: result, ts: Date.now() };

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
