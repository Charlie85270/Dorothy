import { Send } from 'lucide-react';
import { SlackIcon } from '@/components/Settings/SlackIcon';

interface NotificationFieldsProps {
  notifyTelegram: boolean;
  onTelegramChange: (value: boolean) => void;
  notifySlack: boolean;
  onSlackChange: (value: boolean) => void;
}

export function NotificationFields({
  notifyTelegram,
  onTelegramChange,
  notifySlack,
  onSlackChange,
}: NotificationFieldsProps) {
  return (
    <div className="border-t border-border pt-4">
      <label className="block text-sm font-medium mb-3">Send results to:</label>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={notifyTelegram}
            onChange={(e) => onTelegramChange(e.target.checked)}
            className="w-4 h-4 rounded border-border"
          />
          <Send className="w-4 h-4 text-blue-400" />
          <span className="text-sm">Telegram</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={notifySlack}
            onChange={(e) => onSlackChange(e.target.checked)}
            className="w-4 h-4 rounded border-border"
          />
          <SlackIcon className="w-4 h-4 text-purple-400" />
          <span className="text-sm">Slack</span>
        </label>
      </div>
    </div>
  );
}
