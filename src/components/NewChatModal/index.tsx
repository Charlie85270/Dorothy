'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bot, ChevronRight, Play } from 'lucide-react';

import type { NewChatModalProps, AgentPersonaValues } from './types';
import type { AgentProvider } from '@/types/electron';
import { CHARACTER_OPTIONS } from './constants';
import { useSkillInstall } from './hooks/useSkillInstall';
import StepProject from './StepProject';
import StepSkills from './StepSkills';
import StepConfigure from './StepConfigure';
import SkillInstallTerminal from './SkillInstallTerminal';

export default function NewChatModal({
  open,
  onClose,
  onSubmit,
  projects,
  onBrowseFolder,
  installedSkills = [],
  allInstalledSkills = [],
  onRefreshSkills,
  initialProjectPath,
  initialStep,
}: NewChatModalProps) {
  // Step navigation
  const [step, setStep] = useState(initialStep || 1);

  // Step 1: Project selection
  const [selectedProject, setSelectedProject] = useState<string>(initialProjectPath || '');
  const [customPath, setCustomPath] = useState('');
  const [showSecondaryProject, setShowSecondaryProject] = useState(false);
  const [selectedSecondaryProject, setSelectedSecondaryProject] = useState<string>('');
  const [customSecondaryPath, setCustomSecondaryPath] = useState('');

  // Step 2: Skills
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  // Step 3: Configure & Start
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<'sonnet' | 'opus' | 'haiku'>('sonnet');
  const [useWorktree, setUseWorktree] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [skipPermissions, setSkipPermissions] = useState(true);
  const [isOrchestrator, setIsOrchestrator] = useState(false);
  const [provider, setProvider] = useState<AgentProvider>('claude');
  const [localModel, setLocalModel] = useState('');
  const [tasmaniaEnabled, setTasmaniaEnabled] = useState(false);
  const agentPersonaRef = useRef<AgentPersonaValues>({ character: 'robot', name: '' });

  const projectPath = selectedProject || customPath;

  // Skill installation hook
  const skillInstall = useSkillInstall(onRefreshSkills);

  // Pre-compute installed skill names as a Set
  const installedSkillSet = useMemo(() => {
    const set = new Set<string>();
    for (const s of installedSkills) set.add(s.toLowerCase());
    for (const s of allInstalledSkills) set.add(s.name.toLowerCase());
    return set;
  }, [installedSkills, allInstalledSkills]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setStep(initialStep || 1);
      setSelectedProject(initialProjectPath || '');
      setCustomPath('');
      setSelectedSkills([]);
      setPrompt('');
      setUseWorktree(false);
      setBranchName('');
      agentPersonaRef.current = { character: 'robot', name: '' };
      setShowSecondaryProject(false);
      setSelectedSecondaryProject('');
      setCustomSecondaryPath('');
      setSkipPermissions(false);
      setProvider('claude');
      setLocalModel('');

      // Check if Tasmania is enabled in app settings
      window.electronAPI?.appSettings?.get().then((settings) => {
        setTasmaniaEnabled(settings?.tasmaniaEnabled || false);
      });
    }
  }, [open, initialProjectPath, initialStep]);

  // Stable callbacks for child components
  const handleSelectProject = useCallback((path: string) => {
    setSelectedProject(path);
    setCustomPath('');
  }, []);

  const handleCustomPathChange = useCallback((path: string) => {
    setCustomPath(path);
    setSelectedProject('');
  }, []);

  const handleToggleSecondary = useCallback(() => {
    setShowSecondaryProject(prev => !prev);
  }, []);

  const handleSelectSecondaryProject = useCallback((path: string) => {
    setSelectedSecondaryProject(path);
    setCustomSecondaryPath('');
  }, []);

  const handleCustomSecondaryPathChange = useCallback((path: string) => {
    setCustomSecondaryPath(path);
    setSelectedSecondaryProject('');
  }, []);

  const handleClearSecondary = useCallback(() => {
    setSelectedSecondaryProject('');
    setCustomSecondaryPath('');
  }, []);

  const toggleSkill = useCallback((skillName: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skillName) ? prev.filter((s) => s !== skillName) : [...prev, skillName]
    );
  }, []);

  const handleOrchestratorToggle = useCallback((enabled: boolean) => {
    setIsOrchestrator(enabled);
    if (enabled) {
      setSkipPermissions(true);
      agentPersonaRef.current = { ...agentPersonaRef.current, character: 'wizard' };
    }
  }, []);

  const handleSubmit = useCallback(() => {
    if (!projectPath) return;
    if (!prompt.trim() && selectedSkills.length === 0) return;
    if (useWorktree && !branchName.trim()) return;

    const finalPrompt = prompt.trim() || `Use the following skills: ${selectedSkills.join(', ')}`;
    const worktreeConfig = useWorktree ? { enabled: true, branchName: branchName.trim() } : undefined;

    const { character: agentCharacter, name: agentName } = agentPersonaRef.current;
    const projectName = projectPath.split('/').pop() || 'project';
    const finalName = agentName.trim() || `${CHARACTER_OPTIONS.find(c => c.id === agentCharacter)?.name || 'Agent'} on ${projectName}`;

    const secondaryPath = showSecondaryProject ? (selectedSecondaryProject || customSecondaryPath) : undefined;

    onSubmit(projectPath, selectedSkills, finalPrompt, model, worktreeConfig, agentCharacter, finalName, secondaryPath, skipPermissions, provider, localModel);

    // Reset form
    setStep(1);
    setSelectedProject('');
    setCustomPath('');
    setSelectedSkills([]);
    setPrompt('');
    setUseWorktree(false);
    setBranchName('');
    agentPersonaRef.current = { character: 'robot', name: '' };
    setShowSecondaryProject(false);
    setSelectedSecondaryProject('');
    setSkipPermissions(false);
    setCustomSecondaryPath('');
    setProvider('claude');
    setLocalModel('');
  }, [projectPath, prompt, selectedSkills, useWorktree, branchName, showSecondaryProject, selectedSecondaryProject, customSecondaryPath, model, skipPermissions, provider, localModel, onSubmit]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl mx-4 bg-card border border-border shadow-2xl overflow-hidden max-h-[85vh] lg:max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="px-4 lg:px-6 py-3 lg:py-4 border-b border-border flex items-center justify-between bg-secondary">
            <div className="flex items-center gap-2 lg:gap-3">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-white flex items-center justify-center">
                <Bot className="w-4 h-4 lg:w-5 lg:h-5 text-black" />
              </div>
              <div>
                <h2 className="font-semibold text-base lg:text-lg">Create New Agent</h2>
                <p className="text-xs lg:text-sm text-text-muted">Step {step} of 3</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-none hover:bg-bg-tertiary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="h-1 bg-secondary">
            <motion.div
              initial={{ width: '33%' }}
              animate={{ width: `${(step / 3) * 100}%` }}
              className="h-full bg-white"
            />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {step === 1 && (
              <StepProject
                projects={projects}
                projectPath={projectPath}
                selectedProject={selectedProject}
                customPath={customPath}
                onSelectProject={handleSelectProject}
                onCustomPathChange={handleCustomPathChange}
                onBrowseFolder={onBrowseFolder}
                showSecondaryProject={showSecondaryProject}
                onToggleSecondary={handleToggleSecondary}
                selectedSecondaryProject={selectedSecondaryProject}
                onSelectSecondaryProject={handleSelectSecondaryProject}
                customSecondaryPath={customSecondaryPath}
                onCustomSecondaryPathChange={handleCustomSecondaryPathChange}
                onClearSecondary={handleClearSecondary}
              />
            )}

            {step === 2 && (
              <StepSkills
                selectedSkills={selectedSkills}
                onToggleSkill={toggleSkill}
                allInstalledSkills={allInstalledSkills}
                installedSkillSet={installedSkillSet}
                onInstallSkill={skillInstall.handleInstallSkill}
              />
            )}

            {step === 3 && (
              <StepConfigure
                projectPath={projectPath}
                selectedSkills={selectedSkills}
                selectedSecondaryProject={selectedSecondaryProject}
                customSecondaryPath={customSecondaryPath}
                model={model}
                onModelChange={setModel}
                useWorktree={useWorktree}
                onToggleWorktree={() => setUseWorktree(prev => !prev)}
                branchName={branchName}
                onBranchNameChange={setBranchName}
                skipPermissions={skipPermissions}
                onToggleSkipPermissions={() => setSkipPermissions(prev => !prev)}
                isOrchestrator={isOrchestrator}
                onOrchestratorToggle={handleOrchestratorToggle}
                prompt={prompt}
                onPromptChange={setPrompt}
                agentPersonaRef={agentPersonaRef}
                provider={provider}
                onProviderChange={setProvider}
                localModel={localModel}
                onLocalModelChange={setLocalModel}
                tasmaniaEnabled={tasmaniaEnabled}
              />
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-secondary">
            <button
              onClick={() => step > 1 && setStep(step - 1)}
              disabled={step === 1}
              className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>

              {step < 3 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  disabled={step === 1 && !projectPath}
                  className="flex items-center gap-2 px-4 py-2 bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={(!prompt.trim() && selectedSkills.length === 0) || (useWorktree && !branchName.trim())}
                  className="flex items-center gap-2 px-4 py-2 bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4" />
                  Start Agent
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Skill Installation Terminal Modal */}
        <SkillInstallTerminal
          show={skillInstall.showInstallTerminal}
          installingSkill={skillInstall.installingSkill}
          installComplete={skillInstall.installComplete}
          installExitCode={skillInstall.installExitCode}
          terminalRef={skillInstall.terminalRef}
          onClose={skillInstall.closeInstallTerminal}
        />
      </motion.div>
    </AnimatePresence>
  );
}
