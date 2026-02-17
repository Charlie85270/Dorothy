import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const APP_SETTINGS_FILE = path.join(os.homedir(), '.dorothy', 'app-settings.json');

function getAppSettings(): Record<string, unknown> | null {
  try {
    const data = fs.readFileSync(APP_SETTINGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function GET() {
  const settings = getAppSettings();

  if (!settings) {
    return NextResponse.json({ error: 'App settings not found' }, { status: 500 });
  }

  const apiKey = settings.elevenlabsApiKey as string;
  const agentId = settings.elevenlabsAgentId as string;

  if (!apiKey || !agentId) {
    return NextResponse.json(
      { error: 'ElevenLabs API key and Agent ID must be configured in Settings > NPC Avatar' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      {
        headers: {
          'xi-api-key': apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `ElevenLabs API error: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ signed_url: data.signed_url });
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to get signed URL: ${String(error)}` },
      { status: 500 }
    );
  }
}
