import * as http from "http";

const API_PORT = 31415;
const API_HOST = "127.0.0.1";

export async function apiRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: API_HOST,
      port: API_PORT,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            reject(
              new Error(parsed.error || `HTTP ${res.statusCode}: ${data}`)
            );
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`API request failed: ${err.message}`));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}
