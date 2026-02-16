import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { generateOAuthHeader, type OAuthCredentials } from "./oauth.js";

const X_API_HOST = "api.x.com";

function getCredentials(): OAuthCredentials {
  const settingsPath = path.join(os.homedir(), ".dorothy", "app-settings.json");
  try {
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      if (
        settings.xApiKey &&
        settings.xApiSecret &&
        settings.xAccessToken &&
        settings.xAccessTokenSecret
      ) {
        return {
          apiKey: settings.xApiKey,
          apiSecret: settings.xApiSecret,
          accessToken: settings.xAccessToken,
          accessTokenSecret: settings.xAccessTokenSecret,
        };
      }
    }
  } catch {
    // Ignore read errors
  }
  throw new Error(
    "X API credentials not configured. Please add your API keys in Dorothy Settings > X (Twitter)."
  );
}

export async function xApiRequest(
  method: string,
  endpoint: string,
  body?: Record<string, unknown>
): Promise<unknown> {
  const creds = getCredentials();
  const url = `https://${X_API_HOST}${endpoint}`;
  const bodyStr = body ? JSON.stringify(body) : undefined;
  const authHeader = generateOAuthHeader(method, url, creds, bodyStr);

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: X_API_HOST,
      port: 443,
      path: endpoint,
      method,
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            const errorDetail =
              parsed.detail ||
              parsed.errors?.[0]?.message ||
              JSON.stringify(parsed);
            reject(
              new Error(
                `X API error (HTTP ${res.statusCode}): ${errorDetail}`
              )
            );
          } else {
            resolve(parsed);
          }
        } catch {
          if (res.statusCode === 204) {
            resolve({ success: true });
          } else {
            reject(
              new Error(
                `Failed to parse X API response: ${data.slice(0, 500)}`
              )
            );
          }
        }
      });
    });

    req.on("error", (err) =>
      reject(new Error(`X API request failed: ${err.message}`))
    );

    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}
