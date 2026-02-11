import { useState, useEffect } from 'react';
import { RefreshCw, Check, AlertCircle, Plus, X, FolderOpen } from 'lucide-react';
import type { AppSettings, CLIPaths } from './types';

interface CLIPathsSectionProps {
  appSettings: AppSettings;
  onSaveAppSettings: (settings: Partial<AppSettings>) => void;
}

interface DetectedPaths {
  claude: string;
  gh: string;
  node: string;
}

export const CLIPathsSection = ({ appSettings, onSaveAppSettings }: CLIPathsSectionProps) => {
  const [detecting, setDetecting] = useState(false);
  const [detectedPaths, setDetectedPaths] = useState<DetectedPaths | null>(null);
  const [newPath, setNewPath] = useState('');
  const [localPaths, setLocalPaths] = useState<CLIPaths>(
    appSettings.cliPaths || { claude: '', gh: '', node: '', additionalPaths: [] }
  );

  useEffect(() => {
    setLocalPaths(appSettings.cliPaths || { claude: '', gh: '', node: '', additionalPaths: [] });
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

  const hasChanges = JSON.stringify(localPaths) !== JSON.stringify(appSettings.cliPaths || { claude: '', gh: '', node: '', additionalPaths: [] });

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
              {detectedPaths.gh && <li>GitHub CLI: {detectedPaths.gh}</li>}
              {detectedPaths.node && <li>Node.js: {detectedPaths.node}</li>}
              {!detectedPaths.claude && !detectedPaths.gh && !detectedPaths.node && (
                <li className="text-yellow-400">No CLI tools found in common locations</li>
              )}
            </ul>
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
