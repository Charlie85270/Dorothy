import * as fs from 'fs';
import { isSafeTelegramPath } from './utils';
import { RouteApp, RouteContext } from './types';

export function registerTelegramRoutes(app: RouteApp, ctx: RouteContext): void {
  // POST /api/telegram/send
  app.post('/api/telegram/send', async (req, sendJson) => {
    const { message, chat_id } = req.body as { message: string; chat_id?: string };
    if (!message) {
      sendJson({ error: 'message is required' }, 400);
      return;
    }

    const telegramBot = ctx.getTelegramBot();
    const targetChatId = chat_id || ctx.appSettings.telegramChatId || ctx.appSettings.telegramAuthorizedChatIds?.[0];
    if (!telegramBot || !targetChatId) {
      sendJson({ error: 'Telegram not configured or no chat ID. Set a default chat in Settings > Telegram.' }, 400);
      return;
    }

    try {
      await telegramBot.sendMessage(targetChatId, `\u{1F451} ${message}`, { parse_mode: 'Markdown' });
      sendJson({ success: true });
    } catch {
      try {
        await telegramBot.sendMessage(targetChatId, `\u{1F451} ${message}`);
        sendJson({ success: true });
      } catch (err2) {
        sendJson({ error: `Failed to send: ${err2}` }, 500);
      }
    }
  });

  // POST /api/telegram/send-photo
  app.post('/api/telegram/send-photo', async (req, sendJson) => {
    const { photo_path, caption } = req.body as { photo_path: string; caption?: string };
    if (!photo_path) {
      sendJson({ error: 'photo_path is required' }, 400);
      return;
    }
    if (!isSafeTelegramPath(photo_path)) {
      sendJson({ error: 'Access denied: path not allowed' }, 403);
      return;
    }

    const telegramBot = ctx.getTelegramBot();
    const targetChatId = ctx.appSettings.telegramChatId || ctx.appSettings.telegramAuthorizedChatIds?.[0];
    if (!telegramBot || !targetChatId) {
      sendJson({ error: 'Telegram not configured or no chat ID' }, 400);
      return;
    }

    try {
      if (!fs.existsSync(photo_path)) {
        sendJson({ error: `File not found: ${photo_path}` }, 400);
        return;
      }

      await telegramBot.sendPhoto(
        targetChatId,
        photo_path,
        { caption: caption ? `\u{1F451} ${caption}` : undefined, parse_mode: 'Markdown' }
      );
      sendJson({ success: true });
    } catch (err) {
      sendJson({ error: `Failed to send photo: ${err}` }, 500);
    }
  });

  // POST /api/telegram/send-video
  app.post('/api/telegram/send-video', async (req, sendJson) => {
    const { video_path, caption } = req.body as { video_path: string; caption?: string };
    if (!video_path) {
      sendJson({ error: 'video_path is required' }, 400);
      return;
    }
    if (!isSafeTelegramPath(video_path)) {
      sendJson({ error: 'Access denied: path not allowed' }, 403);
      return;
    }

    const telegramBot = ctx.getTelegramBot();
    const targetChatId = ctx.appSettings.telegramChatId || ctx.appSettings.telegramAuthorizedChatIds?.[0];
    if (!telegramBot || !targetChatId) {
      sendJson({ error: 'Telegram not configured or no chat ID' }, 400);
      return;
    }

    try {
      if (!fs.existsSync(video_path)) {
        sendJson({ error: `File not found: ${video_path}` }, 400);
        return;
      }

      await telegramBot.sendVideo(
        targetChatId,
        video_path,
        { caption: caption ? `\u{1F451} ${caption}` : undefined, parse_mode: 'Markdown' }
      );
      sendJson({ success: true });
    } catch (err) {
      sendJson({ error: `Failed to send video: ${err}` }, 500);
    }
  });

  // POST /api/telegram/send-document
  app.post('/api/telegram/send-document', async (req, sendJson) => {
    const { document_path, caption } = req.body as { document_path: string; caption?: string };
    if (!document_path) {
      sendJson({ error: 'document_path is required' }, 400);
      return;
    }
    if (!isSafeTelegramPath(document_path)) {
      sendJson({ error: 'Access denied: path not allowed' }, 403);
      return;
    }

    const telegramBot = ctx.getTelegramBot();
    const targetChatId = ctx.appSettings.telegramChatId || ctx.appSettings.telegramAuthorizedChatIds?.[0];
    if (!telegramBot || !targetChatId) {
      sendJson({ error: 'Telegram not configured or no chat ID' }, 400);
      return;
    }

    try {
      if (!fs.existsSync(document_path)) {
        sendJson({ error: `File not found: ${document_path}` }, 400);
        return;
      }

      await telegramBot.sendDocument(
        targetChatId,
        document_path,
        { caption: caption ? `\u{1F451} ${caption}` : undefined, parse_mode: 'Markdown' }
      );
      sendJson({ success: true });
    } catch (err) {
      sendJson({ error: `Failed to send document: ${err}` }, 500);
    }
  });
}
