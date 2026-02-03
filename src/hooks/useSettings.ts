'use client';

import { useState, useEffect, useCallback } from 'react';
import { isElectron } from '@/hooks/useElectron';
import type { ClaudeSettings, ClaudeInfo, Skill, AppSettings } from '@/components/Settings/types';
import { DEFAULT_APP_SETTINGS } from '@/components/Settings/constants';

export const useSettings = () => {
  const [settings, setSettings] = useState<ClaudeSettings | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [info, setInfo] = useState<ClaudeInfo | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!isElectron() || !window.electronAPI?.settings) {
      setError('Settings are only available in the desktop app');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [settingsData, infoData, claudeData, appSettingsData] = await Promise.all([
        window.electronAPI.settings.get(),
        window.electronAPI.settings.getInfo(),
        window.electronAPI.claude?.getData(),
        window.electronAPI.appSettings?.get(),
      ]);

      if (settingsData) {
        setSettings(settingsData);
      }
      if (infoData) {
        setInfo(infoData);
      }
      if (claudeData?.skills) {
        setSkills(claudeData.skills);
      }
      if (appSettingsData) {
        setAppSettings(prev => ({ ...prev, ...appSettingsData }));
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!settings || !window.electronAPI?.settings) return;

    try {
      setSaving(true);
      const result = await window.electronAPI.settings.save(settings);

      if (result.success) {
        setSaved(true);
        setHasChanges(false);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(result.error || 'Failed to save settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAppSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = { ...appSettings, ...newSettings };
    setAppSettings(updated);

    if (!window.electronAPI?.appSettings) return;

    try {
      const result = await window.electronAPI.appSettings.save(updated);
      if (!result.success) {
        setError(result.error || 'Failed to save notification settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notification settings');
    }
  };

  const updateSettings = (updates: Partial<ClaudeSettings>) => {
    if (!settings) return;
    setSettings({ ...settings, ...updates });
    setHasChanges(true);
  };

  const updateLocalAppSettings = (updates: Partial<AppSettings>) => {
    setAppSettings(prev => ({ ...prev, ...updates }));
  };

  return {
    // State
    settings,
    appSettings,
    info,
    skills,
    loading,
    saving,
    error,
    saved,
    hasChanges,
    // Actions
    fetchSettings,
    handleSave,
    handleSaveAppSettings,
    updateSettings,
    updateLocalAppSettings,
  };
};
