'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2, Twitter, CheckCircle, XCircle, Send } from 'lucide-react';
import { Toggle } from './Toggle';
import type { AppSettings } from './types';

interface SecretInputProps {
  value: string;
  show: boolean;
  onToggle: () => void;
  onChange: (v: string) => void;
  onBlur: () => void;
  placeholder: string;
}

const SecretInput = ({ value, show, onToggle, onChange, onBlur, placeholder }: SecretInputProps) => (
  <div className="relative">
    <input
      type={show ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className="w-full px-3 py-2 pr-10 bg-secondary border border-border text-sm font-mono focus:border-foreground focus:outline-none"
    />
    <button
      onClick={onToggle}
      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
    >
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  </div>
);

interface SocialDataSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
  onUpdateLocalSettings: (updates: Partial<AppSettings>) => void;
}

export const SocialDataSection = ({ appSettings, onSaveAppSettings, onUpdateLocalSettings }: SocialDataSectionProps) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showXApiKey, setShowXApiKey] = useState(false);
  const [showXApiSecret, setShowXApiSecret] = useState(false);
  const [showXAccessToken, setShowXAccessToken] = useState(false);
  const [showXAccessTokenSecret, setShowXAccessTokenSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingX, setTestingX] = useState(false);
  const [testXResult, setTestXResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    if (!window.electronAPI?.socialData?.test) return;
    setTesting(true);
    setTestResult(null);
    try {
      onSaveAppSettings({
        socialDataApiKey: appSettings.socialDataApiKey,
      });
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

  const handleTestXConnection = async () => {
    setTestingX(true);
    setTestXResult(null);
    try {
      // Save credentials first so the main process has them
      onSaveAppSettings({
        xApiKey: appSettings.xApiKey,
        xApiSecret: appSettings.xApiSecret,
        xAccessToken: appSettings.xAccessToken,
        xAccessTokenSecret: appSettings.xAccessTokenSecret,
      });
      await new Promise(r => setTimeout(r, 500));

      if (!window.electronAPI?.xApi?.test) {
        setTestXResult({ success: false, message: 'X API bridge not available. Please restart the app.' });
        return;
      }

      const result = await window.electronAPI.xApi.test();
      if (result.success) {
        setTestXResult({ success: true, message: result.username ? `Authenticated as @${result.username}` : 'X API credentials are valid!' });
      } else {
        setTestXResult({ success: false, message: result.error || 'Connection failed' });
      }
    } catch (err) {
      setTestXResult({ success: false, message: `Connection failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setTestingX(false);
    }
  };

  const canEnable = !!appSettings.socialDataApiKey;
  const canEnableXPosting = !!(appSettings.xApiKey && appSettings.xApiSecret && appSettings.xAccessToken && appSettings.xAccessTokenSecret);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">X (Twitter) Integration</h2>
        <p className="text-sm text-muted-foreground">Read tweets via SocialData and post tweets via the X API. Agents can search, analyze, and publish content.</p>
      </div>

      {/* ============== Reading: SocialData ============== */}
      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Twitter className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Read — SocialData API</p>
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
            <SecretInput
              value={appSettings.socialDataApiKey}
              show={showApiKey}
              onToggle={() => setShowApiKey(!showApiKey)}
              onChange={(v) => onUpdateLocalSettings({ socialDataApiKey: v })}
              onBlur={() => {
                if (appSettings.socialDataApiKey) {
                  onSaveAppSettings({ socialDataApiKey: appSettings.socialDataApiKey });
                }
              }}
              placeholder="sd_..."
            />
          </div>

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

      {/* ============== Posting: X API ============== */}
      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Send className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Post — X API (OAuth 1.0a)</p>
              <p className="text-sm text-muted-foreground">
                {canEnableXPosting
                  ? 'Let agents post tweets on your behalf'
                  : 'Add your X API credentials below to enable'}
              </p>
            </div>
          </div>
          <Toggle
            enabled={appSettings.xPostingEnabled}
            onChange={() => onSaveAppSettings({ xPostingEnabled: !appSettings.xPostingEnabled })}
            disabled={!canEnableXPosting}
          />
        </div>

        <div className="space-y-4 pt-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">API Key (Consumer Key)</label>
              <a
                href="https://developer.x.com/en/portal/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                X Developer Portal
              </a>
            </div>
            <SecretInput
              value={appSettings.xApiKey}
              show={showXApiKey}
              onToggle={() => setShowXApiKey(!showXApiKey)}
              onChange={(v) => onUpdateLocalSettings({ xApiKey: v })}
              onBlur={() => {
                if (appSettings.xApiKey) {
                  onSaveAppSettings({ xApiKey: appSettings.xApiKey });
                }
              }}
              placeholder="Consumer key..."
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">API Secret (Consumer Secret)</label>
            <SecretInput
              value={appSettings.xApiSecret}
              show={showXApiSecret}
              onToggle={() => setShowXApiSecret(!showXApiSecret)}
              onChange={(v) => onUpdateLocalSettings({ xApiSecret: v })}
              onBlur={() => {
                if (appSettings.xApiSecret) {
                  onSaveAppSettings({ xApiSecret: appSettings.xApiSecret });
                }
              }}
              placeholder="Consumer secret..."
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Access Token</label>
            <SecretInput
              value={appSettings.xAccessToken}
              show={showXAccessToken}
              onToggle={() => setShowXAccessToken(!showXAccessToken)}
              onChange={(v) => onUpdateLocalSettings({ xAccessToken: v })}
              onBlur={() => {
                if (appSettings.xAccessToken) {
                  onSaveAppSettings({ xAccessToken: appSettings.xAccessToken });
                }
              }}
              placeholder="Access token..."
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Access Token Secret</label>
            <SecretInput
              value={appSettings.xAccessTokenSecret}
              show={showXAccessTokenSecret}
              onToggle={() => setShowXAccessTokenSecret(!showXAccessTokenSecret)}
              onChange={(v) => onUpdateLocalSettings({ xAccessTokenSecret: v })}
              onBlur={() => {
                if (appSettings.xAccessTokenSecret) {
                  onSaveAppSettings({ xAccessTokenSecret: appSettings.xAccessTokenSecret });
                }
              }}
              placeholder="Access token secret..."
            />
          </div>

          <div>
            <button
              onClick={handleTestXConnection}
              disabled={!canEnableXPosting || testingX}
              className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
            >
              {testingX ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Test X API
            </button>
          </div>

          {testXResult && (
            <div className={`p-3 text-sm flex rounded-md items-center gap-2 ${testXResult.success
              ? 'bg-green-700/10 text-green-700 border border-green-700/20'
              : 'bg-red-700/10 text-red-700 border border-red-700/20'
              }`}>
              {testXResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
              {testXResult.message}
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
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reading (SocialData)</p>
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
          <div className="border-t border-border my-3" />
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Posting (X API)</p>
          <div className="flex gap-3">
            <code className="bg-secondary px-2 py-0.5 text-xs font-mono shrink-0">x_post_tweet</code>
            <span className="text-muted-foreground">Post a new tweet on your behalf</span>
          </div>
          <div className="flex gap-3">
            <code className="bg-secondary px-2 py-0.5 text-xs font-mono shrink-0">x_reply_tweet</code>
            <span className="text-muted-foreground">Reply to an existing tweet by ID</span>
          </div>
          <div className="flex gap-3">
            <code className="bg-secondary px-2 py-0.5 text-xs font-mono shrink-0">x_delete_tweet</code>
            <span className="text-muted-foreground">Delete a tweet by ID</span>
          </div>
        </div>
      </div>

      {/* Setup Guide */}
      <div className="border border-border bg-card p-6">
        <h3 className="font-medium mb-4">Setup Guide</h3>

        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Reading (SocialData)</p>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside mb-6">
          <li>Create an account at <code className="bg-secondary px-1">socialdata.tools</code></li>
          <li>Generate an API key from your dashboard</li>
          <li>Paste the API key above and click &quot;Test Connection&quot;</li>
          <li>Enable the integration with the toggle</li>
        </ol>

        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Posting (X API)</p>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Go to the <a href="https://developer.x.com/en/portal/dashboard" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">X Developer Portal</a></li>
          <li>Create a project &amp; app (Free tier works for posting)</li>
          <li>Under &quot;Keys and tokens&quot;, generate your Consumer Keys and Access Token</li>
          <li>Make sure the Access Token has <strong>Read and Write</strong> permissions</li>
          <li>Paste all 4 credentials above and click &quot;Test X API&quot;</li>
          <li>Enable posting with the toggle</li>
        </ol>
      </div>
    </div>
  );
};
