import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// mcp-orchestrator messaging tool handler tests
// ============================================================================
// Tests the business logic of orchestrator messaging tool handlers:
// send_telegram, send_slack

type ApiRequestFn = (
  endpoint: string,
  method?: 'GET' | 'POST' | 'DELETE',
  body?: Record<string, unknown>
) => Promise<unknown>;

let mockApiRequest: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockApiRequest = vi.fn();
});

describe('mcp-orchestrator messaging tools', () => {
  describe('send_telegram', () => {
    async function sendTelegram(apiRequest: ApiRequestFn, message: string) {
      try {
        await apiRequest('/api/telegram/send', 'POST', { message });
        return {
          content: [{
            type: 'text',
            text: `Message sent to Telegram: "${message.slice(0, 100)}${message.length > 100 ? '...' : ''}"`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error sending to Telegram: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    }

    it('sends message via API', async () => {
      mockApiRequest.mockResolvedValue(undefined);
      const result = await sendTelegram(mockApiRequest, 'Hello from orchestrator');
      expect(result.content[0].text).toContain('Message sent to Telegram');
      expect(result.content[0].text).toContain('Hello from orchestrator');
      expect(mockApiRequest).toHaveBeenCalledWith('/api/telegram/send', 'POST', {
        message: 'Hello from orchestrator',
      });
    });

    it('truncates long messages in response', async () => {
      mockApiRequest.mockResolvedValue(undefined);
      const longMessage = 'A'.repeat(150);
      const result = await sendTelegram(mockApiRequest, longMessage);
      expect(result.content[0].text).toContain('...');
    });

    it('does not truncate short messages', async () => {
      mockApiRequest.mockResolvedValue(undefined);
      const result = await sendTelegram(mockApiRequest, 'Short');
      expect(result.content[0].text).not.toContain('...');
    });

    it('returns error on API failure', async () => {
      mockApiRequest.mockRejectedValue(new Error('Telegram bot not configured'));
      const result = await sendTelegram(mockApiRequest, 'Hello');
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Telegram bot not configured');
    });
  });

  describe('send_slack', () => {
    async function sendSlack(apiRequest: ApiRequestFn, message: string) {
      try {
        await apiRequest('/api/slack/send', 'POST', { message });
        return {
          content: [{
            type: 'text',
            text: `Message sent to Slack: "${message.slice(0, 100)}${message.length > 100 ? '...' : ''}"`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error sending to Slack: ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
        };
      }
    }

    it('sends message via API', async () => {
      mockApiRequest.mockResolvedValue(undefined);
      const result = await sendSlack(mockApiRequest, 'Hello Slack');
      expect(result.content[0].text).toContain('Message sent to Slack');
      expect(mockApiRequest).toHaveBeenCalledWith('/api/slack/send', 'POST', {
        message: 'Hello Slack',
      });
    });

    it('truncates long messages in response', async () => {
      mockApiRequest.mockResolvedValue(undefined);
      const longMessage = 'B'.repeat(200);
      const result = await sendSlack(mockApiRequest, longMessage);
      expect(result.content[0].text).toContain('...');
    });

    it('returns error on API failure', async () => {
      mockApiRequest.mockRejectedValue(new Error('Slack not connected'));
      const result = await sendSlack(mockApiRequest, 'Hello');
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Slack not connected');
    });
  });
});
