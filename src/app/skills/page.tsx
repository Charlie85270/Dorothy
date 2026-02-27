'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Search,
  Loader2,
  Package,
  CheckCircle,
  XCircle,
  Terminal as TerminalIcon,
  Plus,
  X,
  Copy,
  Check,
  Download,
  MonitorDown,
} from 'lucide-react';
import { useClaude } from '@/hooks/useClaude';
import { useElectronSkills } from '@/hooks/useElectron';
import { SKILLS_DATABASE, type Skill } from '@/lib/skills-database';
import SkillInstallDialog from '@/components/SkillInstallDialog';
import ProviderBadge from '@/components/ProviderBadge';

const COL_STYLES = {
  rank: { width: '4%' },
  skill: { width: '30%' },
  repo: { width: '25%' },
  installs: { width: '10%' },
  status: { width: '31%' },
} as const;

export default function SkillsPage() {
  const { data, loading, error, refresh: refreshClaude } = useClaude();
  const { installedSkills, installedSkillsByProvider, isSkillInstalledOn, isElectron: hasElectron, linkToProvider, refresh: refreshSkills } = useElectronSkills();
  const [search, setSearch] = useState('');
  const [copiedSkill, setCopiedSkill] = useState<string | null>(null);
  const [installingSkill, setInstallingSkill] = useState<string | null>(null);
  const [showToast, setShowToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Custom skill installation
  const [showCustomInstall, setShowCustomInstall] = useState(false);
  const [customRepo, setCustomRepo] = useState('');
  const [customSkillName, setCustomSkillName] = useState('');

  // Terminal modal for installation
  const [showInstallTerminal, setShowInstallTerminal] = useState(false);
  const [currentInstallRepo, setCurrentInstallRepo] = useState('');
  const [currentInstallTitle, setCurrentInstallTitle] = useState('');

  // Live skills data from skills.sh
  const [liveSkills, setLiveSkills] = useState<Skill[] | null>(null);
  const [loadingSkills, setLoadingSkills] = useState(true);

  useEffect(() => {
    fetch('/api/skills/marketplace')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.skills) setLiveSkills(data.skills);
      })
      .catch(() => { }) // fallback to hardcoded
      .finally(() => setLoadingSkills(false));
  }, []);

  const skillsDatabase = liveSkills || SKILLS_DATABASE;

  const installedPlugins = data?.plugins || [];
  const installedSkillsFromClaude = data?.skills || [];

  const settings = data?.settings;

  // Get list of installed skill names (from all sources)
  const installedSkillNames = useMemo(() => {
    const fromPlugins = installedPlugins.map(p => p.name.toLowerCase());
    const fromClaudeSkills = installedSkillsFromClaude.map(s => s.name.toLowerCase());
    const fromElectron = installedSkills.map(s => s.toLowerCase());
    return [...new Set([...fromPlugins, ...fromClaudeSkills, ...fromElectron])];
  }, [installedPlugins, installedSkillsFromClaude, installedSkills]);

  // Check if a skill is installed
  const isSkillInstalled = (skillName: string) => {
    return installedSkillNames.includes(skillName.toLowerCase());
  };

  // Filter skills
  const filteredSkills = useMemo(() => {
    let skills = skillsDatabase;

    if (search) {
      const q = search.toLowerCase();
      skills = skills.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.repo.toLowerCase().includes(q)
      );
    }

    return skills;
  }, [search, skillsDatabase]);

  // Install skill directly (Electron only)
  const handleDirectInstall = async (repo: string, skillName: string) => {
    if (!hasElectron) {
      copyInstallCommand(repo, skillName);
      return;
    }

    const fullRepo = `${repo}/${skillName}`;
    setInstallingSkill(skillName);
    setCurrentInstallRepo(fullRepo);
    setCurrentInstallTitle(skillName);
    setShowInstallTerminal(true);
  };

  const copyInstallCommand = async (repo: string, skillName: string) => {
    const command = `npx skills add https://github.com/${repo} --skill ${skillName}`;
    try {
      await navigator.clipboard.writeText(command);
      setCopiedSkill(skillName);
      setShowToast({
        message: `Command copied! Open your terminal and paste to install "${skillName}"`,
        type: 'success',
      });
      setTimeout(() => {
        setCopiedSkill(null);
        setShowToast(null);
      }, 3000);
    } catch (err) {
      setShowToast({
        message: 'Failed to copy to clipboard',
        type: 'info',
      });
    }
  };

  const handleCustomInstall = async () => {
    if (!customRepo) return;

    const fullRepo = customSkillName ? `${customRepo}/${customSkillName}` : customRepo;

    if (hasElectron) {
      setInstallingSkill('custom');
      setCurrentInstallRepo(fullRepo);
      setCurrentInstallTitle(customSkillName || customRepo);
      setShowCustomInstall(false);
      setCustomRepo('');
      setCustomSkillName('');
      setShowInstallTerminal(true);
    } else {
      // Fallback to copy
      const command = customSkillName
        ? `npx skills add https://github.com/${customRepo} --skill ${customSkillName}`
        : `npx skills add https://github.com/${customRepo}`;
      try {
        await navigator.clipboard.writeText(command);
        setShowToast({
          message: 'Command copied! Open your terminal and paste to install.',
          type: 'success',
        });
        setCustomRepo('');
        setCustomSkillName('');
        setShowCustomInstall(false);
        setTimeout(() => setShowToast(null), 3000);
      } catch (err) {
        setShowToast({
          message: 'Failed to copy to clipboard',
          type: 'info',
        });
      }
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-white mx-auto mb-4" />
          <p className="text-muted-foreground">Loading skills...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center text-red-400">
          <p className="mb-2">Failed to load skills</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)] pt-4 lg:pt-6 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold tracking-tight">Skills Marketplace</h1>
            <p className="text-muted-foreground text-xs lg:text-sm mt-1 hidden sm:block">
              {hasElectron
                ? 'Install skills directly to enhance your AI Agents'
                : 'Browse and copy install commands for skills'
              }
            </p>
          </div>
          <button
            onClick={() => setShowCustomInstall(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors text-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Custom Install</span>
            <span className="sm:hidden">Custom</span>
          </button>
        </div>

        {/* Badges row - below on mobile */}
        <div className="flex flex-wrap items-center gap-2">
          {!hasElectron && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-yellow-500/10 text-yellow-400 text-xs">
              <MonitorDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Desktop app for direct install</span>
              <span className="sm:hidden">Desktop only</span>
            </div>
          )}
          <div className="text-xs lg:text-sm text-muted-foreground">
            <span className="font-medium">{skillsDatabase.length}</span> skills
            {liveSkills && <span className="text-muted-foreground/60"> (live from skills.sh)</span>}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 border flex items-center justify-between ${showToast.type === 'success'
              ? 'bg-primary/10 border-primary/30 text-primary'
              : showToast.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-white/10 border-white/30 text-white'
              }`}
          >
            <div className="flex items-center gap-3">
              {showToast.type === 'error' ? (
                <XCircle className="w-5 h-5" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              <p className="text-sm">{showToast.message}</p>
            </div>
            <button onClick={() => setShowToast(null)} className="p-1 hover:opacity-70">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Install Modal */}
      <AnimatePresence>
        {showCustomInstall && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCustomInstall(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-card border border-border rounded-none p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <TerminalIcon className="w-5 h-5 text-muted-foreground" />
                  Install Custom Skill
                </h3>
                <button onClick={() => setShowCustomInstall(false)} className="p-1 hover:bg-secondary rounded-none">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Repository (owner/repo)</label>
                  <input
                    type="text"
                    value={customRepo}
                    onChange={(e) => setCustomRepo(e.target.value)}
                    placeholder="e.g., anthropics/skills"
                    className="w-full px-4 py-2.5 rounded-none font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Skill Name (optional)</label>
                  <input
                    type="text"
                    value={customSkillName}
                    onChange={(e) => setCustomSkillName(e.target.value)}
                    placeholder="e.g., frontend-design"
                    className="w-full px-4 py-2.5 rounded-none font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty to install all skills from the repository
                  </p>
                </div>

                <div className="p-3 rounded-none bg-secondary/50 border border-border font-mono text-xs text-muted-foreground">
                  npx skills add https://github.com/{customRepo}{customSkillName ? ` --skill ${customSkillName}` : ''}
                </div>

                <button
                  onClick={handleCustomInstall}
                  disabled={!customRepo || installingSkill === 'custom'}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-foreground text-background font-medium rounded-none hover:bg-foreground/90 transition-colors disabled:opacity-50"
                >
                  {installingSkill === 'custom' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Installing...
                    </>
                  ) : hasElectron ? (
                    <>
                      <Download className="w-4 h-4" />
                      Install Skill
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Install Command
                    </>
                  )}
                </button>

                {!hasElectron && (
                  <p className="text-xs text-muted-foreground text-center">
                    After copying, open your terminal and paste the command to install
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="flex gap-3 mt-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills..."
            className="w-full pl-10 pr-4 py-2.5 rounded-none text-sm"
          />
        </div>
      </div>

      {/* Skills Table */}
      <div className="flex-1 border border-border bg-card overflow-hidden flex flex-col min-h-0 mt-4">
        <div className="shrink-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary">
                <th style={COL_STYLES.rank} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">#</th>
                <th style={COL_STYLES.skill} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Skill</th>
                <th style={COL_STYLES.repo} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Repository</th>
                <th style={COL_STYLES.installs} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Installs</th>
                <th style={COL_STYLES.status} className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
          </table>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {loadingSkills && !liveSkills ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mr-2" />
              <span className="text-sm text-muted-foreground">Loading skills from skills.sh...</span>
            </div>
          ) : (
            <table className="w-full">
              <tbody>
                {filteredSkills.map((skill) => {
                  const installed = isSkillInstalled(skill.name);
                  const justCopied = copiedSkill === skill.name;
                  const isInstalling = installingSkill === skill.name;

                  return (
                    <tr
                      key={`${skill.repo}-${skill.name}`}
                      className="border-b border-border/50 hover:bg-secondary/50 transition-colors"
                    >
                      <td style={COL_STYLES.rank} className="px-4 py-3 text-xs text-muted-foreground">
                        {skill.rank}
                      </td>
                      <td style={COL_STYLES.skill} className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 flex items-center justify-center shrink-0 ${installed ? 'bg-primary/10' : 'bg-secondary'
                            }`}>
                            {installed ? (
                              <CheckCircle className="w-4 h-4 text-primary" />
                            ) : (
                              <Package className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <span className="font-medium text-sm truncate">{skill.name}</span>
                        </div>
                      </td>
                      <td style={COL_STYLES.repo} className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-muted-foreground font-mono truncate block">{skill.repo}</span>
                      </td>
                      <td style={COL_STYLES.installs} className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">{skill.installs}</span>
                      </td>
                      <td style={COL_STYLES.status} className="px-4 py-3 text-right">
                        {installed ? (
                          <div className="inline-flex items-center gap-1">
                            {isSkillInstalledOn(skill.name, 'claude') && (
                              <ProviderBadge provider="claude" />
                            )}
                            {isSkillInstalledOn(skill.name, 'codex') && (
                              <ProviderBadge provider="codex" />
                            )}
                            {isSkillInstalledOn(skill.name, 'gemini') && (
                              <ProviderBadge provider="gemini" />
                            )}
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-medium ml-1" style={{ borderRadius: 4 }}>
                              <Check className="w-2.5 h-2.5" />
                              Installed
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleDirectInstall(skill.repo, skill.name)}
                            disabled={isInstalling}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${isInstalling
                              ? 'bg-secondary text-muted-foreground'
                              : justCopied
                                ? 'bg-primary/10 text-primary'
                                : 'bg-foreground text-background hover:bg-foreground/90'
                              }`}
                            style={{ borderRadius: 5 }}
                          >
                            {isInstalling ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Installing...
                              </>
                            ) : justCopied ? (
                              <>
                                <Check className="w-3 h-3" />
                                Copied!
                              </>
                            ) : hasElectron ? (
                              <>
                                <Download className="w-3 h-3" />
                                Install
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                Copy
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>


      {/* Installation Terminal Modal */}
      <SkillInstallDialog
        open={showInstallTerminal}
        repo={currentInstallRepo}
        title={currentInstallTitle}
        availableProviders={['claude', 'codex', 'gemini']}
        onClose={(success) => {
          setShowInstallTerminal(false);
          setInstallingSkill(null);
          // Always re-sync skills on close (install may have succeeded before terminal was closed)
          refreshSkills();
          refreshClaude();
          if (success) {
            setShowToast({
              message: `Successfully installed "${currentInstallRepo}"!`,
              type: 'success',
            });
            setTimeout(() => setShowToast(null), 4000);
          }
        }}
      />
    </div>
  );
}
