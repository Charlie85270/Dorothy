'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2, Twitter, CheckCircle, XCircle } from 'lucide-react';
import { Toggle } from './Toggle';
import type { AppSettings } from './types';

interface SocialDataSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
  onUpdateLocalSettings: (updates: Partial<AppSettings>) => void;
}

export const SocialDataSection = ({ appSettings, onSaveAppSettings, onUpdateLocalSettings }: SocialDataSectionProps) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    if (!window.electronAPI?.socialData?.test) return;
    setTesting(true);
    setTestResult(null);
    try {
      // Save the key first so the main process has it
      onSaveAppSettings({
        socialDataApiKey: appSettings.socialDataApiKey,
      });
      // Small delay to let settings save
      await new Promise(r => setTimeout(r, 300));

      const result = await window.electronAPI.socialData.test();
      if (result.success) {
        setTestResult({ success: true, message: 'API key is valid! Connected to SocialData.' });
      } else {
        setTestResult({ success: false, message: result.error || 'Connection failed' });
      }
    } catch (err) {
      setTestResult({ success: false, message: `Connection failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setTesting(false);
    }
  };

  const canEnable = !!appSettings.socialDataApiKey;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">SocialData Integration</h2>
        <p className="text-sm text-muted-foreground">Search Twitter/X content via the SocialData API. Agents can search tweets, get user profiles, and analyze engagement.</p>
      </div>

      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Twitter className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Enable SocialData</p>
              <p className="text-sm text-muted-foreground">
                {canEnable
                  ? 'Let agents search and analyze Twitter/X data'
                  : 'Add your API key below to enable'}
              </p>
            </div>
          </div>
          <Toggle
            enabled={appSettings.socialDataEnabled}
            onChange={() => onSaveAppSettings({ socialDataEnabled: !appSettings.socialDataEnabled })}
            disabled={!canEnable}
          />
        </div>

        <div className="space-y-6 pt-6">
          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">API Key</label>
              <a
                href="https://socialdata.tools"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Get an API key
              </a>
            </div>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={appSettings.socialDataApiKey}
                onChange={(e) => onUpdateLocalSettings({ socialDataApiKey: e.target.value })}
                onBlur={() => {
                  if (appSettings.socialDataApiKey) {
                    onSaveAppSettings({ socialDataApiKey: appSettings.socialDataApiKey });
                  }
                }}
                placeholder="sd_..."
                className="w-full px-3 py-2 pr-10 bg-secondary border border-border text-sm font-mono focus:border-foreground focus:outline-none"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Test Connection */}
          <div>
            <button
              onClick={handleTestConnection}
              disabled={!canEnable || testing}
              className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Twitter className="w-4 h-4" />
              )}
              Test Connection
            </button>
          </div>

          {testResult && (
            <div className={`p-3 text-sm flex rounded-md items-center gap-2 ${testResult.success
              ? 'bg-green-700/10 text-green-700 border border-green-700/20'
              : 'bg-red-700/10 text-red-700 border border-red-700/20'
              }`}>
              {testResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
              {testResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Available Tools */}
      <div className="border border-border bg-card p-6">
        <h3 className="font-medium mb-4">Available Agent Tools</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Once enabled, all agents will have access to these MCP tools:
        </p>
        <div className="space-y-3 text-sm">
          <div className="flex gap-3">
            <code className="bg-secondary px-2 py-0.5 text-xs font-mono shrink-0">twitter_search</code>
            <span className="text-muted-foreground">Search tweets with advanced operators (from:user, min_faves:100, filter:images, etc.)</span>
          </div>
          <div className="flex gap-3">
            <code className="bg-secondary px-2 py-0.5 text-xs font-mono shrink-0">twitter_get_tweet</code>
            <span className="text-muted-foreground">Get full details of a tweet by ID (engagement, media, mentions)</span>
          </div>
          <div className="flex gap-3">
            <code className="bg-secondary px-2 py-0.5 text-xs font-mono shrink-0">twitter_get_user</code>
            <span className="text-muted-foreground">Get a user profile by username (bio, followers, join date)</span>
          </div>
          <div className="flex gap-3">
            <code className="bg-secondary px-2 py-0.5 text-xs font-mono shrink-0">twitter_get_user_tweets</code>
            <span className="text-muted-foreground">Get recent tweets from a user by their ID</span>
          </div>
          <div className="flex gap-3">
            <code className="bg-secondary px-2 py-0.5 text-xs font-mono shrink-0">twitter_get_tweet_comments</code>
            <span className="text-muted-foreground">Get replies/comments on a tweet</span>
          </div>
        </div>
      </div>

      {/* Setup Guide */}
      <div className="border border-border bg-card p-6">
        <h3 className="font-medium mb-4">Setup Guide</h3>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Create an account at <code className="bg-secondary px-1">socialdata.tools</code></li>
          <li>Generate an API key from your dashboard</li>
          <li>Paste the API key above and click &quot;Test Connection&quot;</li>
          <li>Enable the integration with the toggle</li>
          <li>Your agents can now search Twitter/X using the tools above</li>
        </ol>
        <p className="text-xs text-muted-foreground mt-4">
          Pricing: ~$0.20 per 1,000 requests. 3 free requests/minute on the free tier.
        </p>
      </div>
    </div>
  );
};
