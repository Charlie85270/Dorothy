import { NextResponse } from 'next/server';
import { agentManager } from '@/lib/agent-manager';

export const dynamic = 'auto';

// GET specific agent
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const agent = agentManager.getAgent(id);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  return NextResponse.json({ agent });
}

// POST send command to agent
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const agent = agentManager.getAgent(id);

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { action, prompt, input, model } = body;

    switch (action) {
      case 'start':
        if (!prompt) {
          return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        }
        await agentManager.startAgent(id, prompt, { model });
        break;

      case 'stop':
        agentManager.stopAgent(id);
        break;

      case 'input':
        if (!input) {
          return NextResponse.json({ error: 'input is required' }, { status: 400 });
        }
        agentManager.sendInput(id, input);
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, agent: agentManager.getAgent(id) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// DELETE remove agent
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  agentManager.removeAgent(id);
  return NextResponse.json({ success: true });
}
