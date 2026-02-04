'use client';

import { useState } from 'react';
import { Check, Eye, EyeOff, ExternalLink, Loader2, MessageCircle, Send, RefreshCw, Copy, Trash2, Shield } from 'lucide-react';
import { Toggle } from './Toggle';
import type { AppSettings } from './types';

interface TelegramSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
  onUpdateLocalSettings: (updates: Partial<AppSettings>) => void;
}

export const TelegramSection = ({ appSettings, onSaveAppSettings, onUpdateLocalSettings }: TelegramSectionProps) => {
  const [showBotToken, setShowBotToken] = useState(false);
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  const handleTestToken = async () => {
    if (!window.electronAPI?.telegram?.test) return;
    setTestingTelegram(true);
    setTelegramTestResult(null);
    try {
      const result = await window.electronAPI.telegram.test();
      if (result.success) {
        setTelegramTestResult({ success: true, message: `Bot @${result.botName} is valid!` });
      } else {
        setTelegramTestResult({ success: false, message: result.error || 'Invalid token' });
      }
    } catch {
      setTelegramTestResult({ success: false, message: 'Failed to test connection' });
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleSendTest = async () => {
    if (!window.electronAPI?.telegram?.sendTest) return;
    setTestingTelegram(true);
    setTelegramTestResult(null);
    try {
      const result = await window.electronAPI.telegram.sendTest();
      if (result.success) {
        setTelegramTestResult({ success: true, message: 'Test message sent!' });
      } else {
        setTelegramTestResult({ success: false, message: result.error || 'Failed to send' });
      }
    } catch {
      setTelegramTestResult({ success: false, message: 'Failed to send test message' });
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleGenerateAuthToken = async () => {
    if (!window.electronAPI?.telegram?.generateAuthToken) return;
    setGeneratingToken(true);
    try {
      const result = await window.electronAPI.telegram.generateAuthToken();
      if (result.success) {
        onUpdateLocalSettings({ telegramAuthToken: result.token });
      }
    } catch (err) {
      console.error('Failed to generate auth token:', err);
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleCopyAuthToken = async () => {
    if (!appSettings.telegramAuthToken) return;
    try {
      await navigator.clipboard.writeText(appSettings.telegramAuthToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch (err) {
      console.error('Failed to copy token:', err);
    }
  };

  const handleRemoveChatId = async (chatId: string) => {
    if (!window.electronAPI?.telegram?.removeAuthorizedChatId) return;
    try {
      await window.electronAPI.telegram.removeAuthorizedChatId(chatId);
    } catch (err) {
      console.error('Failed to remove chat ID:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Telegram Integration</h2>
        <p className="text-sm text-muted-foreground">Control agents remotely via Telegram bot</p>
      </div>

      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Send className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Enable Telegram Bot</p>
              <p className="text-sm text-muted-foreground">Receive notifications and send commands via Telegram</p>
            </div>
          </div>
          <Toggle
            enabled={appSettings.telegramEnabled}
            onChange={() => onSaveAppSettings({ telegramEnabled: !appSettings.telegramEnabled })}
          />
        </div>

        <div className="space-y-6 pt-6">
          {/* Bot Token */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Bot Token</label>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                Get from @BotFather
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <input
                type={showBotToken ? 'text' : 'password'}
                value={appSettings.telegramBotToken}
                onChange={(e) => onUpdateLocalSettings({ telegramBotToken: e.target.value })}
                onBlur={() => {
                  if (appSettings.telegramBotToken) {
                    onSaveAppSettings({ telegramBotToken: appSettings.telegramBotToken });
                  }
                }}
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz..."
                className="w-full px-3 py-2 pr-10 bg-secondary border border-border text-sm font-mono focus:border-foreground focus:outline-none"
              />
              <button
                onClick={() => setShowBotToken(!showBotToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                {showBotToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Test Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleTestToken}
              disabled={!appSettings.telegramBotToken || testingTelegram}
              className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
            >
              {testingTelegram ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MessageCircle className="w-4 h-4" />
              )}
              Test Token
            </button>
            <button
              onClick={handleSendTest}
              disabled={!appSettings.telegramAuthorizedChatIds?.length || testingTelegram}
              className="px-4 py-2 bg-white text-black hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send Test
            </button>
          </div>

          {telegramTestResult && (
            <div className={`p-3 text-sm ${
              telegramTestResult.success
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {telegramTestResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Authentication Section */}
      <div className="border border-border bg-card p-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <Shield className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="font-medium">Authentication</p>
            <p className="text-sm text-muted-foreground">Secure your bot with token-based authentication</p>
          </div>
        </div>

        <div className="space-y-6 pt-6">
          {/* Auth Token */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Secret Auth Token</label>
              <span className="text-xs text-muted-foreground">Users must provide this to authenticate</span>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showAuthToken ? 'text' : 'password'}
                  value={appSettings.telegramAuthToken || ''}
                  readOnly
                  placeholder="No token generated"
                  className="w-full px-3 py-2 pr-10 bg-secondary border border-border text-sm font-mono text-muted-foreground"
                />
                <button
                  onClick={() => setShowAuthToken(!showAuthToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  disabled={!appSettings.telegramAuthToken}
                >
                  {showAuthToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                onClick={handleCopyAuthToken}
                disabled={!appSettings.telegramAuthToken}
                className="px-3 py-2 bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                title="Copy token"
              >
                {copiedToken ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={handleGenerateAuthToken}
                disabled={generatingToken}
                className="px-3 py-2 bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                title={appSettings.telegramAuthToken ? 'Regenerate token' : 'Generate token'}
              >
                {generatingToken ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {appSettings.telegramAuthToken
                ? 'Share this token with trusted users. They must send /auth <token> to your bot.'
                : 'Generate a token to enable authentication. Without it, anyone can use your bot!'}
            </p>
            {!appSettings.telegramAuthToken && appSettings.telegramEnabled && (
              <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs">
                Warning: No auth token configured. Anyone who finds your bot can control your agents!
              </div>
            )}
          </div>

          {/* Authorized Chat IDs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Authorized Users</label>
              <span className="text-xs text-muted-foreground">
                {appSettings.telegramAuthorizedChatIds?.length || 0} authorized
              </span>
            </div>

            {appSettings.telegramAuthorizedChatIds?.length > 0 ? (
              <div className="space-y-2">
                {appSettings.telegramAuthorizedChatIds.map((chatId) => (
                  <div
                    key={chatId}
                    className="flex items-center justify-between px-3 py-2 bg-secondary border border-border"
                  >
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-400" />
                      <code className="text-sm font-mono">{chatId}</code>
                    </div>
                    <button
                      onClick={() => handleRemoveChatId(chatId)}
                      className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
                      title="Remove authorization"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-3 py-4 bg-secondary border border-border text-sm text-muted-foreground text-center">
                No authorized users yet. Users must authenticate with /auth &lt;token&gt;
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Setup Guide */}
      <div className="border border-border bg-card p-6">
        <h3 className="font-medium mb-4">Setup Guide</h3>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Open Telegram and search for @BotFather</li>
          <li>Send /newbot and follow the instructions</li>
          <li>Copy the bot token and paste it above</li>
          <li>Generate an auth token using the button above</li>
          <li>Open your new bot and send <code className="bg-secondary px-1">/auth &lt;token&gt;</code></li>
          <li>You&apos;re ready to control agents remotely!</li>
        </ol>
      </div>
    </div>
  );
};
