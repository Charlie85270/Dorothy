'use client';

import { useState } from 'react';
import { Eye, EyeOff, ExternalLink, Video } from 'lucide-react';
import { Toggle } from './Toggle';
import type { AppSettings } from './types';

interface NPCSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
  onUpdateLocalSettings: (updates: Partial<AppSettings>) => void;
}

export const NPCSection = ({ appSettings, onSaveAppSettings, onUpdateLocalSettings }: NPCSectionProps) => {
  const [showElevenLabsKey, setShowElevenLabsKey] = useState(false);
  const [showSimliKey, setShowSimliKey] = useState(false);

  const hasRequiredKeys = !!(
    appSettings.elevenlabsApiKey &&
    appSettings.elevenlabsAgentId &&
    appSettings.simliApiKey &&
    appSettings.simliFaceId
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">NPC Avatar</h2>
        <p className="text-sm text-muted-foreground">Live video AI companion powered by ElevenLabs + Simli</p>
      </div>

      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Video className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Enable NPC Avatar</p>
              <p className="text-sm text-muted-foreground">
                {!hasRequiredKeys
                  ? 'Configure all API keys below to enable'
                  : 'Photorealistic talking avatar that monitors your agents'}
              </p>
            </div>
          </div>
          <Toggle
            enabled={appSettings.npcEnabled}
            onChange={() => onSaveAppSettings({ npcEnabled: !appSettings.npcEnabled })}
            disabled={!hasRequiredKeys}
          />
        </div>

        <div className="space-y-6 pt-6">
          {/* ElevenLabs API Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">ElevenLabs API Key</label>
              <a
                href="https://elevenlabs.io/app/settings/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                Get API key
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <input
                type={showElevenLabsKey ? 'text' : 'password'}
                value={appSettings.elevenlabsApiKey}
                onChange={(e) => onUpdateLocalSettings({ elevenlabsApiKey: e.target.value })}
                onBlur={() => {
                  if (appSettings.elevenlabsApiKey) {
                    onSaveAppSettings({ elevenlabsApiKey: appSettings.elevenlabsApiKey });
                  }
                }}
                placeholder="xi-..."
                className="w-full px-3 py-2 pr-10 bg-secondary border border-border text-sm font-mono focus:border-foreground focus:outline-none"
              />
              <button
                onClick={() => setShowElevenLabsKey(!showElevenLabsKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                {showElevenLabsKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* ElevenLabs Agent ID */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">ElevenLabs Agent ID</label>
              <a
                href="https://elevenlabs.io/app/conversational-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                Create agent
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="text"
              value={appSettings.elevenlabsAgentId}
              onChange={(e) => onUpdateLocalSettings({ elevenlabsAgentId: e.target.value })}
              onBlur={() => {
                if (appSettings.elevenlabsAgentId) {
                  onSaveAppSettings({ elevenlabsAgentId: appSettings.elevenlabsAgentId });
                }
              }}
              placeholder="agent_..."
              className="w-full px-3 py-2 bg-secondary border border-border text-sm font-mono focus:border-foreground focus:outline-none"
            />
          </div>

          {/* Simli API Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Simli API Key</label>
              <a
                href="https://app.simli.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                Get API key
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <input
                type={showSimliKey ? 'text' : 'password'}
                value={appSettings.simliApiKey}
                onChange={(e) => onUpdateLocalSettings({ simliApiKey: e.target.value })}
                onBlur={() => {
                  if (appSettings.simliApiKey) {
                    onSaveAppSettings({ simliApiKey: appSettings.simliApiKey });
                  }
                }}
                placeholder="Enter Simli API key..."
                className="w-full px-3 py-2 pr-10 bg-secondary border border-border text-sm font-mono focus:border-foreground focus:outline-none"
              />
              <button
                onClick={() => setShowSimliKey(!showSimliKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                {showSimliKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Simli Face ID */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Simli Face ID</label>
              <a
                href="https://docs.simli.com/api-reference/available-faces"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                Browse faces
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <input
              type="text"
              value={appSettings.simliFaceId}
              onChange={(e) => onUpdateLocalSettings({ simliFaceId: e.target.value })}
              onBlur={() => {
                if (appSettings.simliFaceId) {
                  onSaveAppSettings({ simliFaceId: appSettings.simliFaceId });
                }
              }}
              placeholder="Enter face ID..."
              className="w-full px-3 py-2 bg-secondary border border-border text-sm font-mono focus:border-foreground focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Setup Guide */}
      <div className="border border-border bg-card p-6">
        <h3 className="font-medium mb-4">Setup Guide</h3>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Create an ElevenLabs account and get your API key</li>
          <li>Create a Conversational AI agent on the ElevenLabs platform</li>
          <li>Create a Simli account and get your API key</li>
          <li>Choose a face ID from the Simli face library</li>
          <li>Enter all credentials above and enable the NPC</li>
          <li>Navigate to the NPC page from the sidebar to start chatting</li>
        </ol>
      </div>
    </div>
  );
};
