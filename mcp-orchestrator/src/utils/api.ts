/**
 * API utilities for communicating with dorothy API server
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const API_URL = process.env.CLAUDE_MGR_API_URL || "http://127.0.0.1:31415";
const API_TOKEN_FILE = path.join(os.homedir(), ".echelon", "api-token");

function readApiToken(): string | null {
  try {
    if (fs.existsSync(API_TOKEN_FILE)) {
      return fs.readFileSync(API_TOKEN_FILE, "utf-8").trim();
    }
  } catch { /* ignore */ }
  return null;
}

export async function apiRequest(
  endpoint: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: Record<string, unknown>
): Promise<unknown> {
  const url = `${API_URL}${endpoint}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = readApiToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Long-poll wait endpoints need a longer timeout
  const isLongPoll = endpoint.includes("/wait");
  const timeoutMs = isLongPoll ? 600_000 : 30_000; // 10 min for long-poll, 30s default

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const options: RequestInit = {
    method,
    headers,
    signal: controller.signal,
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error((data as { error?: string }).error || `API error: ${response.status}`);
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}
