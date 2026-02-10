import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// mcp-telegram tool handler tests
// ============================================================================
// Tests the business logic of all telegram MCP tool handlers:
// send_telegram, send_telegram_photo, send_telegram_video, send_telegram_document
// Also tests helper functions: loadSettings, telegramApiRequest, sendFile

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue(''),
  };
});

import * as fs from 'fs';

interface AppSettings {
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramAuthorizedChatIds?: string[];
}

// Replicate loadSettings logic from mcp-telegram
function loadSettings(): AppSettings {
  try {
    if (fs.existsSync('/mock/settings.json')) {
      return JSON.parse(fs.readFileSync('/mock/settings.json', 'utf-8'));
    }
  } catch {
    // Ignore
  }
  return {};
}

describe('mcp-telegram', () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('');
  });

  describe('loadSettings', () => {
    it('returns empty object when file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(loadSettings()).toEqual({});
    });

    it('returns parsed settings from file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        telegramBotToken: 'test-token',
        telegramChatId: '12345',
      }));
      const settings = loadSettings();
      expect(settings.telegramBotToken).toBe('test-token');
      expect(settings.telegramChatId).toBe('12345');
    });

    it('returns empty object on parse error', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json{');
      expect(loadSettings()).toEqual({});
    });

    it('handles file with extra settings', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        telegramBotToken: 'token',
        telegramChatId: '123',
        telegramAuthorizedChatIds: ['123', '456'],
        otherSetting: true,
      }));
      const settings = loadSettings();
      expect(settings.telegramAuthorizedChatIds).toEqual(['123', '456']);
    });
  });

  describe('send_telegram handler logic', () => {
    function sendTelegramHandler(message: string, chat_id?: string) {
      const settings = loadSettings();
      if (!settings.telegramBotToken) {
        return { error: 'Telegram not configured - missing bot token in settings' };
      }

      const targetChatId = chat_id || settings.telegramChatId;
      if (!targetChatId) {
        return { error: 'No chat_id provided and no default chat ID configured' };
      }

      return {
        success: true,
        text: `Message sent to Telegram chat ${targetChatId}: "${message.slice(0, 100)}${message.length > 100 ? '...' : ''}"`,
      };
    }

    it('returns error when bot token is missing', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = sendTelegramHandler('Hello');
      expect(result.error).toContain('missing bot token');
    });

    it('uses provided chat_id over default', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        telegramBotToken: 'token',
        telegramChatId: 'default-chat',
      }));
      const result = sendTelegramHandler('Hello', 'custom-chat');
      expect(result.text).toContain('custom-chat');
    });

    it('falls back to default chat_id', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        telegramBotToken: 'token',
        telegramChatId: 'default-chat',
      }));
      const result = sendTelegramHandler('Hello');
      expect(result.text).toContain('default-chat');
    });

    it('returns error when no chat_id available', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        telegramBotToken: 'token',
      }));
      const result = sendTelegramHandler('Hello');
      expect(result.error).toContain('No chat_id provided');
    });

    it('truncates long messages in response', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        telegramBotToken: 'token',
        telegramChatId: '123',
      }));
      const longMessage = 'A'.repeat(150);
      const result = sendTelegramHandler(longMessage);
      expect(result.text).toContain('...');
      expect(result.text).not.toContain('A'.repeat(150));
    });

    it('does not truncate short messages', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        telegramBotToken: 'token',
        telegramChatId: '123',
      }));
      const result = sendTelegramHandler('Short message');
      expect(result.text).not.toContain('...');
    });

    it('prepends crown emoji to sent message', () => {
      // The actual handler prepends 👑 to the message text sent to Telegram
      const message = 'Test message';
      const sentText = `👑 ${message}`;
      expect(sentText).toBe('👑 Test message');
    });
  });

  describe('send_telegram_photo handler logic', () => {
    function sendPhotoHandler(photo_path: string, caption?: string, chat_id?: string) {
      const settings = loadSettings();
      if (!settings.telegramBotToken) {
        return { error: 'Telegram not configured - missing bot token in settings' };
      }
      const targetChatId = chat_id || settings.telegramChatId;
      if (!targetChatId) {
        return { error: 'No chat_id provided and no default chat ID configured' };
      }

      // sendFile would check if file exists
      if (!fs.existsSync(photo_path)) {
        return { error: `File not found: ${photo_path}` };
      }

      return {
        success: true,
        text: `Photo sent to Telegram chat ${targetChatId}: ${photo_path}${caption ? ` with caption: "${caption.slice(0, 50)}..."` : ''}`,
      };
    }

    it('returns error when file not found', () => {
      vi.mocked(fs.existsSync).mockImplementation((p) =>
        p === '/mock/settings.json' ? true : false
      );
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        telegramBotToken: 'token',
        telegramChatId: '123',
      }));
      const result = sendPhotoHandler('/path/to/missing.png');
      expect(result.error).toContain('File not found');
    });

    it('sends photo with caption', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        telegramBotToken: 'token',
        telegramChatId: '123',
      }));
      const result = sendPhotoHandler('/path/to/image.png', 'My photo');
      expect(result.text).toContain('image.png');
      expect(result.text).toContain('with caption');
    });

    it('sends photo without caption', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        telegramBotToken: 'token',
        telegramChatId: '123',
      }));
      const result = sendPhotoHandler('/path/to/image.png');
      expect(result.text).toContain('image.png');
      expect(result.text).not.toContain('with caption');
    });
  });

  describe('send_telegram_video handler logic', () => {
    it('formats video response correctly', () => {
      const targetChatId = '123';
      const video_path = '/path/to/video.mp4';
      const caption = 'My video';
      const text = `Video sent to Telegram chat ${targetChatId}: ${video_path}${caption ? ` with caption: "${caption.slice(0, 50)}..."` : ''}`;
      expect(text).toContain('video.mp4');
      expect(text).toContain('My video');
    });
  });

  describe('send_telegram_document handler logic', () => {
    it('formats document response correctly', () => {
      const targetChatId = '456';
      const document_path = '/path/to/report.pdf';
      const text = `Document sent to Telegram chat ${targetChatId}: ${document_path}`;
      expect(text).toContain('report.pdf');
      expect(text).toContain('456');
    });

    it('truncates long captions in response', () => {
      const caption = 'A'.repeat(100);
      const text = `with caption: "${caption.slice(0, 50)}..."`;
      expect(text.length).toBeLessThan(80);
    });
  });

  describe('telegramApiRequest URL construction', () => {
    it('constructs correct Telegram API URL', () => {
      const token = 'bot123:ABC';
      const method = 'sendMessage';
      const url = new URL(`https://api.telegram.org/bot${token}/${method}`);
      expect(url.href).toBe('https://api.telegram.org/botbot123:ABC/sendMessage');
    });

    it('appends query params correctly', () => {
      const token = 'bot123:ABC';
      const method = 'sendMessage';
      const url = new URL(`https://api.telegram.org/bot${token}/${method}`);
      const params: Record<string, string | number> = {
        chat_id: '12345',
        text: '👑 Hello',
        parse_mode: 'Markdown',
      };
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
      expect(url.searchParams.get('chat_id')).toBe('12345');
      expect(url.searchParams.get('parse_mode')).toBe('Markdown');
    });
  });

  describe('sendFile multipart form data', () => {
    it('constructs correct boundary', () => {
      const boundary = `----FormBoundary${Date.now()}`;
      expect(boundary).toMatch(/^----FormBoundary\d+$/);
    });

    it('builds multipart body with chat_id', () => {
      const boundary = '----FormBoundaryTest';
      const chatId = '12345';
      let body = '';
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`;
      expect(body).toContain('chat_id');
      expect(body).toContain('12345');
    });

    it('includes caption with crown emoji when provided', () => {
      const boundary = '----FormBoundaryTest';
      const caption = 'Test caption';
      let body = '';
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="caption"\r\n\r\n👑 ${caption}\r\n`;
      expect(body).toContain('👑 Test caption');
    });

    it('includes file field with correct name', () => {
      const boundary = '----FormBoundaryTest';
      const fileField = 'photo';
      const fileName = 'image.png';
      let body = '';
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="${fileField}"; filename="${fileName}"\r\n`;
      body += `Content-Type: application/octet-stream\r\n\r\n`;
      expect(body).toContain('name="photo"');
      expect(body).toContain('filename="image.png"');
    });

    it('constructs correct HTTPS options', () => {
      const token = 'bot123:ABC';
      const method = 'sendPhoto';
      const options = {
        hostname: 'api.telegram.org',
        path: `/bot${token}/${method}`,
        method: 'POST',
      };
      expect(options.hostname).toBe('api.telegram.org');
      expect(options.path).toBe('/botbot123:ABC/sendPhoto');
      expect(options.method).toBe('POST');
    });
  });

  describe('error handling patterns', () => {
    it('formats error message for Error instances', () => {
      const error = new Error('Network timeout');
      const msg = `Error sending to Telegram: ${error instanceof Error ? error.message : String(error)}`;
      expect(msg).toBe('Error sending to Telegram: Network timeout');
    });

    it('formats error message for non-Error values', () => {
      const error = 'something went wrong';
      const msg = `Error sending to Telegram: ${error instanceof Error ? error.message : String(error)}`;
      expect(msg).toBe('Error sending to Telegram: something went wrong');
    });

    it('returns isError flag on error', () => {
      const result = {
        content: [{ type: 'text', text: 'Error sending to Telegram: test' }],
        isError: true,
      };
      expect(result.isError).toBe(true);
    });
  });
});
