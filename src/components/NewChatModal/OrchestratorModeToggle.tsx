import { useState, useEffect } from 'react';
import {
  X,
  Check,
  Zap,
  Loader2,
  CheckCircle,
  XCircle,
  Crown,
} from 'lucide-react';
import { isElectron } from '@/hooks/useElectron';

// Module-level cache: avoids re-running the slow IPC call every time Step 3 mounts
let cachedStatus: 'configured' | 'not-configured' | 'error' | null = null;
let cachedError: string | null = null;

interface OrchestratorModeToggleProps {
  isOrchestrator: boolean;
  onToggle: (enabled: boolean) => void;
}

export default function OrchestratorModeToggle({
  isOrchestrator,
  onToggle,
}: OrchestratorModeToggleProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'configured' | 'not-configured' | 'error'>(
    cachedStatus ?? 'idle'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(cachedError);
  const [isSettingUp, setIsSettingUp] = useState(false);

  useEffect(() => {
    // Use cached result if available — instant, no IPC call
    if (cachedStatus) {
      setStatus(cachedStatus);
      setErrorMessage(cachedError);
      return;
    }

    const checkStatus = async () => {
      if (!window.electronAPI?.orchestrator?.getStatus) {
        cachedStatus = 'error';
        cachedError = 'Orchestrator API not available';
        setStatus('error');
        setErrorMessage(cachedError);
        return;
      }

      setStatus('loading');
      try {
        const result = await window.electronAPI.orchestrator.getStatus();
        if (result.error) {
          cachedStatus = 'error';
          cachedError = result.error;
          setStatus('error');
          setErrorMessage(result.error);
        } else if (result.configured) {
          cachedStatus = 'configured';
          cachedError = null;
          setStatus('configured');
        } else {
          cachedStatus = 'not-configured';
          cachedError = null;
          setStatus('not-configured');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        cachedStatus = 'error';
        cachedError = msg;
        setStatus('error');
        setErrorMessage(msg);
      }
    };

    checkStatus();
  }, []);

  const handleSetup = async () => {
    if (!window.electronAPI?.orchestrator?.setup) return;

    setIsSettingUp(true);
    setErrorMessage(null);

    try {
      const result = await window.electronAPI.orchestrator.setup();
      if (result.success) {
        cachedStatus = 'configured';
        cachedError = null;
        setStatus('configured');
        onToggle(true);
      } else {
        setErrorMessage(result.error || 'Setup failed');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleRemove = async () => {
    if (!window.electronAPI?.orchestrator?.remove) return;

    setIsSettingUp(true);
    setErrorMessage(null);

    try {
      const result = await window.electronAPI.orchestrator.remove();
      if (result.success) {
        cachedStatus = 'not-configured';
        cachedError = null;
        setStatus('not-configured');
        onToggle(false);
      } else {
        setErrorMessage(result.error || 'Remove failed');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSettingUp(false);
    }
  };

  if (!isElectron()) {
    return null;
  }

  return (
    <div className="p-4 rounded-none border border-accent-purple/30 bg-accent-purple/5">
      <div className="flex items-start gap-3">
        <button
          onClick={() => {
            if (status === 'configured') {
              onToggle(!isOrchestrator);
            }
          }}
          disabled={status !== 'configured'}
          className={`
            mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0
            ${isOrchestrator && status === 'configured'
              ? 'bg-accent-purple border-accent-purple'
              : 'border-accent-purple/50 hover:border-accent-purple'
            }
            ${status !== 'configured' ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isOrchestrator && status === 'configured' && <Check className="w-3 h-3 text-white" />}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-accent-purple" />
            <span className="font-medium text-sm">Orchestrator Mode (Super Agent)</span>
            {status === 'loading' && (
              <Loader2 className="w-3.5 h-3.5 text-accent-purple animate-spin" />
            )}
            {status === 'configured' && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-accent-green/20 text-accent-green">
                Ready
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted mt-1">
            This agent can create, manage, and coordinate other agents. It has full control over the agent fleet.
          </p>

          {status === 'not-configured' && (
            <div className="mt-3 pt-3 border-t border-border-primary">
              <p className="text-xs text-text-muted mb-2">
                Enable orchestrator capabilities by adding the MCP server to Claude&apos;s configuration.
              </p>
              <button
                onClick={handleSetup}
                disabled={isSettingUp}
                className="flex items-center gap-2 px-3 py-1.5 rounded-none bg-accent-purple/20 text-accent-purple text-sm font-medium hover:bg-accent-purple/30 transition-colors disabled:opacity-50"
              >
                {isSettingUp ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    Enable Orchestrator
                  </>
                )}
              </button>
            </div>
          )}

          {status === 'configured' && (
            <div className="mt-3 pt-3 border-t border-border-primary">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-3.5 h-3.5 text-accent-green" />
                <span className="text-xs text-accent-green">MCP orchestrator is configured</span>
              </div>
              <button
                onClick={handleRemove}
                disabled={isSettingUp}
                className="text-xs text-text-muted hover:text-accent-red transition-colors flex items-center gap-1"
              >
                {isSettingUp ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <X className="w-3 h-3" />
                    Remove orchestrator config
                  </>
                )}
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="mt-3 pt-3 border-t border-border-primary">
              <div className="flex items-center gap-2 text-accent-red">
                <XCircle className="w-3.5 h-3.5" />
                <span className="text-xs">{errorMessage || 'An error occurred'}</span>
              </div>
            </div>
          )}

          {errorMessage && status !== 'error' && (
            <div className="mt-2 text-xs text-accent-red flex items-center gap-1">
              <XCircle className="w-3 h-3" />
              {errorMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
