/**
 * API utilities for communicating with dorothy API server
 */

const API_URL = process.env.CLAUDE_MGR_API_URL || "http://127.0.0.1:31415";

export async function apiRequest(
  endpoint: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: Record<string, unknown>
): Promise<unknown> {
  const url = `${API_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error((data as { error?: string }).error || `API error: ${response.status}`);
  }

  return data;
}
