import { NextResponse } from 'next/server';
import { getSessionMessages } from '@/lib/claude-code';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sessionId: string }> }
) {
  try {
    const { projectId, sessionId } = await params;
    const messages = await getSessionMessages(projectId, sessionId);
    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching session messages:', error);
    return NextResponse.json({ error: 'Failed to fetch session messages' }, { status: 500 });
  }
}
