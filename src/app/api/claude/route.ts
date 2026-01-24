import { NextResponse } from 'next/server';
import { getAllClaudeData } from '@/lib/claude-code';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getAllClaudeData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching Claude data:', error);
    return NextResponse.json({ error: 'Failed to fetch Claude data' }, { status: 500 });
  }
}
