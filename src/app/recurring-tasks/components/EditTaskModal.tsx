import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import type { ScheduledTask } from '../types';
import { ScheduleFieldPicker } from './ScheduleFieldPicker';
import { TaskOptionsFields } from './TaskOptionsFields';
import { NotificationFields } from './NotificationFields';

interface EditTaskModalProps {
  task: ScheduledTask | null;
  onClose: () => void;
  editForm: {
    title: string;
    prompt: string;
    schedulePreset: string;
    customCron: string;
    time: string;
    intervalDays: number;
    selectedDays: string[];
    projectPath: string;
    autonomous: boolean;
    notifyTelegram: boolean;
    notifySlack: boolean;
  };
  onFormChange: (data: EditTaskModalProps['editForm']) => void;
  isSaving: boolean;
  onSave: () => void;
}

export function EditTaskModal({
  task,
  onClose,
  editForm,
  onFormChange,
  isSaving,
  onSave,
}: EditTaskModalProps) {
  return (
    <AnimatePresence>
      {task && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit Scheduled Task</h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-secondary rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => onFormChange({ ...editForm, title: e.target.value })}
                  placeholder="e.g. Daily code review"
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-sm"
                />
              </div>

              {/* Project Path */}
              <div>
                <label className="block text-sm font-medium mb-2">Project Path</label>
                <input
                  type="text"
                  value={editForm.projectPath}
                  onChange={(e) => onFormChange({ ...editForm, projectPath: e.target.value })}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg font-mono text-sm"
                />
              </div>

              {/* Prompt */}
              <div>
                <label className="block text-sm font-medium mb-2">Task Prompt</label>
                <textarea
                  value={editForm.prompt}
                  onChange={(e) => onFormChange({ ...editForm, prompt: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 bg-secondary border border-border rounded-lg resize-none text-sm"
                />
              </div>

              {/* Schedule */}
              <ScheduleFieldPicker
                value={{
                  schedulePreset: editForm.schedulePreset,
                  customCron: editForm.customCron,
                  time: editForm.time,
                  intervalDays: editForm.intervalDays,
                  selectedDays: editForm.selectedDays,
                }}
                onChange={(fields) => onFormChange({ ...editForm, ...fields })}
              />

              {/* Options */}
              <TaskOptionsFields
                autonomous={editForm.autonomous}
                onAutonomousChange={(v) => onFormChange({ ...editForm, autonomous: v })}
              />

              {/* Notifications */}
              <NotificationFields
                notifyTelegram={editForm.notifyTelegram}
                onTelegramChange={(v) => onFormChange({ ...editForm, notifyTelegram: v })}
                notifySlack={editForm.notifySlack}
                onSlackChange={(v) => onFormChange({ ...editForm, notifySlack: v })}
              />
            </div>

            <div className="p-6 border-t border-border flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm hover:bg-secondary rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={isSaving || !editForm.prompt.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
