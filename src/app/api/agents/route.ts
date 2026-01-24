import { NextResponse } from 'next/server';
import { agentManager } from '@/lib/agent-manager';

export const dynamic = 'auto';

// GET all agents
export async function GET() {
  const agents = agentManager.getAllAgents();
  return NextResponse.json({ agents });
}

// POST create new agent
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectPath, skills = [], prompt, model } = body;

    if (!projectPath) {
      return NextResponse.json({ error: 'projectPath is required' }, { status: 400 });
    }

    // Create the agent
    const agent = agentManager.createAgent({
      projectPath,
      skills,
    });

    // If prompt is provided, start the agent immediately
    if (prompt) {
      await agentManager.startAgent(agent.id, prompt, { model });
    }

    return NextResponse.json({ agent });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
