import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, CheckCircle, Loader2 } from 'lucide-react';
import type { SelectedLogs } from '../types';

interface LogsModalProps {
  selectedLogs: SelectedLogs | null;
  onClose: () => void;
  onRunIndexChange: (index: number) => void;
  logsContainerRef: React.RefObject<HTMLDivElement | null>;
}

function parseLogContent(selectedLogs: SelectedLogs): string {
  const raw = selectedLogs.runs.length > 0
    ? (selectedLogs.runs[selectedLogs.selectedRunIndex]?.content || 'No content for this run')
    : (selectedLogs.logs || 'No logs available');

  return raw.split('\n').map((line: string) => {
    if (!line.trim()) return '\n';
    try {
      const obj = JSON.parse(line);
      if (obj.type === 'assistant' && obj.message?.content) {
        const parts: string[] = [];
        for (const block of obj.message.content) {
          if (block.type === 'text' && block.text) parts.push(block.text);
          if (block.type === 'tool_use') parts.push(`\u2699 ${block.name}`);
        }
        return parts.length ? parts.join(' ') + '\n' : null;
      }
      if (obj.type === 'user' && obj.tool_use_result) {
        const result = Array.isArray(obj.tool_use_result)
          ? obj.tool_use_result.map((r: { text?: string }) => r.text || '').join('')
          : String(obj.tool_use_result);
        if (result.startsWith('{') || result.startsWith('[')) {
          try { return JSON.stringify(JSON.parse(result), null, 2) + '\n'; } catch { return result + '\n'; }
        }
        return result + '\n';
      }
      if (obj.type === 'result') return (obj.result || '') + '\n';
      return null;
    } catch {
      return line + '\n';
    }
  }).filter(Boolean).join('');
}

export function LogsModal({ selectedLogs, onClose, onRunIndexChange, logsContainerRef }: LogsModalProps) {
  return (
    <AnimatePresence>
      {selectedLogs && (
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
            className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-border flex items-center justify-between gap-3">
              <h2 className="font-semibold shrink-0">Task Logs</h2>
              {selectedLogs.runs.length > 1 && (
                <select
                  value={selectedLogs.selectedRunIndex}
                  onChange={(e) => onRunIndexChange(parseInt(e.target.value))}
                  className="flex-1 min-w-0 px-3 py-1.5 text-sm bg-secondary border border-border rounded-lg truncate"
                >
                  {selectedLogs.runs.map((run, i) => (
                    <option key={i} value={i}>
                      {run.startedAt}{!run.completedAt ? ' (running)' : ''}
                    </option>
                  ))}
                </select>
              )}
              {selectedLogs.runs.length === 1 && (
                <span className="text-xs text-muted-foreground truncate">
                  {selectedLogs.runs[0].startedAt}{!selectedLogs.runs[0].completedAt ? ' (running)' : ''}
                </span>
              )}
              <button
                onClick={onClose}
                className="p-1 hover:bg-secondary rounded-lg transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {selectedLogs.runs.length > 0 && selectedLogs.runs[selectedLogs.selectedRunIndex] && (
              <div className="px-4 py-2 border-b border-border flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Started: {selectedLogs.runs[selectedLogs.selectedRunIndex].startedAt}
                </div>
                {selectedLogs.runs[selectedLogs.selectedRunIndex].completedAt ? (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    Completed: {selectedLogs.runs[selectedLogs.selectedRunIndex].completedAt}
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Still running...
                  </div>
                )}
              </div>
            )}
            <div ref={logsContainerRef} className="flex-1 overflow-auto p-4 bg-[#0D0B08]">
              <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">
                {parseLogContent(selectedLogs)}
              </pre>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
