'use client';

import { motion, useInView } from 'framer-motion';
import {
  Bot,
  Terminal,
  BarChart2,
  Zap,
  Layers,
  Github,
  Download,
  MessageSquare,
  FolderKanban,
  Check,
  Workflow,
  Brain,
  Send,
  Plug,
  Cpu,
  Globe,
  Wrench,
  CircleDot,
  ChevronRight,
  Heart,
  ExternalLink,
  Smartphone,
} from 'lucide-react';
import { useRef } from 'react';

// ─── ANIMATION VARIANTS ──────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
} as const;

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6 } },
} as const;

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
} as const;

const slideLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: 'easeOut' } },
} as const;

const slideRight = {
  hidden: { opacity: 0, x: 60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: 'easeOut' } },
} as const;

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: 'easeOut' } },
} as const;

// ─── HIGHLIGHT COMPONENT ─────────────────────────────────────────────────────

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block">
      {children}
      <span className="absolute bottom-1 left-0 w-full h-[6px] bg-gradient-to-r from-[#c2f070] to-[#7ae582] opacity-60 rounded-full -z-10" />
    </span>
  );
}

// ─── SECTION WRAPPER ─────────────────────────────────────────────────────────

function Section({
  children,
  className = '',
  id,
  dark = false,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  dark?: boolean;
}) {
  return (
    <section
      id={id}
      className={`relative px-6 md:px-12 lg:px-20 py-20 md:py-28 ${
        dark ? 'bg-[#1a3a2a] text-white' : 'bg-[#fafaf5]'
      } ${className}`}
    >
      <div className="max-w-7xl mx-auto">{children}</div>
    </section>
  );
}

// ─── ANIMATED BAR CHART ──────────────────────────────────────────────────────

