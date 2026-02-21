'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Loader2, AlertCircle, Check, RefreshCw } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import {
  SettingsSidebar,
  InstallTerminalModal,
  GeneralSection,
  GitSection,
  NotificationsSection,
  TelegramSection,
  SlackSection,
  JiraSection,
  SocialDataSection,
  TasmaniaSection,
  CodexSection,
  PermissionsSection,
  SkillsSection,
  CLIPathsSection,
  SystemSection,
} from '@/components/Settings';
import type { SettingsSection } from '@/components/Settings';
import 'xterm/css/xterm.css';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [showInstallTerminal, setShowInstallTerminal] = useState(false);
  const [installCommand, setInstallCommand] = useState('');

  const {
    settings,
    appSettings,
    info,
    skills,
    loading,
    saving,
    error,
    saved,
    hasChanges,
    fetchSettings,
    handleSave,
    handleSaveAppSettings,
    updateSettings,
    updateLocalAppSettings,
  } = useSettings();

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return <GeneralSection info={info} appSettings={appSettings} onSaveAppSettings={handleSaveAppSettings} />;
      case 'git':
        return <GitSection settings={settings} onUpdateSettings={updateSettings} />;
      case 'notifications':
        return (
          <NotificationsSection
            appSettings={appSettings}
            onSaveAppSettings={handleSaveAppSettings}
          />
        );
      case 'telegram':
        return (
          <TelegramSection
            appSettings={appSettings}
            onSaveAppSettings={handleSaveAppSettings}
            onUpdateLocalSettings={updateLocalAppSettings}
          />
        );
      case 'slack':
        return (
          <SlackSection
            appSettings={appSettings}
            onSaveAppSettings={handleSaveAppSettings}
            onUpdateLocalSettings={updateLocalAppSettings}
          />
        );
      case 'jira':
        return (
          <JiraSection
            appSettings={appSettings}
            onSaveAppSettings={handleSaveAppSettings}
            onUpdateLocalSettings={updateLocalAppSettings}
          />
        );
      case 'socialdata':
        return (
          <SocialDataSection
            appSettings={appSettings}
            onSaveAppSettings={handleSaveAppSettings}
            onUpdateLocalSettings={updateLocalAppSettings}
          />
        );
      case 'tasmania':
        return (
          <TasmaniaSection
            appSettings={appSettings}
            onSaveAppSettings={handleSaveAppSettings}
            onUpdateLocalSettings={updateLocalAppSettings}
          />
        );
      case 'codex':
        return (
          <CodexSection
            appSettings={appSettings}
            onSaveAppSettings={handleSaveAppSettings}
            onUpdateLocalSettings={updateLocalAppSettings}
          />
        );
      case 'permissions':
        return <PermissionsSection settings={settings} />;
      case 'skills':
        return <SkillsSection skills={skills} />;
      case 'cli':
        return (
          <CLIPathsSection
            appSettings={appSettings}
            onSaveAppSettings={handleSaveAppSettings}
          />
        );
      case 'system':
        return (
          <SystemSection
            info={info}
            appSettings={appSettings}
            onSaveAppSettings={handleSaveAppSettings}
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-white mx-auto mb-4" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center text-red-400">
          <AlertCircle className="w-8 h-8 mx-auto mb-4" />
          <p className="mb-2">Failed to load settings</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)] pt-4 lg:pt-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 shrink-0">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground text-xs lg:text-sm mt-1 hidden sm:block">
            Configure Dorothy preferences
          </p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={fetchSettings}
            className="px-3 lg:px-4 py-2 border border-border text-muted-foreground hover:text-foreground hover:border-foreground transition-colors flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`px-3 lg:px-4 py-2 flex items-center gap-2 transition-all text-sm ${
              hasChanges
                ? 'bg-foreground text-background hover:bg-foreground/90'
                : 'bg-secondary text-muted-foreground cursor-not-allowed'
            }`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}</span>
            <span className="sm:hidden">{saving ? '...' : saved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && settings && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4 shrink-0">
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
        <SettingsSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />

        {/* Content Area */}
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.15 }}
          className="flex-1 overflow-y-auto pr-2"
        >
          {renderContent()}
        </motion.div>
      </div>

      {/* Installation Terminal Modal */}
      <AnimatePresence>
        {showInstallTerminal && (
          <InstallTerminalModal
            show={showInstallTerminal}
            command={installCommand}
            onClose={() => setShowInstallTerminal(false)}
            onComplete={fetchSettings}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
