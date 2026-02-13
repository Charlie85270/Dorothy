import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const SOCIALDATA_BASE = "api.socialdata.tools";

function getApiKey(): string {
  const settingsPath = path.join(os.homedir(), ".dorothy", "app-settings.json");
  try {
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
      if (settings.socialDataApiKey) {
        return settings.socialDataApiKey;
      }
    }
  } catch {
    // Ignore read errors
  }
  throw new Error(
    "SocialData API key not configured. Please add your API key in Dorothy Settings > SocialData."
  );
}

export async function socialDataRequest(
  method: string,
  endpoint: string,
  queryParams?: Record<string, string>
): Promise<unknown> {
  const apiKey = getApiKey();

  let requestPath = endpoint;
  if (queryParams) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== "") {
        params.append(key, value);
      }
    }
    const qs = params.toString();
    if (qs) {
      requestPath += `?${qs}`;
    }
  }

  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: SOCIALDATA_BASE,
      port: 443,
      path: requestPath,
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
            if (res.statusCode === 402) {
              reject(new Error("Insufficient SocialData API credits. Please top up your account."));
            } else if (res.statusCode === 404) {
              reject(new Error("Resource not found on Twitter/X."));
            } else if (res.statusCode === 422) {
              reject(new Error(`Validation error: ${JSON.stringify(parsed)}`));
            } else {
              reject(new Error(`SocialData API error (HTTP ${res.statusCode}): ${JSON.stringify(parsed)}`));
            }
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error(`Failed to parse SocialData response: ${data.slice(0, 500)}`));
        }
      });
    });

    req.on("error", (err) => reject(new Error(`SocialData API request failed: ${err.message}`)));
    req.end();
  });
}