function MiniBarChart() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  const bars = [
    { height: 65, label: 'Mon', color: '#2d6a4f' },
    { height: 85, label: 'Tue', color: '#40916c' },
    { height: 45, label: 'Wed', color: '#2d6a4f' },
    { height: 95, label: 'Thu', color: '#40916c' },
    { height: 70, label: 'Fri', color: '#2d6a4f' },
    { height: 55, label: 'Sat', color: '#52b788' },
    { height: 80, label: 'Sun', color: '#40916c' },
  ];

  return (
    <div ref={ref} className="flex items-end gap-2 h-28 mt-4">
      {bars.map((bar, i) => (
        <div key={i} className="flex flex-col items-center flex-1 gap-1">
          <motion.div
            className="w-full rounded-t-md"
            style={{ backgroundColor: bar.color }}
            initial={{ height: 0 }}
            animate={isInView ? { height: bar.height } : { height: 0 }}
            transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
          />
          <span className="text-[10px] text-[#6b7280]">{bar.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── AGENT CARD MINI ─────────────────────────────────────────────────────────

function AgentCardMini({
  name,
  status,
  project,
  color,
}: {
  name: string;
  status: 'running' | 'idle' | 'done';
  project: string;
  color: string;
}) {
  const statusColors = {
    running: 'bg-green-500',
    idle: 'bg-yellow-500',
    done: 'bg-blue-500',
  };

  return (
    <div className="flex items-center gap-3 bg-white/80 border border-[#e5e5e0] rounded-xl px-4 py-3">
      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[#1a1a1a] truncate">{name}</div>
        <div className="text-xs text-[#6b7280] truncate">{project}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${statusColors[status]} animate-pulse`} />
        <span className="text-xs text-[#6b7280] capitalize">{status}</span>
      </div>
    </div>
  );
}

// ─── MINI KANBAN ─────────────────────────────────────────────────────────────

function MiniKanban() {
  const columns = [
    { title: 'To Do', cards: ['Fix auth bug', 'Add tests'] },
    { title: 'In Progress', cards: ['API refactor'] },
    { title: 'Done', cards: ['Setup CI', 'Docs'] },
  ];

  return (
    <div className="flex gap-2 mt-4">
      {columns.map((col, i) => (
        <div key={i} className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1.5">
            {col.title}
          </div>
          <div className="space-y-1.5">
            {col.cards.map((card, j) => (
              <div
                key={j}
                className="bg-white border border-[#e5e5e0] rounded-lg px-2 py-1.5 text-[11px] text-[#1a1a1a] truncate shadow-sm"
              >
                {card}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── MINI PIPELINE ───────────────────────────────────────────────────────────

function MiniPipeline() {
  return (
    <div className="flex items-center gap-2 mt-4 justify-center">
      {[
        { icon: <Github className="w-4 h-4" />, label: 'Source' },
        { icon: <Bot className="w-4 h-4" />, label: 'Agent' },
        { icon: <Check className="w-4 h-4" />, label: 'Output' },
      ].map((step, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-xl bg-[#2d6a4f]/10 flex items-center justify-center text-[#2d6a4f]">
              {step.icon}
            </div>
            <span className="text-[10px] text-[#6b7280]">{step.label}</span>
          </div>
          {i < 2 && (
            <ChevronRight className="w-3 h-3 text-[#2d6a4f]/40 -mt-4" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── TELEGRAM MOCKUP ─────────────────────────────────────────────────────────

function TelegramMockup() {
  return (
    <div className="mt-4 space-y-2">
      <div className="flex gap-2 items-end">
        <div className="w-6 h-6 rounded-full bg-[#0088cc] flex items-center justify-center flex-shrink-0">
          <Send className="w-3 h-3 text-white" />
        </div>
        <div className="bg-white border border-[#e5e5e0] rounded-xl rounded-bl-none px-3 py-2 text-xs text-[#1a1a1a] max-w-[80%]">
          /status all agents
        </div>
      </div>
      <div className="flex gap-2 items-end justify-end">
        <div className="bg-[#2d6a4f] rounded-xl rounded-br-none px-3 py-2 text-xs text-white max-w-[80%]">
          3 running, 2 idle. Agent-7 completed PR #142.
        </div>
      </div>
    </div>
  );
}

// ─── FLOATING HERO CARD ──────────────────────────────────────────────────────

function FloatingCard({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={`absolute hidden lg:block bg-white/90 backdrop-blur-sm border border-[#e5e5e0] rounded-xl shadow-lg px-4 py-3 z-10 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.8, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

// ─── INTEGRATION CARD ────────────────────────────────────────────────────────

function IntegrationCard({
  icon,
  name,
  description,
  delay,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ scale: 1.05, y: -4 }}
      transition={{ type: 'spring', stiffness: 300 }}
      className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-6 flex flex-col items-center text-center gap-3"
    >
      <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
        {icon}
      </div>
      <h3 className="font-semibold text-white text-lg">{name}</h3>
      <p className="text-sm text-white/70 leading-relaxed">{description}</p>
    </motion.div>
  );
}

// ─── STEP CARD ───────────────────────────────────────────────────────────────

function StepCard({
  number,
  title,
  description,
  icon,
}: {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <motion.div variants={fadeUp} className="flex flex-col items-center text-center flex-1">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-[#2d6a4f]/10 flex items-center justify-center text-[#2d6a4f]">
          {icon}
        </div>
        <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#2d6a4f] flex items-center justify-center">
          <span className="text-white text-xs font-bold">{number}</span>
        </div>
      </div>
      <h3 className="text-xl font-bold text-[#1a1a1a] mb-2">{title}</h3>
      <p className="text-[#6b7280] text-sm leading-relaxed max-w-xs">{description}</p>
    </motion.div>
  );
}

// ─── MCP SERVER CARD ─────────────────────────────────────────────────────────

function McpCard({
  name,
  toolCount,
  description,
  tools,
}: {
  name: string;
  toolCount: number;
  description: string;
  tools: string[];
}) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -4 }}
      className="bg-[#f5f5f0] border border-[#e5e5e0] rounded-2xl p-6 shadow-sm"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-[#2d6a4f]/10 flex items-center justify-center">
          <Plug className="w-5 h-5 text-[#2d6a4f]" />
        </div>
        <div>
          <h3 className="font-bold text-[#1a1a1a]">{name}</h3>
          <span className="text-xs font-mono text-[#2d6a4f] bg-[#2d6a4f]/10 px-2 py-0.5 rounded-full">
            {toolCount} tools
          </span>
        </div>
      </div>
      <p className="text-sm text-[#6b7280] mb-4 leading-relaxed">{description}</p>
      <div className="space-y-1.5">
        {tools.map((tool, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <CircleDot className="w-3 h-3 text-[#40916c]" />
            <code className="font-mono text-[#1a1a1a]">{tool}</code>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── SCREENSHOT CARD ─────────────────────────────────────────────────────────

function ScreenshotCard({
  title,
  description,
  src,
  direction,
}: {
  title: string;
  description: string;
  src: string;
  direction: 'left' | 'right';
}) {
  return (
    <motion.div
      variants={direction === 'left' ? slideLeft : slideRight}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      className="bg-white border border-[#e5e5e0] rounded-2xl shadow-md overflow-hidden"
    >
      <div className="p-6 md:p-8">
        <h3 className="text-xl md:text-2xl font-bold text-[#1a1a1a] mb-2">{title}</h3>
        <p className="text-[#6b7280] text-sm leading-relaxed">{description}</p>
      </div>
      <div className="px-6 pb-6 md:px-8 md:pb-8">
        <div className="rounded-xl overflow-hidden border border-[#e5e5e0]">
          <img src={src} alt={title} className="w-full h-auto" loading="lazy" />
        </div>
      </div>
    </motion.div>
  );
}

// ─── TRUST ICON ──────────────────────────────────────────────────────────────

function TrustIcon({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[#6b7280]">
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── MAIN PAGE COMPONENT ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fafaf5] overflow-x-hidden">
      {/* ─── NAVIGATION ──────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-50 bg-[#fafaf5]/80 backdrop-blur-xl border-b border-[#e5e5e0]/50"
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="bg-[#1a3a2a] text-white px-4 py-1.5 rounded-full text-sm font-bold tracking-tight">
              claude.mgr
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm text-[#6b7280] hover:text-[#1a1a1a] transition-colors">
                Features
              </a>
              <a href="#integrations" className="text-sm text-[#6b7280] hover:text-[#1a1a1a] transition-colors">
                Integrations
              </a>
              <a href="#how-it-works" className="text-sm text-[#6b7280] hover:text-[#1a1a1a] transition-colors">
                How it Works
              </a>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/nichochar/claude-manager"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 text-sm text-[#6b7280] hover:text-[#1a1a1a] transition-colors"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
            <a
              href="https://github.com/nichochar/claude-manager/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#2d6a4f] hover:bg-[#1a3a2a] text-white text-sm font-medium px-5 py-2 rounded-full transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          </div>
        </div>
      </motion.nav>

      {/* ─── HERO SECTION ────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-6 md:px-12 lg:px-20 overflow-hidden">
        {/* Grid Background */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(#1a3a2a 1px, transparent 1px), linear-gradient(90deg, #1a3a2a 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Floating Cards */}
        <FloatingCard className="top-36 left-[8%] rotate-[-3deg]" delay={0.5}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-[#1a1a1a]">Agent-3 running</span>
          </div>
          <div className="text-[10px] text-[#6b7280] mt-0.5">api-refactor &middot; 12m</div>
        </FloatingCard>

        <FloatingCard className="top-44 right-[8%] rotate-[2deg]" delay={0.7}>
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-[#2d6a4f]" />
            <code className="text-[11px] text-[#1a1a1a] font-mono">git push origin main</code>
          </div>
        </FloatingCard>

        <FloatingCard className="bottom-40 left-[12%] rotate-[2deg]" delay={0.9}>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-[#0088cc]" />
            <span className="text-xs text-[#1a1a1a]">PR #142 merged</span>
          </div>
        </FloatingCard>

        <FloatingCard className="bottom-48 right-[10%] rotate-[-2deg]" delay={1.1}>
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-medium text-[#1a1a1a]">5 tasks completed</span>
          </div>
          <div className="flex gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-4 h-1.5 rounded-full bg-[#2d6a4f]" />
            ))}
          </div>
        </FloatingCard>

        <FloatingCard className="top-72 left-[25%] rotate-[1deg]" delay={1.3}>
          <div className="flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-[#40916c]" />
            <span className="text-xs text-[#1a1a1a]">$4.20 today</span>
            <span className="text-[10px] text-green-600">-12%</span>
          </div>
        </FloatingCard>

        <FloatingCard className="top-80 right-[22%] rotate-[-1deg]" delay={1.5}>
          <div className="flex items-center gap-2">
            <FolderKanban className="w-3.5 h-3.5 text-[#2d6a4f]" />
            <span className="text-xs text-[#1a1a1a]">3 in progress</span>
          </div>
        </FloatingCard>

        {/* Hero Content */}
        <div className="relative max-w-4xl mx-auto text-center z-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 bg-[#2d6a4f]/10 text-[#2d6a4f] text-sm font-medium px-4 py-1.5 rounded-full mb-8"
          >
            <Bot className="w-4 h-4" />
            Open source AI agent orchestrator
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold text-[#1a1a1a] leading-[1.1] mb-6 font-serif"
          >
            One tool to <Highlight>orchestrate</Highlight>
            <br />
            all your AI agents
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="text-lg md:text-xl text-[#6b7280] max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Run 10+ Claude Code agents in parallel. Automate JIRA and GitHub workflows.
            Control everything from Telegram.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a
              href="https://github.com/nichochar/claude-manager/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#2d6a4f] hover:bg-[#1a3a2a] text-white font-semibold px-8 py-3.5 rounded-full transition-all hover:shadow-lg hover:shadow-[#2d6a4f]/20 flex items-center gap-2 text-base"
            >
              <Download className="w-5 h-5" />
              Download for Free
            </a>
            <a
              href="https://github.com/nichochar/claude-manager"
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-[#e5e5e0] hover:border-[#2d6a4f] text-[#1a1a1a] font-semibold px-8 py-3.5 rounded-full transition-all flex items-center gap-2 text-base"
            >
              <Github className="w-5 h-5" />
              View on GitHub
            </a>
          </motion.div>

          {/* Trust Bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-16 flex flex-col items-center gap-4"
          >
            <span className="text-xs uppercase tracking-widest text-[#6b7280] font-medium">
              Integrates with
            </span>
            <div className="flex items-center gap-6 flex-wrap justify-center">
              <TrustIcon icon={<Send className="w-4 h-4" />} label="Telegram" />
              <TrustIcon icon={<MessageSquare className="w-4 h-4" />} label="Slack" />
              <TrustIcon icon={<Github className="w-4 h-4" />} label="GitHub" />
              <TrustIcon icon={<Layers className="w-4 h-4" />} label="JIRA" />
              <TrustIcon icon={<Wrench className="w-4 h-4" />} label="skills.sh" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── FEATURES BENTO GRID ─────────────────────────────────────────── */}
      <Section id="features">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.span
            variants={fadeUp}
            className="inline-block text-sm font-medium text-[#2d6a4f] bg-[#2d6a4f]/10 px-4 py-1.5 rounded-full mb-4"
          >
            Features
          </motion.span>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-bold text-[#1a1a1a] mb-4">
            Everything you <Highlight>need</Highlight>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-[#6b7280] text-lg max-w-xl mx-auto">
            A complete platform for managing AI coding agents at scale
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-min"
        >
          {/* LARGE CARD: Dashboard */}
          <motion.div
            variants={fadeUp}
            whileHover={{ y: -4 }}
            className="lg:col-span-2 bg-[#f5f5f0] border border-[#e5e5e0] rounded-2xl p-6 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#2d6a4f]/10 flex items-center justify-center">
                <BarChart2 className="w-5 h-5 text-[#2d6a4f]" />
              </div>
              <div>
                <h3 className="font-bold text-[#1a1a1a] text-lg">Dynamic Dashboard</h3>
                <p className="text-xs text-[#6b7280]">Real-time analytics and usage tracking</p>
              </div>
            </div>
            <p className="text-sm text-[#6b7280] leading-relaxed mb-2">
              Track token usage, costs, and agent performance across all your projects
              with beautiful visualizations.
            </p>
            <MiniBarChart />
          </motion.div>

          {/* LARGE CARD: Parallel Agents */}
          <motion.div
            variants={fadeUp}
            whileHover={{ y: -4 }}
            className="lg:col-span-2 bg-[#f5f5f0] border border-[#e5e5e0] rounded-2xl p-6 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#2d6a4f]/10 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-[#2d6a4f]" />
              </div>
              <div>
                <h3 className="font-bold text-[#1a1a1a] text-lg">Parallel Agents</h3>
                <p className="text-xs text-[#6b7280]">Run 10+ agents simultaneously</p>
              </div>
            </div>
            <p className="text-sm text-[#6b7280] leading-relaxed mb-4">
              Spawn agents across different projects with independent workspaces, git worktrees,
              and persistent memory.
            </p>
            <div className="space-y-2">
              <AgentCardMini name="Agent-1" status="running" project="api-service" color="bg-[#2d6a4f]" />
              <AgentCardMini name="Agent-2" status="running" project="frontend-app" color="bg-[#40916c]" />
              <AgentCardMini name="Agent-3" status="idle" project="data-pipeline" color="bg-[#52b788]" />
            </div>
          </motion.div>

          {/* SMALL CARD: Smart Automations */}
          <motion.div
            variants={fadeUp}
            whileHover={{ y: -4 }}
            className="lg:col-span-2 bg-[#f5f5f0] border border-[#e5e5e0] rounded-2xl p-6 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#2d6a4f]/10 flex items-center justify-center">
                <Workflow className="w-5 h-5 text-[#2d6a4f]" />
              </div>
              <div>
                <h3 className="font-bold text-[#1a1a1a] text-lg">Smart Automations</h3>
                <p className="text-xs text-[#6b7280]">Connect sources, trigger agents</p>
              </div>
            </div>
            <p className="text-sm text-[#6b7280] leading-relaxed">
              Poll JIRA and GitHub for new issues and PRs. Automatically assign agents,
              run tasks, and post results back.
            </p>
            <MiniPipeline />
          </motion.div>

          {/* SMALL CARD: Remote Control */}
          <motion.div
            variants={fadeUp}
            whileHover={{ y: -4 }}
            className="lg:col-span-2 bg-[#f5f5f0] border border-[#e5e5e0] rounded-2xl p-6 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#2d6a4f]/10 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-[#2d6a4f]" />
              </div>
              <div>
                <h3 className="font-bold text-[#1a1a1a] text-lg">Remote Control</h3>
                <p className="text-xs text-[#6b7280]">Manage from anywhere</p>
              </div>
            </div>
            <p className="text-sm text-[#6b7280] leading-relaxed">
              Control your agents via Telegram and Slack bots. Get notifications, check status,
              and trigger tasks from your phone.
            </p>
            <TelegramMockup />
          </motion.div>

          {/* MEDIUM CARD: MCP Protocol */}
          <motion.div
            variants={fadeUp}
            whileHover={{ y: -4 }}
            className="lg:col-span-2 bg-[#f5f5f0] border border-[#e5e5e0] rounded-2xl p-6 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#2d6a4f]/10 flex items-center justify-center">
                <Plug className="w-5 h-5 text-[#2d6a4f]" />
              </div>
              <div>
                <h3 className="font-bold text-[#1a1a1a] text-lg">MCP Protocol</h3>
                <p className="text-xs text-[#6b7280]">30+ built-in tools</p>
              </div>
            </div>
            <p className="text-sm text-[#6b7280] leading-relaxed mb-4">
              Three dedicated MCP servers give your agents programmatic control over
              the entire platform.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '26+ orchestrator tools', color: 'bg-[#2d6a4f]' },
                { label: '4 telegram tools', color: 'bg-[#40916c]' },
                { label: '8 kanban tools', color: 'bg-[#52b788]' },
              ].map((badge, i) => (
                <span
                  key={i}
                  className={`${badge.color} text-white text-xs font-medium px-3 py-1.5 rounded-full`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          </motion.div>

          {/* MEDIUM CARD: Kanban Board */}
          <motion.div
            variants={fadeUp}
            whileHover={{ y: -4 }}
            className="lg:col-span-2 bg-[#f5f5f0] border border-[#e5e5e0] rounded-2xl p-6 shadow-sm"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#2d6a4f]/10 flex items-center justify-center">
                <FolderKanban className="w-5 h-5 text-[#2d6a4f]" />
              </div>
              <div>
                <h3 className="font-bold text-[#1a1a1a] text-lg">Kanban Board</h3>
                <p className="text-xs text-[#6b7280]">Visual task management</p>
              </div>
            </div>
            <p className="text-sm text-[#6b7280] leading-relaxed">
              Drag-and-drop kanban with automatic agent assignment. Link tasks to JIRA
              issues and track progress visually.
            </p>
            <MiniKanban />
          </motion.div>
        </motion.div>
      </Section>

      {/* ─── INTEGRATIONS SECTION ────────────────────────────────────────── */}
      <Section id="integrations" dark>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.span
            variants={fadeUp}
            className="inline-block text-sm font-medium text-[#7ae582] bg-white/10 px-4 py-1.5 rounded-full mb-4"
          >
            Integrations
          </motion.span>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-bold text-white mb-4">
            Don&apos;t replace. <span className="text-[#7ae582]">Integrate.</span>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/60 text-lg max-w-xl mx-auto">
            claude.mgr connects to the tools you already use, supercharging your existing workflow.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
        >
          <IntegrationCard
            icon={<Send className="w-6 h-6 text-white" />}
            name="Telegram"
            description="Full bot with file sharing, photo capture, and agent control from mobile"
            delay={0}
          />
          <IntegrationCard
            icon={<MessageSquare className="w-6 h-6 text-white" />}
            name="Slack"
            description="Channel-based agent management with threaded conversations"
            delay={0.1}
          />
          <IntegrationCard
            icon={<Github className="w-6 h-6 text-white" />}
            name="GitHub"
            description="Auto-assign agents to PRs, poll issues, push code changes"
            delay={0.2}
          />
          <IntegrationCard
            icon={<Layers className="w-6 h-6 text-white" />}
            name="JIRA"
            description="Poll for issues, auto-assign to agents, post results as comments"
            delay={0.3}
          />
          <IntegrationCard
            icon={<Wrench className="w-6 h-6 text-white" />}
            name="skills.sh"
            description="Browse, install, and manage agent skills from the marketplace"
            delay={0.4}
          />
          <IntegrationCard
            icon={<Brain className="w-6 h-6 text-white" />}
            name="Claude"
            description="Powered by Claude Code CLI with full MCP support"
            delay={0.5}
          />
        </motion.div>
      </Section>

      {/* ─── HOW IT WORKS ────────────────────────────────────────────────── */}
      <Section id="how-it-works">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.span
            variants={fadeUp}
            className="inline-block text-sm font-medium text-[#2d6a4f] bg-[#2d6a4f]/10 px-4 py-1.5 rounded-full mb-4"
          >
            How it Works
          </motion.span>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-bold text-[#1a1a1a] mb-4">
            Get started in <Highlight>3 steps</Highlight>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-[#6b7280] text-lg max-w-xl mx-auto">
            From download to running 10 parallel agents in under 5 minutes.
          </motion.p>
        </motion.div>

        {/* Steps */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
          className="relative"
        >
          {/* Connecting dotted line */}
          <div className="hidden md:block absolute top-8 left-[20%] right-[20%] h-[2px] border-t-2 border-dashed border-[#2d6a4f]/20" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
            <StepCard
              number="1"
              title="Download & Install"
              description="One-click download for macOS. No account required, no dependencies to manage. Just install and launch."
              icon={<Download className="w-7 h-7" />}
            />
            <StepCard
              number="2"
              title="Create Agents"
              description="Spawn agents across your projects with customized skills, CLAUDE.md files, and independent git worktrees."
              icon={<Bot className="w-7 h-7" />}
            />
            <StepCard
              number="3"
              title="Automate & Scale"
              description="Connect JIRA and GitHub, set up polling schedules, enable Telegram control. Let agents handle the rest."
              icon={<Zap className="w-7 h-7" />}
            />
          </div>
        </motion.div>
      </Section>

      {/* ─── SCREENSHOTS SECTION ─────────────────────────────────────────── */}
      <Section className="bg-[#f0f0eb]">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.span
            variants={fadeUp}
            className="inline-block text-sm font-medium text-[#2d6a4f] bg-[#2d6a4f]/10 px-4 py-1.5 rounded-full mb-4"
          >
            Screenshots
          </motion.span>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-bold text-[#1a1a1a] mb-4">
            See it in <Highlight>action</Highlight>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-[#6b7280] text-lg max-w-xl mx-auto">
            A polished desktop experience built for power users
          </motion.p>
        </motion.div>

        <div className="space-y-8 max-w-4xl mx-auto">
          <ScreenshotCard
            title="Agent Dashboard"
            description="Monitor all your agents in real time. See status, token usage, costs, and active projects at a glance from the main dashboard."
            src="/0.png"
            direction="left"
          />
          <ScreenshotCard
            title="Super Agent Orchestrator"
            description="The Super Agent delegates tasks across your fleet of agents, coordinating complex multi-step workflows automatically."
            src="/super-agent.png"
            direction="right"
          />
          <ScreenshotCard
            title="Usage Analytics"
            description="Track token usage, costs, and agent performance over time with detailed charts and breakdowns by project."
            src="/stats.png"
            direction="left"
          />
        </div>
      </Section>

      {/* ─── MCP SECTION ─────────────────────────────────────────────────── */}
      <Section>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={stagger}
          className="text-center mb-16"
        >
          <motion.span
            variants={fadeUp}
            className="inline-block text-sm font-medium text-[#2d6a4f] bg-[#2d6a4f]/10 px-4 py-1.5 rounded-full mb-4"
          >
            MCP Protocol
          </motion.span>
          <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-bold text-[#1a1a1a] mb-4">
            30+ tools. <Highlight>One protocol.</Highlight>
          </motion.h2>
          <motion.p variants={fadeUp} className="text-[#6b7280] text-lg max-w-2xl mx-auto">
            Three dedicated MCP servers give your agents full programmatic control over
            the platform, communications, and task management.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <McpCard
            name="Orchestrator MCP"
            toolCount={26}
            description="Full control over agent lifecycle, projects, automations, and system configuration."
            tools={[
              'create_agent',
              'send_prompt',
              'list_agents',
              'get_agent_conversation',
              'manage_automations',
              'search_memory',
            ]}
          />
          <McpCard
            name="Telegram MCP"
            toolCount={4}
            description="Send messages, photos, documents, and videos to Telegram chats programmatically."
            tools={[
              'send_telegram',
              'send_telegram_photo',
              'send_telegram_document',
              'send_telegram_video',
            ]}
          />
          <McpCard
            name="Kanban MCP"
            toolCount={8}
            description="Manage kanban boards, columns, and cards with full CRUD operations and agent assignment."
            tools={[
              'create_board',
              'create_card',
              'move_card',
              'assign_agent_to_card',
            ]}
          />
        </motion.div>
      </Section>

      {/* ─── DOWNLOAD CTA ────────────────────────────────────────────────── */}
      <Section dark>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={stagger}
          className="text-center"
        >
          <motion.h2
            variants={fadeUp}
            className="text-4xl md:text-6xl font-bold text-white mb-6 font-serif"
          >
            Ready to <span className="text-[#7ae582]">orchestrate</span>?
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/60 text-lg max-w-xl mx-auto mb-10">
            Download claude.mgr for free. No account required. No telemetry.
            Just pure, open-source agent orchestration.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-col items-center gap-6">
            <a
              href="https://github.com/nichochar/claude-manager/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#7ae582] hover:bg-[#52b788] text-[#1a3a2a] font-bold px-10 py-4 rounded-full transition-all hover:shadow-lg hover:shadow-[#7ae582]/20 flex items-center gap-2 text-lg"
            >
              <Download className="w-5 h-5" />
              Download for macOS
            </a>

            <p className="text-white/40 text-sm max-w-md">
              After downloading, run{' '}
              <code className="bg-white/10 px-2 py-0.5 rounded text-white/60 font-mono text-xs">
                xattr -cr /Applications/claude.mgr.app
              </code>{' '}
              to remove the quarantine flag.
            </p>

            <div className="flex items-center gap-8 mt-4">
              {[
                { icon: <Check className="w-4 h-4" />, label: '100% Free' },
                { icon: <Github className="w-4 h-4" />, label: 'Open Source' },
                { icon: <Globe className="w-4 h-4" />, label: 'No Account' },
              ].map((badge, i) => (
                <div key={i} className="flex items-center gap-2 text-white/60 text-sm">
                  <span className="text-[#7ae582]">{badge.icon}</span>
                  {badge.label}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </Section>

      {/* ─── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="bg-[#141414] text-white/40 px-6 md:px-12 lg:px-20 py-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-[#1a3a2a] text-white px-4 py-1.5 rounded-full text-sm font-bold tracking-tight">
              claude.mgr
            </div>
            <span className="text-sm">
              Built with <Heart className="w-3 h-3 inline text-red-400" /> for the Claude community
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/nichochar/claude-manager"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm hover:text-white transition-colors"
            >
              <Github className="w-4 h-4" />
              GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
