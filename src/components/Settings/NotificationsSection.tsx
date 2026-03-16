import { Bell, BellOff, Music, X } from 'lucide-react';
import { Toggle } from './Toggle';
import type { AppSettings } from './types';

interface NotificationsSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
}

type SoundKey = 'waiting' | 'complete' | 'stop' | 'error';

function SoundPicker({
  label,
  soundKey,
  appSettings,
  onSaveAppSettings,
}: {
  label: string;
  soundKey: SoundKey;
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
}) {
  const currentPath = appSettings.notificationSounds?.[soundKey];
  const fileName = currentPath ? currentPath.split('/').pop() : null;

  const handlePick = async () => {
    if (!window.electronAPI?.dialog?.openAudio) return;
    const filePath = await window.electronAPI.dialog.openAudio();
    if (filePath) {
      onSaveAppSettings({
        notificationSounds: {
          ...appSettings.notificationSounds,
          [soundKey]: filePath,
        },
      });
    }
  };

  const handleClear = () => {
    const updated = { ...appSettings.notificationSounds };
    delete updated[soundKey];
    onSaveAppSettings({ notificationSounds: updated });
  };

  return (
    <div className="flex items-center gap-2 mt-1.5">
      <Music className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      <span className="text-[10px] text-muted-foreground flex-shrink-0">{label}:</span>
      {fileName ? (
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-mono text-foreground truncate max-w-[140px]">{fileName}</span>
          <button
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground p-0.5 flex-shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={handlePick}
          className="text-[10px] text-muted-foreground hover:text-foreground underline"
        >
          Choose file
        </button>
      )}
    </div>
  );
}

export const NotificationsSection = ({ appSettings, onSaveAppSettings }: NotificationsSectionProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Notifications</h2>
        <p className="text-sm text-muted-foreground">Configure desktop notifications for agent events</p>
      </div>

      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            {appSettings.notificationsEnabled ? (
              <Bell className="w-5 h-5 text-muted-foreground" />
            ) : (
              <BellOff className="w-5 h-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">Enable Notifications</p>
              <p className="text-sm text-muted-foreground">Master toggle for all desktop notifications</p>
            </div>
          </div>
          <Toggle
            enabled={appSettings.notificationsEnabled}
            onChange={() => onSaveAppSettings({ notificationsEnabled: !appSettings.notificationsEnabled })}
          />
        </div>

        <div className={`space-y-4 pt-4 ${!appSettings.notificationsEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Waiting for Input</p>
                <p className="text-xs text-muted-foreground">
                  Triggered when a permission dialog appears or the agent needs user input.
                  Uses the <span className="font-mono text-[10px] bg-muted px-1 rounded">PermissionRequest</span> and <span className="font-mono text-[10px] bg-muted px-1 rounded">Notification</span> hooks.
                </p>
              </div>
              <Toggle
                enabled={appSettings.notifyOnWaiting}
                onChange={() => onSaveAppSettings({ notifyOnWaiting: !appSettings.notifyOnWaiting })}
              />
            </div>
            <SoundPicker label="Sound" soundKey="waiting" appSettings={appSettings} onSaveAppSettings={onSaveAppSettings} />
          </div>

          <div className="py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Response Finished</p>
                <p className="text-xs text-muted-foreground">
                  Triggered every time an agent finishes responding and is ready for the next prompt.
                  Uses the <span className="font-mono text-[10px] bg-muted px-1 rounded">Stop</span> hook.
                  Could spam your notifications if you have a lot of agents.
                </p>
              </div>
              <Toggle
                enabled={appSettings.notifyOnStop}
                onChange={() => onSaveAppSettings({ notifyOnStop: !appSettings.notifyOnStop })}
              />
            </div>
            <SoundPicker label="Sound" soundKey="stop" appSettings={appSettings} onSaveAppSettings={onSaveAppSettings} />
          </div>

          <div className="py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Task Complete</p>
                <p className="text-xs text-muted-foreground">
                  Triggered when an agent explicitly marks a task as done.
                  Uses the <span className="font-mono text-[10px] bg-muted px-1 rounded">TaskCompleted</span> hook.
                </p>
              </div>
              <Toggle
                enabled={appSettings.notifyOnComplete}
                onChange={() => onSaveAppSettings({ notifyOnComplete: !appSettings.notifyOnComplete })}
              />
            </div>
            <SoundPicker label="Sound" soundKey="complete" appSettings={appSettings} onSaveAppSettings={onSaveAppSettings} />
          </div>

          <div className="py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Error Alerts</p>
                <p className="text-xs text-muted-foreground">
                  Triggered when an agent process crashes or exits with a non-zero code.
                  Fires from the PTY exit handler.
                </p>
              </div>
              <Toggle
                enabled={appSettings.notifyOnError}
                onChange={() => onSaveAppSettings({ notifyOnError: !appSettings.notifyOnError })}
              />
            </div>
            <SoundPicker label="Sound" soundKey="error" appSettings={appSettings} onSaveAppSettings={onSaveAppSettings} />
          </div>
        </div>
      </div>
    </div>
  );
};
