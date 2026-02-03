import { Bell, BellOff } from 'lucide-react';
import { Toggle } from './Toggle';
import type { AppSettings } from './types';

interface NotificationsSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (updates: Partial<AppSettings>) => void;
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
              <p className="text-sm text-muted-foreground">Receive desktop notifications for agent events</p>
            </div>
          </div>
          <Toggle
            enabled={appSettings.notificationsEnabled}
            onChange={() => onSaveAppSettings({ notificationsEnabled: !appSettings.notificationsEnabled })}
          />
        </div>

        <div className={`space-y-4 pt-4 ${!appSettings.notificationsEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium">Waiting for Input</p>
              <p className="text-xs text-muted-foreground">Notify when an agent needs user input</p>
            </div>
            <Toggle
              enabled={appSettings.notifyOnWaiting}
              onChange={() => onSaveAppSettings({ notifyOnWaiting: !appSettings.notifyOnWaiting })}
            />
          </div>

          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium">Task Complete</p>
              <p className="text-xs text-muted-foreground">Notify when an agent completes a task</p>
            </div>
            <Toggle
              enabled={appSettings.notifyOnComplete}
              onChange={() => onSaveAppSettings({ notifyOnComplete: !appSettings.notifyOnComplete })}
            />
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium">Error Alerts</p>
              <p className="text-xs text-muted-foreground">Notify when an agent encounters an error</p>
            </div>
            <Toggle
              enabled={appSettings.notifyOnError}
              onChange={() => onSaveAppSettings({ notifyOnError: !appSettings.notifyOnError })}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
