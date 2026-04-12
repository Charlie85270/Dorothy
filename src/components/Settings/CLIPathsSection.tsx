import { useState, useEffect } from 'react';
import { RefreshCw, Check, AlertCircle, Plus, X, FolderOpen, Cpu, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Toggle } from './Toggle';
import type { AppSettings, CLIPaths } from './types';

interface CLIPathsSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (settings: Partial<AppSettings>) => void;
  onUpdateLocalSettings?: (settings: Partial<AppSettings>) => void;
}

interface DetectedPaths {
  claude: string;
  codex: string;
  gemini: string;
  opencode: string;
  pi: string;
  gws: string;
  gcloud: string;
  gh: string;
  node: string;
}

export const CLIPathsSection = ({ appSettings, onSaveAppSettings, onUpdateLocalSettings }: CLIPathsSectionProps) => {
  const [detecting, setDetecting] = useState(false);
  const [detectedPaths, setDetectedPaths] = useState<DetectedPaths | null>(null);
  const [newPath, setNewPath] = useState('');
  const [testingOpencode, setTestingOpencode] = useState(false);
  const [testingPi, setTestingPi] = useState(false);
  const [opencodeResult, setOpencodeResult] = useState<{ success: boolean; message: string } | null>(null);
  const [piResult, setPiResult] = useState<{ success: boolean; message: string } | null>(null);
  const [localPaths, setLocalPaths] = useState<CLIPaths>(
    appSettings.cliPaths || { claude: '', codex: '', gemini: '', opencode: '', pi: '', gws: '', gcloud: '', gh: '', node: '', additionalPaths: [] }
  );

  useEffect(() => {
    setLocalPaths(appSettings.cliPaths || { claude: '', codex: '', gemini: '', opencode: '', pi: '', gws: '', gcloud: '', gh: '', node: '', additionalPaths: [] });
  }, [appSettings.cliPaths]);

  const handleDetectPaths = async () => {
    setDetecting(true);
    try {
      const paths = await window.electronAPI?.cliPaths?.detect();
      if (paths) {
        setDetectedPaths(paths);
        // Auto-fill empty fields with detected values
        const updatedPaths = { ...localPaths };
        if (!updatedPaths.claude && paths.claude) updatedPaths.claude = paths.claude;
        if (!updatedPaths.codex && paths.codex) updatedPaths.codex = paths.codex;
        if (!updatedPaths.gemini && paths.gemini) updatedPaths.gemini = paths.gemini;
        if (!updatedPaths.opencode && paths.opencode) updatedPaths.opencode = paths.opencode;
        if (!updatedPaths.pi && (paths as DetectedPaths).pi) updatedPaths.pi = (paths as DetectedPaths).pi;
        if (!updatedPaths.gws && paths.gws) updatedPaths.gws = paths.gws;
        if (!updatedPaths.gcloud && paths.gcloud) updatedPaths.gcloud = paths.gcloud;
        if (!updatedPaths.gh && paths.gh) updatedPaths.gh = paths.gh;
        if (!updatedPaths.node && paths.node) updatedPaths.node = paths.node;
        setLocalPaths(updatedPaths);
      }
    } catch (error) {
      console.error('Failed to detect paths:', error);
    }
    setDetecting(false);
  };

  const handlePathChange = (key: keyof Omit<CLIPaths, 'additionalPaths'>, value: string) => {
    setLocalPaths(prev => ({ ...prev, [key]: value }));
  };

  const handleAddAdditionalPath = () => {
    if (newPath.trim() && !localPaths.additionalPaths.includes(newPath.trim())) {
      setLocalPaths(prev => ({
        ...prev,
        additionalPaths: [...prev.additionalPaths, newPath.trim()],
      }));
      setNewPath('');
    }
  };

  const handleRemoveAdditionalPath = (pathToRemove: string) => {
    setLocalPaths(prev => ({
      ...prev,
      additionalPaths: prev.additionalPaths.filter(p => p !== pathToRemove),
    }));
  };

  const handleSave = () => {
    onSaveAppSettings({ cliPaths: localPaths });
  };

  const hasChanges = JSON.stringify(localPaths) !== JSON.stringify(appSettings.cliPaths || { claude: '', codex: '', gemini: '', opencode: '', pi: '', gws: '', gcloud: '', gh: '', node: '', additionalPaths: [] });

  const renderPathInput = (
    label: string,
    description: string,
    key: keyof Omit<CLIPaths, 'additionalPaths'>,
    placeholder: string
  ) => {
    const detected = detectedPaths?.[key];
    const current = localPaths[key];
    const isUsingDetected = detected && current === detected;

    return (
      <div className="py-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div>
            <label className="text-sm font-medium">{label}</label>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          {detected && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Detected: {detected}
            </span>
          )}
        </div>
        <input
          type="text"
          value={current}
          onChange={(e) => handlePathChange(key, e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-secondary border border-border text-sm font-mono focus:outline-none focus:border-foreground"
        />
        {isUsingDetected && (
          <p className="text-xs text-muted-foreground mt-1">Using auto-detected path</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">CLI Paths</h2>
        <p className="text-sm text-muted-foreground">
          Configure paths to CLI tools used by automations and agents
        </p>
      </div>

      {/* Auto-detect button */}
      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-md font-medium">Auto-detect Paths</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Automatically find CLI tools installed on your system
            </p>
          </div>
          <button
            onClick={handleDetectPaths}
            disabled={detecting}
            className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${detecting ? 'animate-spin' : ''}`} />
            {detecting ? 'Detecting...' : 'Detect Paths'}
          </button>
        </div>

        {detectedPaths && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4" />
              <span className="font-medium">Paths detected successfully</span>
            </div>
            <ul className="text-xs space-y-1 ml-6">
              {detectedPaths.claude && <li>Claude: {detectedPaths.claude}</li>}
              {detectedPaths.codex && <li>Codex: {detectedPaths.codex}</li>}
              {detectedPaths.gemini && <li>Gemini: {detectedPaths.gemini}</li>}
              {detectedPaths.opencode && <li>OpenCode: {detectedPaths.opencode}</li>}
              {detectedPaths.pi && <li>Pi Terminal: {detectedPaths.pi}</li>}
              {detectedPaths.gws && <li>GWS: {detectedPaths.gws}</li>}
              {detectedPaths.gcloud && <li>gcloud: {detectedPaths.gcloud}</li>}
              {detectedPaths.gh && <li>GitHub CLI: {detectedPaths.gh}</li>}
              {detectedPaths.node && <li>Node.js: {detectedPaths.node}</li>}
              {!detectedPaths.claude && !detectedPaths.codex && !detectedPaths.gemini && !detectedPaths.opencode && !detectedPaths.pi && !detectedPaths.gws && !detectedPaths.gcloud && !detectedPaths.gh && !detectedPaths.node && (
                <li className="text-yellow-400">No CLI tools found in common locations</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Provider Toggles — OpenCode & Pi */}
      <div className="border border-border bg-card p-6 space-y-4">
        <h3 className="text-md font-medium mb-2">CLI Agent Providers</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Enable additional CLI-based agent providers. Paths are configured below.
        </p>

        <div className="flex items-center justify-between py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <Cpu className="w-4 h-4 text-cyan-500" />
            <div>
              <p className="text-sm font-medium">OpenCode</p>
              <p className="text-xs text-muted-foreground">75+ LLM providers via opencode.ai</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                setTestingOpencode(true);
                setOpencodeResult(null);
                try {
                  const result = await window.electronAPI?.shell?.exec({ command: 'opencode --version' });
                  setOpencodeResult(result?.success && result.output
                    ? { success: true, message: result.output.trim() }
                    : { success: false, message: 'OpenCode CLI not found' });
                } catch { setOpencodeResult({ success: false, message: 'Test failed' }); }
                setTestingOpencode(false);
              }}
              disabled={testingOpencode}
              className="px-2 py-1 text-xs border border-border hover:border-foreground transition-colors"
            >
              {testingOpencode ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Test'}
            </button>
            <Toggle
              enabled={appSettings.opencodeEnabled ?? false}
              onChange={() => onSaveAppSettings({ opencodeEnabled: !appSettings.opencodeEnabled })}
            />
          </div>
        </div>
        {opencodeResult && (
          <div className={`flex items-center gap-2 text-xs p-2 ${opencodeResult.success ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'} border ${opencodeResult.success ? 'border-green-500/30' : 'border-red-500/30'}`}>
            {opencodeResult.success ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {opencodeResult.message}
          </div>
        )}

        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Cpu className="w-4 h-4 text-cyan-500" />
            <div>
              <p className="text-sm font-medium">Pi Terminal</p>
              <p className="text-xs text-muted-foreground">15+ AI providers via shittycodingagent.ai</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                setTestingPi(true);
                setPiResult(null);
                try {
                  const result = await window.electronAPI?.shell?.exec?.({
                    command: `${appSettings.cliPaths?.pi || 'pi'} --version 2>&1 || echo "not found"`,
                  });
                  setPiResult(result?.success && result.output && !result.output.includes('not found')
                    ? { success: true, message: `Pi CLI: ${result.output.trim()}` }
                    : { success: false, message: 'Pi CLI not found' });
                } catch { setPiResult({ success: false, message: 'Test failed' }); }
                setTestingPi(false);
              }}
              disabled={testingPi}
              className="px-2 py-1 text-xs border border-border hover:border-foreground transition-colors"
            >
              {testingPi ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Test'}
            </button>
            <Toggle
              enabled={(appSettings as unknown as Record<string, unknown>).piEnabled === true}
              onChange={() => {
                const newVal = !((appSettings as unknown as Record<string, unknown>).piEnabled === true);
                onUpdateLocalSettings?.({ piEnabled: newVal } as Partial<AppSettings>);
                onSaveAppSettings({ piEnabled: newVal } as Partial<AppSettings>);
              }}
            />
          </div>
        </div>
        {piResult && (
          <div className={`flex items-center gap-2 text-xs p-2 ${piResult.success ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'} border ${piResult.success ? 'border-green-500/30' : 'border-red-500/30'}`}>
            {piResult.success ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {piResult.message}
          </div>
        )}
      </div>

      {/* Path inputs */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-md font-medium mb-2">CLI Tool Paths</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Leave empty to use auto-detected paths. Specify full paths if tools are in non-standard locations.
        </p>

        {renderPathInput(
          'Claude CLI',
          'Path to the Claude CLI executable',
          'claude',
          '/usr/local/bin/claude or ~/.nvm/versions/node/v20/bin/claude'
        )}

        {renderPathInput(
          'Codex CLI',
          'Path to the OpenAI Codex CLI executable',
          'codex',
          '/usr/local/bin/codex or ~/.nvm/versions/node/v20/bin/codex'
        )}

        {renderPathInput(
          'Gemini CLI',
          'Path to the Google Gemini CLI executable',
          'gemini',
          '/usr/local/bin/gemini or ~/.nvm/versions/node/v20/bin/gemini'
        )}

        {renderPathInput(
          'OpenCode CLI',
          'Path to the OpenCode CLI executable (opencode.ai)',
          'opencode',
          '/usr/local/bin/opencode or ~/.local/bin/opencode'
        )}

        {renderPathInput(
          'Pi Terminal',
          'Path to the Pi coding agent CLI executable',
          'pi',
          '/usr/local/bin/pi or ~/.nvm/versions/node/v20/bin/pi'
        )}

        {renderPathInput(
          'Google Workspace CLI (gws)',
          'Path to the gws CLI executable',
          'gws',
          '/usr/local/bin/gws or ~/.nvm/versions/node/v20/bin/gws'
        )}

        {renderPathInput(
          'Google Cloud SDK (gcloud)',
          'Path to the gcloud CLI executable (required for gws auth setup)',
          'gcloud',
          '/opt/homebrew/bin/gcloud or ~/google-cloud-sdk/bin/gcloud'
        )}

        {renderPathInput(
          'GitHub CLI (gh)',
          'Path to the GitHub CLI executable for automations',
          'gh',
          '/opt/homebrew/bin/gh or /usr/local/bin/gh'
        )}

        {renderPathInput(
          'Node.js',
          'Path to the Node.js executable',
          'node',
          '/usr/local/bin/node or ~/.nvm/versions/node/v20/bin/node'
        )}
      </div>

      {/* Additional PATH directories */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-md font-medium mb-2">Additional PATH Directories</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Add directories to include in PATH when running automations and agents
        </p>

        <div className="space-y-2 mb-4">
          {localPaths.additionalPaths.map((path, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-secondary border border-border text-sm font-mono">
                {path}
              </div>
              <button
                onClick={() => handleRemoveAdditionalPath(path)}
                className="p-2 text-muted-foreground hover:text-red-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddAdditionalPath()}
            placeholder="/path/to/directory"
            className="flex-1 px-3 py-2 bg-secondary border border-border text-sm font-mono focus:outline-none focus:border-foreground"
          />
          <button
            onClick={handleAddAdditionalPath}
            disabled={!newPath.trim()}
            className="px-4 py-2 bg-secondary text-foreground hover:bg-secondary/80 transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Common paths like /opt/homebrew/bin, /usr/local/bin, and ~/.nvm are included by default
        </p>
      </div>

      {/* Save button */}
      {hasChanges && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-foreground text-background hover:bg-foreground/90 transition-colors text-sm flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Save CLI Paths
          </button>
        </div>
      )}
    </div>
  );
};
