'use client';

import { useState } from 'react';
import { Check, Eye, EyeOff, ExternalLink, Loader2, MessageCircle, Send } from 'lucide-react';
import { Toggle } from './Toggle';
import type { AppSettings } from './types';

interface TelegramSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
  onUpdateLocalSettings: (updates: Partial<AppSettings>) => void;
}

export const TelegramSection = ({ appSettings, onSaveAppSettings, onUpdateLocalSettings }: TelegramSectionProps) => {
  const [showBotToken, setShowBotToken] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ success: boolean; message: string } | null>(null);

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

          {/* Chat ID */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Chat ID</label>
              {appSettings.telegramChatId && (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Connected
                </span>
              )}
            </div>
            <input
              type="text"
              value={appSettings.telegramChatId || 'Not connected yet'}
              readOnly
              className="w-full px-3 py-2 bg-secondary border border-border text-sm font-mono text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Auto-detected when you send /start to your bot
            </p>
          </div>

          {/* Test Buttons */}
          <div className="flex items-center gap-3 pt-2">
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
              disabled={!appSettings.telegramChatId || testingTelegram}
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

      {/* Setup Guide */}
      <div className="border border-border bg-card p-6">
        <h3 className="font-medium mb-4">Setup Guide</h3>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Open Telegram and search for @BotFather</li>
          <li>Send /newbot and follow the instructions</li>
          <li>Copy the bot token and paste it above</li>
          <li>Open your new bot and send /start</li>
          <li>You&apos;re ready to control agents remotely!</li>
        </ol>
      </div>
    </div>
  );
};
