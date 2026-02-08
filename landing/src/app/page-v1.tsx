'use client';

import { motion } from 'framer-motion';
import {
  Bot,
  Sparkles,
  Terminal,
  BarChart2,
  Zap,
  GitBranch,
  Layers,
  ArrowRight,
  Github,
  Download,
  FolderKanban,
  Check,
  Crown,
  Brain,
  Play,
  ChevronRight,
  Workflow,
  Star,
} from 'lucide-react';
import { useState, useEffect } from 'react';

// ─── Utility Components ─────────────────────────────────────────────────────

function FloatingOrb({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 0.6, scale: 1 }}
      transition={{ delay, duration: 2, ease: 'easeOut' }}
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
    />
  );
}

function StarField() {
  const [stars, setStars] = useState<{ x: number; y: number; size: number; delay: number; duration: number }[]>([]);
  useEffect(() => {
    const generated = Array.from({ length: 80 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 2,
    }));
    setStars(generated);
  }, []);
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {stars.map((star, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white"
          style={{ left: `${star.x}%`, top: `${star.y}%`, width: star.size, height: star.size }}
          animate={{ opacity: [0.1, 0.8, 0.1] }}
          transition={{ repeat: Infinity, duration: star.duration, delay: star.delay, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

function GradientText({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 ${className}`}
    >
      {children}
    </span>
  );
}

function SectionWrapper({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className={`relative py-32 px-6 ${className}`}
    >
      {children}
    </motion.section>
  );
}

function GlassCard({ children, className = '', glowColor }: { children: React.ReactNode; className?: string; glowColor?: string }) {
  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden group ${className}`}
    >
      {glowColor && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 rounded-2xl blur-xl"
          style={{ backgroundColor: glowColor }}
        />
      )}
      {children}
    </motion.div>
  );
}

// ─── Inline SVG Icons for Integrations ──────────────────────────────────────

function TelegramIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" fill="#229ED9" />
      <path d="M15.5 24.5l3.5 3 8-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M33 14L12 22.5l6.5 2.5L33 14zm0 0l-8.5 11 4.5 6L33 14z" fill="white" />
    </svg>
  );
}

function SlackIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect x="10" y="20" width="8" height="8" rx="4" fill="#E01E5A" />
      <rect x="20" y="10" width="8" height="8" rx="4" fill="#36C5F0" />
      <rect x="30" y="20" width="8" height="8" rx="4" fill="#2EB67D" />
      <rect x="20" y="30" width="8" height="8" rx="4" fill="#ECB22E" />
      <rect x="18" y="18" width="12" height="12" rx="2" fill="white" fillOpacity="0.2" />
    </svg>
  );
}

function GithubIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" fill="white" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M24 6C14.06 6 6 14.06 6 24c0 7.96 5.16 14.7 12.32 17.08.9.16 1.23-.39 1.23-.87 0-.43-.02-1.86-.02-3.38-4.52.84-5.7-1.14-6.06-2.18-.2-.52-1.08-2.18-1.84-2.62-.63-.34-1.53-1.18-.02-1.2 1.42-.02 2.43 1.3 2.77 1.84 1.62 2.72 4.21 1.96 5.25 1.48.16-1.16.63-1.96 1.15-2.41-4.02-.46-8.22-2.01-8.22-8.92 0-1.96.7-3.58 1.84-4.84-.18-.46-.81-2.3.18-4.78 0 0 1.5-.48 4.93 1.84 1.43-.4 2.96-.6 4.48-.6s3.05.2 4.48.6c3.43-2.34 4.93-1.84 4.93-1.84.99 2.48.36 4.32.18 4.78 1.14 1.26 1.84 2.86 1.84 4.84 0 6.94-4.22 8.46-8.24 8.9.65.56 1.21 1.64 1.21 3.32 0 2.4-.02 4.34-.02 4.94 0 .48.33 1.05 1.23.87A18.01 18.01 0 0042 24c0-9.94-8.06-18-18-18z"
        fill="#1a1a2e"
      />
    </svg>
  );
}

function JiraIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect x="8" y="8" width="14" height="14" rx="3" fill="#2684FF" />
      <rect x="16" y="16" width="14" height="14" rx="3" fill="#2684FF" fillOpacity="0.7" />
      <rect x="24" y="24" width="14" height="14" rx="3" fill="#2684FF" fillOpacity="0.4" />
    </svg>
  );
}

// ─── Multi-Workflow Automation Showcase ──────────────────────────────────────

// Wrappers for SVG logo icons to match Lucide icon interface
function JiraFlowIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={className} style={style}><JiraIcon size={20} /></div>;
}
function GithubFlowIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={className} style={style}><GithubIcon size={20} /></div>;
}
function TelegramFlowIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={className} style={style}><TelegramIcon size={20} /></div>;
}
function SlackFlowIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={className} style={style}><SlackIcon size={20} /></div>;
}

type WorkflowStep = {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  sublabel: string;
  color: string;
};

type Workflow = {
  id: string;
  title: string;
  subtitle: string;
  gradient: string;
  accentColor: string;
  steps: WorkflowStep[];
};

const workflows: Workflow[] = [
  {
    id: 'jira',
    title: 'JIRA Bug Fix',
    subtitle: 'Issue → Fix → Ship',
    gradient: 'from-[#2684FF] to-[#0052CC]',
    accentColor: '#2684FF',
    steps: [
      { icon: JiraFlowIcon, label: 'JIRA Issue Created', sublabel: 'PROJ-456: Fix auth flow', color: '#2684FF' },
      { icon: Zap, label: 'Automation Detects', sublabel: 'Polls every 5 min', color: '#a855f7' },
      { icon: FolderKanban, label: 'Kanban Task', sublabel: 'Added to backlog', color: '#22d3ee' },
      { icon: Bot, label: 'Agent Assigned', sublabel: 'frontend-agent (92%)', color: '#f59e0b' },
      { icon: Terminal, label: 'Agent Works', sublabel: 'Fix + tests + commit', color: '#22d3ee' },
      { icon: JiraFlowIcon, label: 'JIRA → Done', sublabel: 'Status + TG + Slack', color: '#4ade80' },
    ],
  },
  {
    id: 'github',
    title: 'GitHub PR → Content',
    subtitle: 'PR → Article → Video',
    gradient: 'from-[#6e40c9] to-[#2ea043]',
    accentColor: '#6e40c9',
    steps: [
      { icon: GithubFlowIcon, label: 'New PR Created', sublabel: 'feat: dark mode support', color: '#ffffff' },
      { icon: Bot, label: 'Auto Code Review', sublabel: 'Checks diff + quality', color: '#a855f7' },
      { icon: Terminal, label: 'Content Agent', sublabel: 'Generates article draft', color: '#22d3ee' },
      { icon: Star, label: 'LinkedIn & X Post', sublabel: 'Published to socials', color: '#f59e0b' },
      { icon: Play, label: 'Remotion Video', sublabel: 'Feature demo rendered', color: '#ec4899' },
      { icon: SlackFlowIcon, label: 'Distributed', sublabel: 'Shared on all channels', color: '#4ade80' },
    ],
  },
  {
    id: 'telegram',
    title: 'Telegram → Release',
    subtitle: 'Message → Fix → Deploy',
    gradient: 'from-[#229ED9] to-[#1a75a7]',
    accentColor: '#229ED9',
    steps: [
      { icon: TelegramFlowIcon, label: 'Telegram Message', sublabel: '"Fix the login bug"', color: '#229ED9' },
      { icon: Crown, label: 'Super Agent Plans', sublabel: 'Breaks into subtasks', color: '#a855f7' },
      { icon: Terminal, label: 'Bug Fixed', sublabel: 'Code patched + tested', color: '#22d3ee' },
      { icon: Layers, label: 'Docs Updated', sublabel: 'Changelog + API docs', color: '#f59e0b' },
      { icon: GithubFlowIcon, label: 'Release + Push', sublabel: 'v2.1.1 → GitHub', color: '#ffffff' },
      { icon: SlackFlowIcon, label: 'Slack Notified', sublabel: '"Release v2.1.1 is live"', color: '#4ade80' },
    ],
  },
];

