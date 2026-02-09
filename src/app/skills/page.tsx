'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Search,
  Loader2,
  Package,
  CheckCircle,
  XCircle,
  Filter,
  ChevronDown,
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
import { SKILLS_DATABASE, SKILL_CATEGORIES, type Skill } from '@/lib/skills-database';
import SkillInstallDialog from '@/components/SkillInstallDialog';

export default function SkillsPage() {
  const { data, loading, error } = useClaude();
  const { installedSkills, installSkill, isElectron: hasElectron } = useElectronSkills();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
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

  // Filter skills from database
  const filteredSkills = useMemo(() => {
    let skills = SKILLS_DATABASE;

    if (search) {
      const q = search.toLowerCase();
      skills = skills.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.repo.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      );
    }

    if (selectedCategory) {
      skills = skills.filter((s) => s.category === selectedCategory);
    }

    return skills;
  }, [search, selectedCategory]);

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
                ? 'Install skills directly to enhance your Claude agents'
                : 'Browse and copy install commands for skills'
              }
            </p>
          </div>
          <button
            onClick={() => setShowCustomInstall(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-black font-medium hover:bg-white/90 transition-colors text-sm shrink-0"
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
            <span className="text-white font-medium">{SKILLS_DATABASE.length}</span> skills
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
            className={`p-4 border flex items-center justify-between ${
              showToast.type === 'success'
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
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
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-black font-medium rounded-none hover:bg-white/90 transition-colors disabled:opacity-50"
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

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
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

        <div className="relative">
          <button
            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-none bg-secondary text-muted-foreground hover:text-foreground transition-colors w-full sm:w-auto sm:min-w-[140px] text-sm"
          >
            <Filter className="w-4 h-4" />
            {selectedCategory || 'All Categories'}
            <ChevronDown className="w-4 h-4 ml-auto" />
          </button>

          <AnimatePresence>
            {showCategoryDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute top-full mt-2 right-0 w-48 bg-card border border-border rounded-none shadow-lg z-10 py-2 max-h-80 overflow-y-auto"
              >
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setShowCategoryDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-secondary ${
                    !selectedCategory ? 'text-white' : 'text-muted-foreground'
                  }`}
                >
                  All Categories
                </button>
                {SKILL_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setShowCategoryDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-secondary ${
                      selectedCategory === cat ? 'text-white' : 'text-muted-foreground'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Skills Table */}
      <div className="flex-1 border border-border bg-card overflow-hidden flex flex-col min-h-0 mt-4">
        <table className="w-full">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-secondary">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">#</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Skill</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Repository</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Category</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Installs</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
        </table>
        <div className="flex-1 overflow-y-auto">
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
                    <td className="px-4 py-3 text-xs text-muted-foreground w-12">
                      {skill.rank}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 flex items-center justify-center shrink-0 ${
                          installed ? 'bg-green-500/20' : 'bg-secondary'
                        }`}>
                          {installed ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <Package className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <span className="font-medium text-sm">{skill.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground font-mono">{skill.repo}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs px-2 py-1 bg-secondary text-muted-foreground">
                        {skill.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">{skill.installs}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {installed ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 text-green-400 text-xs font-medium">
                          <Check className="w-3 h-3" />
                          Installed
                        </span>
                      ) : (
                        <button
                          onClick={() => handleDirectInstall(skill.repo, skill.name)}
                          disabled={isInstalling}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                            isInstalling
                              ? 'bg-secondary text-muted-foreground'
                              : justCopied
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-white text-black hover:bg-white/90'
                          }`}
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
        </div>
      </div>


      {/* Installation Terminal Modal */}
      <SkillInstallDialog
        open={showInstallTerminal}
        repo={currentInstallRepo}
        title={currentInstallTitle}
        onClose={(success) => {
          setShowInstallTerminal(false);
          setInstallingSkill(null);
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
