'use client';

import { useState } from 'react';
import { Check, Eye, EyeOff, ExternalLink, Loader2 } from 'lucide-react';
import { Toggle } from './Toggle';
import { SlackIcon } from './SlackIcon';
import type { AppSettings } from './types';

interface SlackSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
  onUpdateLocalSettings: (updates: Partial<AppSettings>) => void;
}

export const SlackSection = ({ appSettings, onSaveAppSettings, onUpdateLocalSettings }: SlackSectionProps) => {
  const [showSlackBotToken, setShowSlackBotToken] = useState(false);
  const [showSlackAppToken, setShowSlackAppToken] = useState(false);
  const [testingSlack, setTestingSlack] = useState(false);
  const [slackTestResult, setSlackTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestTokens = async () => {
    if (!window.electronAPI?.slack?.test) return;
    setTestingSlack(true);
    setSlackTestResult(null);
    try {
      const result = await window.electronAPI.slack.test();
      if (result.success) {
        setSlackTestResult({ success: true, message: `Bot @${result.botName} is valid!` });
      } else {
        setSlackTestResult({ success: false, message: result.error || 'Invalid tokens' });
      }
    } catch {
      setSlackTestResult({ success: false, message: 'Failed to test connection' });
    } finally {
      setTestingSlack(false);
    }
  };

  const handleSendTest = async () => {
    if (!window.electronAPI?.slack?.sendTest) return;
    setTestingSlack(true);
    setSlackTestResult(null);
    try {
      const result = await window.electronAPI.slack.sendTest();
      if (result.success) {
        setSlackTestResult({ success: true, message: 'Test message sent!' });
      } else {
        setSlackTestResult({ success: false, message: result.error || 'Failed to send' });
      }
    } catch {
      setSlackTestResult({ success: false, message: 'Failed to send test message' });
    } finally {
      setTestingSlack(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Slack Integration</h2>
        <p className="text-sm text-muted-foreground">Control agents remotely via Slack</p>
      </div>

      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <SlackIcon className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Enable Slack Bot</p>
              <p className="text-sm text-muted-foreground">Receive notifications and send commands via Slack</p>
            </div>
          </div>
          <Toggle
            enabled={appSettings.slackEnabled}
            onChange={() => onSaveAppSettings({ slackEnabled: !appSettings.slackEnabled })}
          />
        </div>

        <div className="space-y-6 pt-6">
          {/* Bot Token */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Bot Token (xoxb-...)</label>
              <a
                href="https://api.slack.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                Get from Slack App
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <input
                type={showSlackBotToken ? 'text' : 'password'}
                value={appSettings.slackBotToken}
                onChange={(e) => onUpdateLocalSettings({ slackBotToken: e.target.value })}
                onBlur={() => {
                  if (appSettings.slackBotToken) {
                    onSaveAppSettings({ slackBotToken: appSettings.slackBotToken });
                  }
                }}
                placeholder="xoxb-..."
                className="w-full px-3 py-2 pr-10 bg-secondary border border-border text-sm font-mono focus:border-foreground focus:outline-none"
              />
              <button
                onClick={() => setShowSlackBotToken(!showSlackBotToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                {showSlackBotToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* App Token */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">App Token (xapp-...)</label>
              <span className="text-xs text-muted-foreground">Required for Socket Mode</span>
            </div>
            <div className="relative">
              <input
                type={showSlackAppToken ? 'text' : 'password'}
                value={appSettings.slackAppToken}
                onChange={(e) => onUpdateLocalSettings({ slackAppToken: e.target.value })}
                onBlur={() => {
                  if (appSettings.slackAppToken) {
                    onSaveAppSettings({ slackAppToken: appSettings.slackAppToken });
                  }
                }}
                placeholder="xapp-..."
                className="w-full px-3 py-2 pr-10 bg-secondary border border-border text-sm font-mono focus:border-foreground focus:outline-none"
              />
              <button
                onClick={() => setShowSlackAppToken(!showSlackAppToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                {showSlackAppToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Channel ID */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Channel ID</label>
              {appSettings.slackChannelId && (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Connected
                </span>
              )}
            </div>
            <input
              type="text"
              value={appSettings.slackChannelId || 'Not connected yet'}
              readOnly
              className="w-full px-3 py-2 bg-secondary border border-border text-sm font-mono text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Auto-detected when you mention the bot or DM it
            </p>
          </div>

          {/* Test Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleTestTokens}
              disabled={!appSettings.slackBotToken || !appSettings.slackAppToken || testingSlack}
              className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
            >
              {testingSlack ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <SlackIcon className="w-4 h-4" />
              )}
              Test Tokens
            </button>
            <button
              onClick={handleSendTest}
              disabled={!appSettings.slackChannelId || testingSlack}
              className="px-4 py-2 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
            >
              <SlackIcon className="w-4 h-4" />
              Send Test
            </button>
          </div>

          {slackTestResult && (
            <div className={`p-3 text-sm ${
              slackTestResult.success
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {slackTestResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Setup Guide */}
      <div className="border border-border bg-card p-6">
        <h3 className="font-medium mb-4">Setup Guide</h3>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">api.slack.com/apps</a> and click &quot;Create New App&quot;</li>
          <li>Choose &quot;From scratch&quot;, name it &quot;Dorothy&quot;, select workspace</li>
          <li>Go to &quot;Socket Mode&quot; → Enable → Generate App Token with scope &quot;connections:write&quot; (xapp-...)</li>
          <li>Go to &quot;OAuth & Permissions&quot; → Add Bot Token Scopes:
            <ul className="ml-4 mt-1 space-y-0.5">
              <li className="text-xs">• app_mentions:read, chat:write, im:history, im:read, im:write</li>
            </ul>
          </li>
          <li>Install to Workspace → Copy Bot Token (xoxb-...)</li>
          <li>Go to &quot;Event Subscriptions&quot; → Enable → Subscribe to: app_mention, message.im</li>
          <li>Go to &quot;App Home&quot; → Scroll to &quot;Show Tabs&quot;:
            <ul className="ml-4 mt-1 space-y-0.5">
              <li className="text-xs">• Enable &quot;Messages Tab&quot;</li>
              <li className="text-xs">• Check &quot;Allow users to send Slash commands and messages from the messages tab&quot;</li>
            </ul>
          </li>
          <li>Paste both tokens above and enable the integration</li>
          <li>Mention @Dorothy in any channel or DM the bot to start!</li>
        </ol>
      </div>
    </div>
  );
};
