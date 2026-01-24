import { agentManager } from '@/lib/agent-manager';
import type { AgentEvent } from '@/types/agent';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const agent = agentManager.getAgent(id);

  if (!agent) {
    return new Response('Agent not found', { status: 404 });
  }

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial state
      const initialData = `data: ${JSON.stringify({ type: 'init', agent })}\n\n`;
      controller.enqueue(encoder.encode(initialData));

      // Listen for events
      const handleEvent = (event: AgentEvent) => {
        if (event.agentId === id) {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
      };

      agentManager.on('output', handleEvent);
      agentManager.on('error', handleEvent);
      agentManager.on('complete', handleEvent);
      agentManager.on('tool_use', handleEvent);
      agentManager.on('thinking', handleEvent);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        agentManager.off('output', handleEvent);
        agentManager.off('error', handleEvent);
        agentManager.off('complete', handleEvent);
        agentManager.off('tool_use', handleEvent);
        agentManager.off('thinking', handleEvent);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
