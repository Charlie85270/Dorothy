#!/usr/bin/env node
/**
 * MCP server that exposes Telegram tools for sending messages, photos, videos, and documents.
 * Works independently - reads config from ~/.claude-manager/settings.json and sends directly to Telegram.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as https from "https";

// Settings file path
const SETTINGS_FILE = path.join(os.homedir(), ".claude-manager", "app-settings.json");

interface AppSettings {
  telegramBotToken?: string;
  telegramChatId?: string;
  telegramAuthorizedChatIds?: string[];
}

function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    }
  } catch (err) {
    console.error("Failed to load settings:", err);
  }
  return {};
}

// Telegram Bot API helper
async function telegramApiRequest(
  token: string,
  method: string,
  params: Record<string, string | number>
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://api.telegram.org/bot${token}/${method}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.ok) {
              resolve(json.result);
            } else {
              reject(new Error(json.description || "Telegram API error"));
            }
          } catch {
            reject(new Error("Failed to parse Telegram response"));
          }
        });
      })
      .on("error", reject);
  });
}

// Send file via multipart form data
async function sendFile(
  token: string,
  chatId: string,
  method: string,
  filePath: string,
  fileField: string,
  caption?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      reject(new Error(`File not found: ${filePath}`));
      return;
    }

    const boundary = `----FormBoundary${Date.now()}`;
    const fileName = path.basename(filePath);
    const fileContent = fs.readFileSync(filePath);

    // Build multipart form data
    let body = "";
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`;

    if (caption) {
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="caption"\r\n\r\n👑 ${caption}\r\n`;
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="parse_mode"\r\n\r\nMarkdown\r\n`;
    }

    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="${fileField}"; filename="${fileName}"\r\n`;
    body += `Content-Type: application/octet-stream\r\n\r\n`;

    const bodyStart = Buffer.from(body, "utf-8");
    const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8");
    const fullBody = Buffer.concat([bodyStart, fileContent, bodyEnd]);

    const options = {
      hostname: "api.telegram.org",
      path: `/bot${token}/${method}`,
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": fullBody.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.ok) {
            resolve();
          } else {
            reject(new Error(json.description || "Telegram API error"));
          }
        } catch {
          reject(new Error("Failed to parse Telegram response"));
        }
      });
    });

    req.on("error", reject);
    req.write(fullBody);
    req.end();
  });
}

// Create MCP server
const server = new McpServer({
  name: "claude-mgr-telegram",
  version: "1.0.0",
});

// Register send_telegram tool
server.tool(
  "send_telegram",
  "Send a text message to Telegram. IMPORTANT: When responding to a Telegram message, you MUST include the chat_id from the original request to ensure the response goes to the correct chat.",
  {
    message: z.string().describe("The message to send to Telegram"),
    chat_id: z.string().optional().describe("The chat ID to send to. REQUIRED when responding to a specific Telegram chat. Use the chat_id from the incoming Telegram message."),
  },
  async ({ message, chat_id }) => {
    try {
      const settings = loadSettings();
      if (!settings.telegramBotToken) {
        throw new Error("Telegram not configured - missing bot token in settings");
      }

      // Use provided chat_id, or fall back to default from settings
      const targetChatId = chat_id || settings.telegramChatId;
      if (!targetChatId) {
        throw new Error("No chat_id provided and no default chat ID configured");
      }

      await telegramApiRequest(settings.telegramBotToken, "sendMessage", {
        chat_id: targetChatId,
        text: `👑 ${message}`,
        parse_mode: "Markdown",
      });

      return {
        content: [
          {
            type: "text",
            text: `Message sent to Telegram chat ${targetChatId}: "${message.slice(0, 100)}${message.length > 100 ? "..." : ""}"`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error sending to Telegram: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Register send_telegram_photo tool
server.tool(
  "send_telegram_photo",
  "Send a photo/image to Telegram. Use this to share screenshots, images, or visual content with the user.",
  {
    photo_path: z.string().describe("The absolute file path to the photo/image to send (e.g., /Users/name/image.png)"),
    caption: z.string().optional().describe("Optional caption text to include with the photo"),
    chat_id: z.string().optional().describe("The chat ID to send to. Use the chat_id from the incoming Telegram message."),
  },
  async ({ photo_path, caption, chat_id }) => {
    try {
      const settings = loadSettings();
      if (!settings.telegramBotToken) {
        throw new Error("Telegram not configured - missing bot token in settings");
      }

      const targetChatId = chat_id || settings.telegramChatId;
      if (!targetChatId) {
        throw new Error("No chat_id provided and no default chat ID configured");
      }

      await sendFile(
        settings.telegramBotToken,
        targetChatId,
        "sendPhoto",
        photo_path,
        "photo",
        caption
      );

      return {
        content: [
          {
            type: "text",
            text: `Photo sent to Telegram chat ${targetChatId}: ${photo_path}${caption ? ` with caption: "${caption.slice(0, 50)}..."` : ""}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error sending photo to Telegram: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Register send_telegram_video tool
server.tool(
  "send_telegram_video",
  "Send a video to Telegram. Use this to share video content, screen recordings, or animations with the user.",
  {
    video_path: z.string().describe("The absolute file path to the video to send (e.g., /Users/name/video.mp4)"),
    caption: z.string().optional().describe("Optional caption text to include with the video"),
    chat_id: z.string().optional().describe("The chat ID to send to. Use the chat_id from the incoming Telegram message."),
  },
  async ({ video_path, caption, chat_id }) => {
    try {
      const settings = loadSettings();
      if (!settings.telegramBotToken) {
        throw new Error("Telegram not configured - missing bot token in settings");
      }

      const targetChatId = chat_id || settings.telegramChatId;
      if (!targetChatId) {
        throw new Error("No chat_id provided and no default chat ID configured");
      }

      await sendFile(
        settings.telegramBotToken,
        targetChatId,
        "sendVideo",
        video_path,
        "video",
        caption
      );

      return {
        content: [
          {
            type: "text",
            text: `Video sent to Telegram chat ${targetChatId}: ${video_path}${caption ? ` with caption: "${caption.slice(0, 50)}..."` : ""}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error sending video to Telegram: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Register send_telegram_document tool
server.tool(
  "send_telegram_document",
  "Send a document/file to Telegram. Use this to share PDFs, text files, or any other documents with the user.",
  {
    document_path: z.string().describe("The absolute file path to the document to send (e.g., /Users/name/report.pdf)"),
    caption: z.string().optional().describe("Optional caption text to include with the document"),
    chat_id: z.string().optional().describe("The chat ID to send to. Use the chat_id from the incoming Telegram message."),
  },
  async ({ document_path, caption, chat_id }) => {
    try {
      const settings = loadSettings();
      if (!settings.telegramBotToken) {
        throw new Error("Telegram not configured - missing bot token in settings");
      }

      const targetChatId = chat_id || settings.telegramChatId;
      if (!targetChatId) {
        throw new Error("No chat_id provided and no default chat ID configured");
      }

      await sendFile(
        settings.telegramBotToken,
        targetChatId,
        "sendDocument",
        document_path,
        "document",
        caption
      );

      return {
        content: [
          {
            type: "text",
            text: `Document sent to Telegram chat ${targetChatId}: ${document_path}${caption ? ` with caption: "${caption.slice(0, 50)}..."` : ""}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error sending document to Telegram: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Telegram server running on stdio");
}

main().catch(console.error);