// Animated connector between flow nodes — plays once when its step activates
function FlowConnector({ color, isActive, isAnimating }: { color: string; isActive: boolean; isAnimating: boolean }) {
  return (
    <div className="flex items-center mx-1">
      <div className="relative w-8 md:w-12 h-px">
        <div className="absolute inset-0 bg-white/10" />
        {/* Solid fill for already-passed connectors */}
        {isActive && !isAnimating && (
          <div
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: color, opacity: 0.5 }}
          />
        )}
        {/* One-time traveling dot for the currently animating connector */}
        {isAnimating && (
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
            initial={{ left: 0, opacity: 1 }}
            animate={{ left: '100%' }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          />
        )}
      </div>
      <ChevronRight className={`w-3 h-3 -ml-1 transition-colors duration-500 ${isActive || isAnimating ? 'text-white/40' : 'text-white/10'}`} />
    </div>
  );
}

// Tab icon components for each workflow
const workflowTabIcons: Record<string, React.ComponentType<{ size?: number }>> = {
  jira: JiraIcon,
  github: GithubIcon,
  telegram: TelegramIcon,
};

// Single workflow flow with sequential card activation
function WorkflowFlow({ workflow, isActive, activeStep }: { workflow: Workflow; isActive: boolean; activeStep: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 20 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`${isActive ? 'block' : 'hidden'}`}
    >
      {/* Horizontal flow — scrollable on mobile */}
      <div className="overflow-x-auto pb-4 -mx-2 px-2">
        <div className="flex items-center justify-center min-w-[700px] py-8">
          {workflow.steps.map((step, i) => {
            const Icon = step.icon;
            const isStepActive = i <= activeStep;
            const isCurrentStep = i === activeStep;
            return (
              <div key={i} className="flex items-center">
                {/* Node */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={isActive ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                  className="relative group"
                >
                  {/* Glow ring when active */}
                  {isCurrentStep && (
                    <motion.div
                      className="absolute -inset-2 rounded-2xl blur-lg"
                      style={{ backgroundColor: `${step.color}25` }}
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    />
                  )}
                  <div
                    className={`relative backdrop-blur-xl border rounded-xl p-3 md:p-4 min-w-[100px] md:min-w-[110px] text-center transition-all duration-700 ${
                      isStepActive
                        ? 'bg-white/5 border-white/15'
                        : 'bg-transparent border-white/[0.03] opacity-15'
                    }`}
                  >
                    <motion.div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2"
                      style={{
                        backgroundColor: isStepActive ? `${step.color}15` : 'transparent',
                        border: `1px solid ${isStepActive ? `${step.color}30` : 'rgba(255,255,255,0.03)'}`,
                      }}
                      animate={
                        isCurrentStep
                          ? {
                              boxShadow: [
                                `0 0 0px ${step.color}00`,
                                `0 0 25px ${step.color}40`,
                                `0 0 0px ${step.color}00`,
                              ],
                            }
                          : {}
                      }
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      <Icon className="w-5 h-5" style={{ color: isStepActive ? step.color : 'rgba(255,255,255,0.1)' }} />
                    </motion.div>
                    <p className={`text-xs font-medium leading-tight transition-colors duration-700 ${isStepActive ? 'text-white' : 'text-white/10'}`}>
                      {step.label}
                    </p>
                    <p className={`text-[10px] mt-0.5 leading-tight transition-colors duration-700 ${isStepActive ? 'text-white/40' : 'text-white/[0.05]'}`}>
                      {step.sublabel}
                    </p>
                  </div>
                </motion.div>

                {/* Connector (not after last) */}
                {i < workflow.steps.length - 1 && (
                  <FlowConnector
                    color={workflow.steps[i + 1].color}
                    isActive={i < activeStep - 1}
                    isAnimating={i === activeStep - 1}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function AutomationFlowSection() {
  const [activeWorkflow, setActiveWorkflow] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  // Sequential step animation: activate one card at a time
  useEffect(() => {
    const stepCount = workflows[activeWorkflow].steps.length;
    const stepInterval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= stepCount - 1) {
          clearInterval(stepInterval);
          return prev;
        }
        return prev + 1;
      });
    }, 2000);

    return () => clearInterval(stepInterval);
  }, [activeWorkflow]);

  // Reset step when workflow changes via tab click
  const handleTabClick = (index: number) => {
    setActiveWorkflow(index);
    setActiveStep(0);
  };

  return (
    <section className="relative py-24 px-6" id="how-it-works">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#050510] via-[#080818] to-[#050510]" />
      <div className="absolute top-1/4 left-0 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-0 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="text-cyan-400 text-sm font-medium tracking-widest uppercase">How It Works</span>
          <h2 className="text-4xl md:text-6xl font-bold mt-4 mb-6">
            <span className="text-white">Automate Any</span>{' '}
            <GradientText>Workflow</GradientText>
          </h2>
          <p className="text-white/40 text-lg max-w-2xl mx-auto">
            Here are a few examples — but the possibilities are endless. Build any automation flow you can imagine.
          </p>
        </motion.div>

        {/* Workflow tabs with integration icons */}
        <div className="flex items-center justify-center gap-3 mb-8 flex-wrap">
          {workflows.map((wf, i) => {
            const TabIcon = workflowTabIcons[wf.id];
            return (
              <motion.button
                key={wf.id}
                onClick={() => handleTabClick(i)}
                className={`relative px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                  activeWorkflow === i
                    ? 'text-white'
                    : 'text-white/40 hover:text-white/60 bg-white/3 border border-white/5 hover:border-white/10'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Active background */}
                {activeWorkflow === i && (
                  <motion.div
                    layoutId="activeTab"
                    className={`absolute inset-0 rounded-xl bg-gradient-to-r ${wf.gradient} opacity-80`}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <TabIcon size={18} />
                  {wf.title}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Subtitle for active workflow */}
        <motion.p
          key={activeWorkflow}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-white/30 text-sm mb-4 font-mono"
        >
          {workflows[activeWorkflow].subtitle}
        </motion.p>

        {/* Flow display area */}
        <div className="relative bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-2xl overflow-hidden">
          {/* Top accent bar */}
          <motion.div
            className={`h-0.5 bg-gradient-to-r ${workflows[activeWorkflow].gradient}`}
            layoutId="accentBar"
            transition={{ duration: 0.3 }}
          />

          {/* Workflow flows */}
          {workflows.map((wf, i) => (
            <WorkflowFlow
              key={wf.id}
              workflow={wf}
              isActive={activeWorkflow === i}
              activeStep={activeWorkflow === i ? activeStep : -1}
            />
          ))}
        </div>

        {/* Bottom hint */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center text-white/20 text-xs mt-6"
        >
          These are just examples — connect any source, any agent prompt, any output. The flow is yours to design.
        </motion.p>
      </div>
    </section>
  );
}

// ─── Navigation ─────────────────────────────────────────────────────────────

function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <motion.nav
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#050510]/80 backdrop-blur-xl border-b border-white/5' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <a href="#" className="flex items-center gap-0 text-xl font-bold tracking-tight">
          <span className="text-white">CLAUDE</span>
          <GradientText>.MGR</GradientText>
        </a>

        <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#integrations" className="hover:text-white transition-colors">Integrations</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://github.com/Charlie85270/claude-mgr"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 text-sm text-white/70 hover:text-white border border-white/10 rounded-xl hover:border-white/20 transition-all"
          >
            <Github className="w-4 h-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <a
            href="/api/download?platform=mac"
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-cyan-500 rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all"
          >
            <Download className="w-4 h-4" />
            Download
          </a>
        </div>
      </div>
    </motion.nav>
  );
}

// ─── Hero Section ───────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 overflow-hidden">
      {/* Background orbs */}
      <FloatingOrb className="w-[600px] h-[600px] bg-purple-600/20 -top-48 -left-48" delay={0} />
      <FloatingOrb className="w-[500px] h-[500px] bg-cyan-500/15 -bottom-32 -right-32" delay={0.3} />
      <FloatingOrb className="w-[300px] h-[300px] bg-blue-600/10 top-1/3 right-1/4" delay={0.6} />

      <div className="relative z-10 max-w-7xl w-full mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-white/60 mb-8"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            Automate Your Dev Workflow
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-6"
          >
            <span className="text-white">Automate.</span>
            <br />
            <span className="text-white">Integrate.</span>
            <br />
            <GradientText>Ship Faster.</GradientText>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Connect JIRA, GitHub, Slack, and Telegram to Claude Code agents that work autonomously.
            Automate PR reviews, process JIRA tickets, and deliver results — all hands-free.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="flex flex-wrap items-center justify-center gap-4 mb-16"
          >
            <a
              href="/api/download?platform=mac"
              className="group flex items-center gap-2.5 px-8 py-3.5 text-base font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 rounded-2xl hover:shadow-2xl hover:shadow-purple-500/30 transition-all"
            >
              <Download className="w-5 h-5" />
              Download for Mac
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <a
              href="#demo"
              className="flex items-center gap-2.5 px-8 py-3.5 text-base font-medium text-white/80 border border-white/15 rounded-2xl hover:bg-white/5 hover:border-white/25 transition-all"
            >
              <Play className="w-5 h-5" />
              Watch Demo
            </a>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-8 md:gap-12"
          >
            {[
              { label: 'JIRA + GitHub + Slack', icon: Zap },
              { label: '30+ MCP Tools', icon: Workflow },
              { label: 'Free & Open Source', icon: Github },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-2 text-white/40 text-sm">
                <stat.icon className="w-4 h-4 text-purple-400" />
                <span>{stat.label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Hero screenshot */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
          className="max-w-4xl mx-auto"
        >
          <GlassCard className="p-0 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-white/3 border-b border-white/5">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <span className="text-xs text-white/30 font-mono">claude.mgr — Dashboard</span>
            </div>
            <img src="/0.png" alt="claude.mgr Dashboard" className="w-full h-auto" />
          </GlassCard>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Integration Logos Banner ───────────────────────────────────────────────

function IntegrationBanner() {
  const logos = [
    { component: TelegramIcon, name: 'Telegram' },
    { component: SlackIcon, name: 'Slack' },
    { component: GithubIcon, name: 'GitHub' },
    { component: JiraIcon, name: 'JIRA' },
  ];
  // Duplicate 4x for seamless loop
  const allLogos = [...logos, ...logos, ...logos, ...logos];

  return (
    <SectionWrapper className="py-16 overflow-hidden">
      <div className="relative">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#050510] to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#050510] to-transparent z-10" />

        <motion.div
          className="flex items-center gap-16"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ repeat: Infinity, duration: 25, ease: 'linear' }}
        >
          {allLogos.map((logo, i) => {
            const LogoComp = logo.component;
            return (
              <div
                key={`${logo.name}-${i}`}
                className="flex-shrink-0 flex items-center gap-3 opacity-40 hover:opacity-80 transition-opacity duration-300 cursor-default"
              >
                <LogoComp size={40} />
                <span className="text-white/60 text-sm font-medium whitespace-nowrap">{logo.name}</span>
              </div>
            );
          })}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

// ─── Parallel Execution Section ─────────────────────────────────────────────

const terminalAgents = [
  {
    name: 'agent-frontend',
    project: '~/projects/web-app/src',
    status: 'running',
    lines: ['Refactoring Dashboard component...', 'Updated 3 files, running tests...', '> npm test -- --watch'],
  },
  {
    name: 'agent-api',
    project: '~/projects/api-service',
    status: 'completed',
    lines: ['Added rate limiting middleware', 'All 47 tests passing', 'Ready for review'],
  },
  {
    name: 'agent-tests',
    project: '~/projects/web-app/tests',
    status: 'running',
    lines: ['Writing integration tests...', 'Coverage: 87% -> 92%', '> vitest run --reporter=verbose'],
  },
  {
    name: 'agent-docs',
    project: '~/projects/docs',
    status: 'waiting',
    lines: ['Queued: Update API documentation', 'Waiting for api-service to complete...', '...'],
  },
];

function TerminalCard({ agent, index }: { agent: typeof terminalAgents[0]; index: number }) {
  const statusBadge: Record<string, string> = {
    running: 'bg-emerald-500',
    completed: 'bg-blue-500',
    waiting: 'bg-yellow-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
    >
      <GlassCard className="p-0">
        {/* Title bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Terminal className="w-3.5 h-3.5 text-white/40" />
            <span className="text-xs text-white/60 font-mono">{agent.name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${statusBadge[agent.status]}`} />
            <span className="text-xs text-white/40 capitalize">{agent.status}</span>
          </div>
        </div>
        {/* Terminal body */}
        <div className="p-4 font-mono text-xs space-y-1.5">
          <div className="text-white/30 mb-2">{agent.project}</div>
          {agent.lines.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 + i * 0.1 + 0.3 }}
              className="text-white/60"
            >
              <span className="text-purple-400 mr-2">$</span>
              {line}
            </motion.div>
          ))}
        </div>
      </GlassCard>
    </motion.div>
  );
}

function ParallelSection() {
  const features = [
    'Isolated PTY sessions per agent',
    'Real-time output streaming',
    'Autonomous execution mode',
    'Git worktree branch isolation',
  ];

  return (
    <SectionWrapper id="features">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-purple-400 text-sm font-medium tracking-widest uppercase mb-4"
          >
            Parallel Execution
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-bold text-white mb-4"
          >
            Parallel Agents. <GradientText>One Dashboard.</GradientText>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-white/40 text-lg max-w-xl mx-auto"
          >
            Run multiple Claude Code agents simultaneously, each in isolated sessions with
            real-time streaming output.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-12">
          {terminalAgents.map((agent, i) => (
            <TerminalCard key={agent.name} agent={agent} index={i} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap justify-center gap-6"
        >
          {features.map((feat) => (
            <div key={feat} className="flex items-center gap-2 text-white/50 text-sm">
              <Check className="w-4 h-4 text-cyan-400" />
              {feat}
            </div>
          ))}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

// ─── Integrations Section ───────────────────────────────────────────────────

const integrations = [
  {
    name: 'JIRA',
    icon: JiraIcon,
    color: '#2684FF',
    description: 'Auto-process tickets, transition statuses, post comments via REST API. Poll for new issues and assign agents automatically.',
  },
  {
    name: 'GitHub',
    icon: GithubIcon,
    color: '#ffffff',
    description: 'Poll PRs & issues, auto-review code, post comments via gh CLI. Trigger agents on new pull requests.',
  },
  {
    name: 'Telegram',
    icon: TelegramIcon,
    color: '#229ED9',
    description: 'Remote control from your phone -- start agents, check status, talk to Super Agent. Full bot integration.',
  },
  {
    name: 'Slack',
    icon: SlackIcon,
    color: '#4A154B',
    description: 'Manage agents from your workspace with @mentions and DMs. Get real-time notifications on agent activity.',
  },
];

function IntegrationSection() {
  return (
    <SectionWrapper id="integrations">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-cyan-400 text-sm font-medium tracking-widest uppercase mb-4"
          >
            Integrations
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-bold text-white"
          >
            Connect <GradientText>Everything</GradientText>
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
          {integrations.map((integration, i) => {
            const IconComp = integration.icon;
            return (
              <motion.div
                key={integration.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <GlassCard className="p-6" glowColor={integration.color}>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <IconComp size={44} />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-lg mb-2">{integration.name}</h3>
                      <p className="text-white/40 text-sm leading-relaxed">{integration.description}</p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
}


// ─── Features Grid ──────────────────────────────────────────────────────────

const featuresList = [
  {
    icon: Crown,
    title: 'Super Agent',
    description: 'An orchestrator agent that delegates work to sub-agents, monitors progress, and consolidates results.',
    color: '#a855f7',
  },
  {
    icon: FolderKanban,
    title: 'Kanban Board',
    description: 'Visual task management with automatic agent assignment. Drag, drop, and let AI handle the rest.',
    color: '#22d3ee',
  },
  {
    icon: Brain,
    title: 'Persistent Memory',
    description: 'claude-mem integration gives agents long-term memory across sessions. Context that never fades.',
    color: '#3b82f6',
  },
  {
    icon: GitBranch,
    title: 'Git Worktrees',
    description: 'Each agent works on isolated git branches via worktrees. No merge conflicts, no stepping on toes.',
    color: '#22d3ee',
  },
  {
    icon: BarChart2,
    title: 'Usage Analytics',
    description: 'Track tokens consumed, costs per agent, session durations, and API usage in real time.',
    color: '#a855f7',
  },
  {
    icon: Layers,
    title: 'Skills & Plugins',
    description: 'Extend agent capabilities with the skills.sh ecosystem. Install, manage, and share custom skills.',
    color: '#3b82f6',
  },
];

function FeaturesGrid() {
  return (
    <SectionWrapper>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-purple-400 text-sm font-medium tracking-widest uppercase mb-4"
          >
            Everything You Need
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-bold text-white"
          >
            Built for <GradientText>Power Users</GradientText>
          </motion.h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {featuresList.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <GlassCard className="p-6 h-full" glowColor={feat.color}>
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${feat.color}15`, border: `1px solid ${feat.color}30` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: feat.color }} />
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">{feat.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{feat.description}</p>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
}

// ─── Download CTA Section ───────────────────────────────────────────────────

function DownloadSection() {
  return (
    <SectionWrapper id="download">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-3xl overflow-hidden"
        >
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-blue-600/10 to-cyan-500/20" />
          <div className="absolute inset-0 bg-white/[0.02] backdrop-blur-3xl" />
          <div className="absolute inset-0 border border-white/10 rounded-3xl" />

          {/* Decorative orbs */}
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl" />

          <div className="relative px-8 py-16 md:px-16 md:py-20 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center mx-auto mb-8"
            >
              <Download className="w-8 h-8 text-white" />
            </motion.div>

            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Ready to <GradientText>Get Started?</GradientText>
            </h2>
            <p className="text-white/40 text-lg max-w-lg mx-auto mb-10">
              Download claude.mgr and start orchestrating your AI workforce in minutes.
              No account needed, no hidden costs.
            </p>

            <a
              href="/api/download?platform=mac"
              className="group inline-flex items-center gap-3 px-10 py-4 text-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 rounded-2xl hover:shadow-2xl hover:shadow-purple-500/30 transition-all mb-8"
            >
              <Download className="w-5 h-5" />
              Download for Mac
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>

            <div className="mb-8">
              <p className="text-white/20 text-xs font-mono">
                After install, run: <span className="text-white/40">xattr -cr /Applications/claude.mgr.app</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-8">
              {['Free Forever', 'Open Source', 'No Account Required'].map((item) => (
                <div key={item} className="flex items-center gap-2 text-white/40 text-sm">
                  <Check className="w-4 h-4 text-emerald-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

// ─── Footer ─────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="relative border-t border-white/5 py-12 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <a href="#" className="text-lg font-bold tracking-tight">
            <span className="text-white">CLAUDE</span>
            <GradientText>.MGR</GradientText>
          </a>
          <a
            href="https://github.com/Charlie85270/claude-mgr"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors text-sm"
          >
            <Github className="w-4 h-4" />
            GitHub
          </a>
        </div>
        <p className="text-white/20 text-sm">
          Built with <span className="text-red-400">&hearts;</span> for the Claude community
        </p>
      </div>
    </footer>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <main className="relative bg-[#050510] text-white min-h-screen overflow-hidden">
      <StarField />
      <Navigation />
      <HeroSection />
      <IntegrationBanner />
      <ParallelSection />
      <AutomationFlowSection />
      <FeaturesGrid />
      <IntegrationSection />
      <DownloadSection />
      <Footer />
    </main>
  );
}
