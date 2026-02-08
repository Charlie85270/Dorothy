'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import {
  Github,
  Download,
  Terminal,
  Zap,
  Bot,
  GitBranch,
  MessageSquare,
  BarChart3,
  Layers,
  ArrowRight,
  ExternalLink,
  Check,
  Clock,
  Cpu,
  CircleDot,
} from 'lucide-react'

// ─── Blinking cursor CSS ────────────────────────────────────────────
const cursorStyles = `
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes scanline {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}
@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 5px rgba(0,255,136,0.3), 0 0 10px rgba(0,255,136,0.1); }
  50% { box-shadow: 0 0 15px rgba(0,255,136,0.5), 0 0 30px rgba(0,255,136,0.2); }
}
@keyframes progressFill {
  0% { width: 0%; }
  100% { width: var(--target-width); }
}
@keyframes dotPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.blink {
  animation: blink 1s step-end infinite;
}
.scanline-overlay {
  pointer-events: none;
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 50;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 255, 136, 0.015) 2px,
    rgba(0, 255, 136, 0.015) 4px
  );
}
.glow-text {
  text-shadow: 0 0 20px rgba(0,255,136,0.5), 0 0 40px rgba(0,255,136,0.2);
}
.glow-text-subtle {
  text-shadow: 0 0 10px rgba(0,255,136,0.3);
}
.glow-border {
  box-shadow: 0 0 15px rgba(0,255,136,0.15), inset 0 0 15px rgba(0,255,136,0.05);
}
.glow-border-hover:hover {
  box-shadow: 0 0 25px rgba(0,255,136,0.3), inset 0 0 20px rgba(0,255,136,0.08);
}
.neon-btn {
  box-shadow: 0 0 15px rgba(0,255,136,0.4), 0 0 30px rgba(0,255,136,0.15);
  transition: all 0.3s ease;
}
.neon-btn:hover {
  box-shadow: 0 0 25px rgba(0,255,136,0.6), 0 0 50px rgba(0,255,136,0.3);
}
.dot-pulse {
  animation: dotPulse 2s ease-in-out infinite;
}
.float-anim {
  animation: float 3s ease-in-out infinite;
}
`

// ─── Terminal Window Component ──────────────────────────────────────
function TerminalFrame({
  title,
  children,
  className = '',
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-lg border border-[#333] bg-[#0a0a0a] overflow-hidden ${className}`}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#161616] border-b border-[#272727]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-[#555] text-xs font-mono ml-2">{title}</span>
      </div>
      <div className="p-5 font-mono text-sm leading-relaxed">{children}</div>
    </div>
  )
}

// ─── Typing Effect Hook ─────────────────────────────────────────────
function useTypingLines(
  lines: { text: string; color?: string; prefix?: string }[],
  delayBetween = 600,
  startDelay = 800
) {
  const [visibleCount, setVisibleCount] = useState(0)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const startTimer = setTimeout(() => setStarted(true), startDelay)
    return () => clearTimeout(startTimer)
  }, [startDelay])

  useEffect(() => {
    if (!started) return
    if (visibleCount >= lines.length) return
    const timer = setTimeout(
      () => setVisibleCount((c) => c + 1),
      delayBetween
    )
    return () => clearTimeout(timer)
  }, [visibleCount, started, lines.length, delayBetween])

  return visibleCount
}

// ─── Section Reveal Wrapper ─────────────────────────────────────────
function RevealSection({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.7, ease: 'easeOut', delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── Agent Dashboard Row ────────────────────────────────────────────
function AgentRow({
  name,
  task,
  status,
  progress,
  tokens,
  delay,
}: {
  name: string
  task: string
  status: 'running' | 'waiting' | 'completed'
  progress: number
  tokens: string
  delay: number
}) {
  const statusColors = {
    running: 'bg-[#00ff88]',
    waiting: 'bg-yellow-400',
    completed: 'bg-blue-400',
  }
  const statusLabels = {
    running: 'RUNNING',
    waiting: 'QUEUED',
    completed: 'DONE',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="flex items-center gap-3 py-2.5 px-3 border-b border-[#1a1a1a] last:border-b-0 hover:bg-[#0f0f0f] transition-colors"
    >
      <div className={`w-2 h-2 rounded-full ${statusColors[status]} ${status === 'running' ? 'dot-pulse' : ''}`} />
      <span className="text-[#00ff88] w-28 text-xs truncate">{name}</span>
      <span className="text-[#666] text-xs flex-1 truncate">{task}</span>
      <div className="w-32 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background:
              status === 'completed'
                ? '#60a5fa'
                : status === 'waiting'
                ? '#fbbf24'
                : '#00ff88',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ delay: delay + 0.3, duration: 2, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[#444] text-xs w-16 text-right">{tokens}</span>
      <span
        className={`text-xs w-16 text-right ${
          status === 'running'
            ? 'text-[#00ff88]'
            : status === 'waiting'
            ? 'text-yellow-400'
            : 'text-blue-400'
        }`}
      >
        {statusLabels[status]}
      </span>
    </motion.div>
  )
}

// ─── Feature Card ───────────────────────────────────────────────────
function FeatureCard({
  tab,
  title,
  description,
  code,
  icon: Icon,
  delay,
}: {
  tab: string
  title: string
  description: string
  code: string
  icon: React.ElementType
  delay: number
}) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-40px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, delay }}
      className="bg-[#111111] border border-[#222] rounded-lg overflow-hidden hover:border-[#333] transition-all duration-300 glow-border-hover group"
    >
      {/* Tab header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#0d0d0d] border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2 px-3 py-1 bg-[#161616] rounded-t border-t border-x border-[#272727] -mb-[1px] relative top-[1px]">
          <Icon className="w-3 h-3 text-[#00ff88]" />
          <span className="text-[#888] text-xs font-mono">{tab}</span>
        </div>
        <div className="flex-1" />
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#333]" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#333]" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#333]" />
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="text-white font-mono text-base mb-2 group-hover:text-[#00ff88] transition-colors">
          {title}
        </h3>
        <p className="text-[#666] font-mono text-xs leading-relaxed mb-4">
          {description}
        </p>

        {/* Code block */}
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded p-3 font-mono text-xs">
          <pre className="text-[#00ff88] whitespace-pre-wrap opacity-80">
            {code}
          </pre>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Integration Badge ──────────────────────────────────────────────
function IntegrationBadge({
  name,
  color,
  description,
  delay,
}: {
  name: string
  color: string
  description: string
  delay: number
}) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-30px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -30 }}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
      transition={{ duration: 0.5, delay }}
      className="flex flex-col items-center gap-2 min-w-[140px]"
    >
      <span
        className="font-mono text-sm px-4 py-2 rounded border transition-all duration-300 hover:scale-105 cursor-default"
        style={{
          color,
          borderColor: color + '44',
          backgroundColor: color + '10',
          textShadow: `0 0 15px ${color}55`,
        }}
      >
        [{name}]
      </span>
      <span className="text-[#555] font-mono text-xs text-center">
        {description}
      </span>
    </motion.div>
  )
}

// ─── Screenshot Frame ───────────────────────────────────────────────
function ScreenshotFrame({
  src,
  alt,
  delay,
}: {
  src: string
  alt: string
  delay: number
}) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.8, delay }}
      className="rounded-lg border border-[#222] overflow-hidden glow-border-hover transition-all duration-500 group"
    >
      <div className="flex items-center gap-2 px-4 py-2 bg-[#111] border-b border-[#222]">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-[#444] text-xs font-mono ml-2">{alt}</span>
      </div>
      <div className="relative overflow-hidden">
        <img
          src={src}
          alt={alt}
          className="w-full h-auto block transition-transform duration-700 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 border border-[#00ff8800] group-hover:border-[#00ff8833] transition-colors duration-500" />
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// ═══  MAIN PAGE  ═══════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════

export default function Home() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Hero terminal lines
  const terminalLines = [
    { text: '$ claude-mgr start', color: '#ccc' },
    { text: '⚡ Spawning 5 agents...', color: '#fbbf24' },
    { text: '✓ Agent "frontend"  — working on /app/dashboard', color: '#00ff88' },
    { text: '✓ Agent "backend"   — reviewing PR #142', color: '#00ff88' },
    { text: '✓ Agent "jira-bot"  — processing PROJ-456', color: '#00ff88' },
    { text: '✓ Agent "reviewer"  — analyzing codebase', color: '#00ff88' },
    { text: '✓ Agent "docs"      — updating README', color: '#00ff88' },
    {
      text: '█ All agents running. Dashboard → http://localhost:3000',
      color: '#60a5fa',
    },
  ]
  const visibleLines = useTypingLines(terminalLines, 500, 1200)

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cursorStyles }} />

      {/* Scanline overlay */}
      <div className="scanline-overlay" />

      <div className="min-h-screen bg-[#0c0c0c] text-white font-mono selection:bg-[#00ff88] selection:text-black">
        {/* ─── 1. NAVIGATION ─────────────────────────────────────── */}
        <nav
          className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
            scrolled
              ? 'bg-[#0c0c0c]/90 backdrop-blur-md border-b border-[#1a1a1a]'
              : 'bg-transparent'
          }`}
        >
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            {/* Logo */}
            <a href="#" className="flex items-center gap-0.5 group">
              <span className="text-[#555] text-lg">&gt; </span>
              <span className="text-[#00ff88] text-lg font-bold glow-text-subtle group-hover:glow-text transition-all">
                claude.mgr
              </span>
              <span className="text-[#00ff88] ml-0.5 blink text-lg">_</span>
            </a>

            {/* Nav links */}
            <div className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-[#666] text-sm hover:text-[#00ff88] transition-colors"
              >
                features
              </a>
              <a
                href="#integrations"
                className="text-[#666] text-sm hover:text-[#00ff88] transition-colors"
              >
                integrations
              </a>
              <a
                href="https://claude-mgr.com/docs"
                className="text-[#666] text-sm hover:text-[#00ff88] transition-colors"
              >
                docs
              </a>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/nichochar/claude-manager"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-[#666] hover:text-white border border-[#333] rounded-md hover:border-[#555] transition-all"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="/api/download?platform=mac"
                className="flex items-center gap-2 px-4 py-2 bg-[#00ff88] text-black text-sm font-bold rounded-md neon-btn hover:bg-[#33ffaa] transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download .dmg</span>
                <span className="sm:hidden">Get</span>
              </a>
            </div>
          </div>
        </nav>

        {/* ─── 2. HERO SECTION ───────────────────────────────────── */}
        <section className="pt-28 pb-16 px-6">
          <div className="max-w-4xl mx-auto">
            {/* Terminal window */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <TerminalFrame title="claude.mgr — zsh" className="glow-border">
                <div className="space-y-1">
                  {terminalLines.map((line, i) => (
                    <div key={i} className="min-h-[1.5em]">
                      <AnimatePresence>
                        {i < visibleLines && (
                          <motion.div
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3 }}
                            style={{ color: line.color }}
                            className="text-sm"
                          >
                            {line.text}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                  {visibleLines >= terminalLines.length && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-[#555] text-sm mt-2"
                    >
                      $ <span className="blink">_</span>
                    </motion.div>
                  )}
                </div>
              </TerminalFrame>
            </motion.div>

            {/* Heading */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="text-center mt-14"
            >
              <h1 className="text-5xl md:text-7xl font-bold text-white glow-text mb-5 leading-tight tracking-tight">
                Run your AI army.
              </h1>
              <p className="text-[#666] text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-8">
                Orchestrate 10+ Claude Code agents in parallel. Automate
                everything.{' '}
                <span className="text-[#888]">
                  Built for developers who ship fast.
                </span>
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <a
                  href="/api/download?platform=mac"
                  className="flex items-center gap-2 px-6 py-3 bg-[#00ff88] text-black font-bold rounded-md neon-btn hover:bg-[#33ffaa] transition-all text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download for macOS
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="https://github.com/nichochar/claude-manager"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-3 border border-[#333] text-[#888] rounded-md hover:border-[#00ff88] hover:text-[#00ff88] transition-all text-sm"
                >
                  <Github className="w-4 h-4" />
                  Star on GitHub
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ─── 3. STATS BAR ──────────────────────────────────────── */}
        <RevealSection className="px-6 py-8">
          <div className="max-w-5xl mx-auto">
            <div className="border border-[#00ff8833] rounded-lg bg-[#0a0a0a] px-6 py-4 glow-border">
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
                {[
                  '10+ parallel agents',
                  '30+ MCP tools',
                  '5 integrations',
                  '$0 cost',
                  '100% open source',
                ].map((stat, i, arr) => (
                  <span key={i} className="flex items-center gap-3">
                    <span className="text-[#00ff88] glow-text-subtle">
                      {stat}
                    </span>
                    {i < arr.length - 1 && (
                      <span className="text-[#333] hidden sm:inline">|</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </RevealSection>

        {/* ─── 4. FEATURES GRID ──────────────────────────────────── */}
        <section id="features" className="px-6 py-20">
          <div className="max-w-6xl mx-auto">
            <RevealSection>
              <div className="mb-12">
                <span className="text-[#444] text-sm">
                  {'// capabilities'}
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">
                  Everything you need to{' '}
                  <span className="text-[#00ff88] glow-text-subtle">
                    ship faster
                  </span>
                </h2>
              </div>
            </RevealSection>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <FeatureCard
                tab="agents.ts"
                title="Parallel Agents"
                description="Run 10+ Claude Code agents simultaneously, each working on different tasks across your codebase."
                code={`┌──agent-1──┐  ┌──agent-2──┐
│ ● ● ● ●→ │  │ ● ● ● ●→ │
└───────────┘  └───────────┘
┌──agent-3──┐  ┌──agent-4──┐
│ ● ● ● ●→ │  │ ● ● ● ●→ │
└───────────┘  └───────────┘`}
                icon={Cpu}
                delay={0}
              />
              <FeatureCard
                tab="super-agent.ts"
                title="Super Agent"
                description="An orchestrator agent that breaks down complex tasks and delegates work to specialized sub-agents."
                code={`const super = new SuperAgent();

super.delegate("Review PR #42");
super.delegate("Fix failing tests");
super.delegate("Update docs");

// → spawns 3 agents automatically`}
                icon={Zap}
                delay={0.1}
              />
              <FeatureCard
                tab="automations.ts"
                title="Automations"
                description="Poll JIRA, GitHub, or any source. Filter issues, auto-assign agents, and post results to Slack or Telegram."
                code={`pipeline:
  source: "jira"
  filter: priority >= "high"
  agent:  "bug-fixer"
  output: ["telegram", "slack"]

// runs every 5 minutes`}
                icon={GitBranch}
                delay={0.2}
              />
              <FeatureCard
                tab="mcp-server.ts"
                title="MCP Protocol"
                description="30+ built-in tools exposed via MCP servers for full programmatic control of all your agents."
                code={`tools.list_agents()
tools.create_agent({ name, task })
tools.start_agent(id)
tools.get_status(id)
tools.send_message(id, prompt)
tools.kill_agent(id)
// ...24 more tools`}
                icon={Layers}
                delay={0.3}
              />
              <FeatureCard
                tab="remote.ts"
                title="Remote Control"
                description="Control your agents from anywhere via Telegram or Slack bots. Full bidirectional communication."
                code={`> /status
  5 agents running, 2 queued

> /start_agent reviewer PR#88
  ✓ Agent "reviewer" started

> /ask frontend "ETA?"
  → ~12 minutes remaining`}
                icon={MessageSquare}
                delay={0.4}
              />
              <FeatureCard
                tab="kanban.ts"
                title="Kanban Board"
                description="Visual kanban board with automatic agent assignment. Drag tasks, agents pick them up automatically."
                code={`[Backlog]  →  [Planned]
   3 tasks      2 tasks
             ↓
          [Ongoing]  →  [Done]
           4 agents      12 tasks
             ↑
        auto-assigned`}
                icon={BarChart3}
                delay={0.5}
              />
            </div>
          </div>
        </section>

        {/* ─── 5. INTEGRATIONS ───────────────────────────────────── */}
        <section id="integrations" className="px-6 py-20">
          <div className="max-w-5xl mx-auto">
            <RevealSection>
              <div className="mb-12">
                <span className="text-[#444] text-sm">
                  {'// integrations.connect()'}
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">
                  Connects to your{' '}
                  <span className="text-[#00ff88] glow-text-subtle">
                    workflow
                  </span>
                </h2>
              </div>
            </RevealSection>

            <div className="flex flex-wrap items-start justify-center gap-8 md:gap-12">
              <IntegrationBadge
                name="JIRA"
                color="#2684FF"
                description="Auto-poll issues & sync"
                delay={0}
              />
              <IntegrationBadge
                name="GitHub"
                color="#e6edf3"
                description="PRs, issues & actions"
                delay={0.1}
              />
              <IntegrationBadge
                name="Telegram"
                color="#229ED9"
                description="Remote bot control"
                delay={0.2}
              />
              <IntegrationBadge
                name="Slack"
                color="#E01E5A"
                description="Alerts & commands"
                delay={0.3}
              />
              <IntegrationBadge
                name="skills.sh"
                color="#FF8C00"
                description="Plugin marketplace"
                delay={0.4}
              />
            </div>
          </div>
        </section>

        {/* ─── 6. LIVE DEMO — AGENT DASHBOARD MOCK ───────────────── */}
        <section className="px-6 py-20">
          <div className="max-w-5xl mx-auto">
            <RevealSection>
              <div className="mb-8">
                <span className="text-[#444] text-sm">
                  {'// live_preview.render()'}
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">
                  See it in{' '}
                  <span className="text-[#00ff88] glow-text-subtle">
                    action
                  </span>
                </h2>
              </div>
            </RevealSection>

            <RevealSection delay={0.2}>
              <div className="rounded-lg border border-[#222] bg-[#0a0a0a] overflow-hidden glow-border">
                {/* Dashboard top bar */}
                <div className="flex items-center justify-between px-5 py-3 bg-[#111] border-b border-[#1a1a1a]">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                    </div>
                    <span className="text-[#555] text-xs">
                      claude.mgr v0.0.16
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#00ff88] dot-pulse" />
                    <span className="text-[#00ff88] text-xs">Connected</span>
                  </div>
                </div>

                {/* Column headers */}
                <div className="flex items-center gap-3 px-5 py-2 border-b border-[#1a1a1a] text-[#444] text-xs">
                  <span className="w-2" />
                  <span className="w-28">AGENT</span>
                  <span className="flex-1">TASK</span>
                  <span className="w-32 text-center">PROGRESS</span>
                  <span className="w-16 text-right">TOKENS</span>
                  <span className="w-16 text-right">STATUS</span>
                </div>

                {/* Agent rows */}
                <div className="px-2">
                  <AgentRow
                    name="frontend"
                    task="Refactoring dashboard components to use new design system"
                    status="running"
                    progress={72}
                    tokens="14.2k"
                    delay={0.5}
                  />
                  <AgentRow
                    name="backend"
                    task="Reviewing PR #142 — Auth middleware refactor"
                    status="running"
                    progress={45}
                    tokens="8.7k"
                    delay={0.7}
                  />
                  <AgentRow
                    name="jira-bot"
                    task="Processing PROJ-456 — High priority bug fix"
                    status="running"
                    progress={88}
                    tokens="21.3k"
                    delay={0.9}
                  />
                  <AgentRow
                    name="reviewer"
                    task="Static analysis on /src/lib/auth.ts"
                    status="waiting"
                    progress={12}
                    tokens="2.1k"
                    delay={1.1}
                  />
                  <AgentRow
                    name="docs"
                    task="Updated API reference — 14 endpoints documented"
                    status="completed"
                    progress={100}
                    tokens="31.5k"
                    delay={1.3}
                  />
                  <AgentRow
                    name="test-runner"
                    task="Running integration test suite for payments module"
                    status="running"
                    progress={33}
                    tokens="5.8k"
                    delay={1.5}
                  />
                </div>

                {/* Bottom status bar */}
                <div className="flex items-center justify-between px-5 py-2.5 bg-[#0d0d0d] border-t border-[#1a1a1a] text-xs">
                  <div className="flex items-center gap-4">
                    <span className="text-[#00ff88]">4 running</span>
                    <span className="text-yellow-400">1 queued</span>
                    <span className="text-blue-400">1 completed</span>
                  </div>
                  <div className="text-[#444]">
                    Total tokens: 83.6k | Session: 24m 13s
                  </div>
                </div>
              </div>
            </RevealSection>
          </div>
        </section>

        {/* ─── 7. SCREENSHOTS ────────────────────────────────────── */}
        <section className="px-6 py-20">
          <div className="max-w-5xl mx-auto">
            <RevealSection>
              <div className="mb-12">
                <span className="text-[#444] text-sm">
                  {'// screenshots.render()'}
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">
                  Built for{' '}
                  <span className="text-[#00ff88] glow-text-subtle">
                    power users
                  </span>
                </h2>
              </div>
            </RevealSection>

            <div className="space-y-8">
              <ScreenshotFrame
                src="/0.png"
                alt="claude.mgr — Agent Dashboard"
                delay={0}
              />
              <ScreenshotFrame
                src="/super-agent.png"
                alt="claude.mgr — Super Agent Orchestrator"
                delay={0.15}
              />
              <ScreenshotFrame
                src="/agetns.png"
                alt="claude.mgr — Multi-Agent View"
                delay={0.3}
              />
            </div>
          </div>
        </section>

        {/* ─── 8. DOWNLOAD CTA ───────────────────────────────────── */}
        <section className="px-6 py-24">
          <div className="max-w-3xl mx-auto">
            <RevealSection>
              <div className="border border-[#00ff8833] rounded-lg bg-[#0a0a0a] overflow-hidden glow-border">
                {/* Terminal header */}
                <div className="flex items-center gap-2 px-5 py-3 bg-[#111] border-b border-[#1a1a1a]">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                  </div>
                  <span className="text-[#555] text-xs ml-2">
                    install — zsh
                  </span>
                </div>

                {/* Terminal body */}
                <div className="p-6 md:p-8">
                  <div className="font-mono text-sm space-y-2 mb-8">
                    <p className="text-[#888]">
                      <span className="text-[#00ff88]">$</span> brew install
                      --cask claude-mgr
                    </p>
                    <p className="text-[#444] mt-4"># or download directly</p>
                    <p className="text-[#888]">
                      <span className="text-[#00ff88]">$</span> curl -L
                      https://claude-mgr.com/download | sh
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                    <a
                      href="/api/download?platform=mac"
                      className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 bg-[#00ff88] text-black font-bold rounded-md neon-btn hover:bg-[#33ffaa] transition-all text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Download for macOS
                      <ArrowRight className="w-4 h-4" />
                    </a>
                    <a
                      href="https://github.com/nichochar/claude-manager"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 border border-[#333] text-[#888] rounded-md hover:border-[#00ff88] hover:text-[#00ff88] transition-all text-sm"
                    >
                      <Github className="w-4 h-4" />
                      View Source
                    </a>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[#444] text-xs">
                      After download, you may need to run:{' '}
                      <span className="text-[#666]">
                        xattr -cr /Applications/claude.mgr.app
                      </span>
                    </p>
                    <p className="text-[#00ff8866] text-xs">
                      {'// free. open-source. no account required.'}
                    </p>
                  </div>
                </div>
              </div>
            </RevealSection>
          </div>
        </section>

        {/* ─── More Features Section ─────────────────────────────── */}
        <section className="px-6 py-16">
          <div className="max-w-5xl mx-auto">
            <RevealSection>
              <div className="mb-12">
                <span className="text-[#444] text-sm">
                  {'// and_more.list()'}
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">
                  Plus{' '}
                  <span className="text-[#00ff88] glow-text-subtle">
                    everything else
                  </span>
                </h2>
              </div>
            </RevealSection>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  icon: BarChart3,
                  title: 'Usage Analytics',
                  desc: 'Track tokens, costs, and agent performance across all sessions.',
                },
                {
                  icon: CircleDot,
                  title: '3D Visualization',
                  desc: 'Interactive 3D view of your agents and their relationships.',
                },
                {
                  icon: GitBranch,
                  title: 'Git Worktrees',
                  desc: 'Each agent gets its own worktree — no merge conflicts.',
                },
                {
                  icon: Bot,
                  title: 'Persistent Memory',
                  desc: 'Agents remember context across sessions via claude-mem.',
                },
                {
                  icon: Layers,
                  title: 'Skills & Plugins',
                  desc: 'Extend agents with skills from skills.sh marketplace.',
                },
                {
                  icon: Terminal,
                  title: 'CLI First',
                  desc: 'Full CLI interface for headless and scripted workflows.',
                },
                {
                  icon: Clock,
                  title: 'Scheduling',
                  desc: 'Cron-based task scheduling for recurring agent jobs.',
                },
                {
                  icon: Check,
                  title: 'Zero Config',
                  desc: 'Works out of the box. Just install and start spawning.',
                },
              ].map((item, i) => (
                <RevealSection key={i} delay={i * 0.05}>
                  <div className="bg-[#111] border border-[#1a1a1a] rounded-lg p-5 hover:border-[#333] transition-all group h-full">
                    <item.icon className="w-5 h-5 text-[#00ff88] mb-3 group-hover:glow-text transition-all" />
                    <h3 className="text-white text-sm font-bold mb-1.5">
                      {item.title}
                    </h3>
                    <p className="text-[#555] text-xs leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Architecture Section ──────────────────────────────── */}
        <section className="px-6 py-16">
          <div className="max-w-4xl mx-auto">
            <RevealSection>
              <div className="mb-8">
                <span className="text-[#444] text-sm">
                  {'// architecture.diagram()'}
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-white mt-2">
                  How it{' '}
                  <span className="text-[#00ff88] glow-text-subtle">
                    works
                  </span>
                </h2>
              </div>
            </RevealSection>

            <RevealSection delay={0.15}>
              <TerminalFrame title="architecture.txt" className="glow-border">
                <pre className="text-xs md:text-sm leading-relaxed">
                  <span className="text-[#666]">{'  ┌───────────────────────────────────────────┐\n'}</span>
                  <span className="text-[#666]">{'  │'}</span>
                  <span className="text-[#00ff88]">{'          claude.mgr (Electron)           '}</span>
                  <span className="text-[#666]">{'│\n'}</span>
                  <span className="text-[#666]">{'  │                                           │\n'}</span>
                  <span className="text-[#666]">{'  │  ┌─────────┐  ┌──────────┐  ┌─────────┐  │\n'}</span>
                  <span className="text-[#666]">{'  │  │'}</span>
                  <span className="text-yellow-400">{' Dashboard'}</span>
                  <span className="text-[#666]">{'│  │'}</span>
                  <span className="text-yellow-400">{'  Kanban  '}</span>
                  <span className="text-[#666]">{'│  │'}</span>
                  <span className="text-yellow-400">{' Analytics'}</span>
                  <span className="text-[#666]">{'│  │\n'}</span>
                  <span className="text-[#666]">{'  │  └────┬────┘  └────┬─────┘  └────┬────┘  │\n'}</span>
                  <span className="text-[#666]">{'  │       └───────────┬┘──────────────┘       │\n'}</span>
                  <span className="text-[#666]">{'  │            ┌─────┴──────┐                 │\n'}</span>
                  <span className="text-[#666]">{'  │            │'}</span>
                  <span className="text-[#00ff88]">{' MCP Server '}</span>
                  <span className="text-[#666]">{'│                 │\n'}</span>
                  <span className="text-[#666]">{'  │            │'}</span>
                  <span className="text-[#555]">{' 30+ tools  '}</span>
                  <span className="text-[#666]">{'│                 │\n'}</span>
                  <span className="text-[#666]">{'  │            └─────┬──────┘                 │\n'}</span>
                  <span className="text-[#666]">{'  │    ┌─────────┬───┴───┬─────────┐          │\n'}</span>
                  <span className="text-[#666]">{'  │    ▼         ▼       ▼         ▼          │\n'}</span>
                  <span className="text-[#666]">{'  │ '}</span>
                  <span className="text-blue-400">{'Agent 1'}</span>
                  <span className="text-[#666]">{'  '}</span>
                  <span className="text-blue-400">{'Agent 2'}</span>
                  <span className="text-[#666]">{'  '}</span>
                  <span className="text-blue-400">{'Agent 3'}</span>
                  <span className="text-[#666]">{'  '}</span>
                  <span className="text-blue-400">{'Agent N'}</span>
                  <span className="text-[#666]">{'       │\n'}</span>
                  <span className="text-[#666]">{'  │ '}</span>
                  <span className="text-[#555]">{'(clone)  (clone)  (clone)  (clone)'}</span>
                  <span className="text-[#666]">{'       │\n'}</span>
                  <span className="text-[#666]">{'  └───────────────────────────────────────────┘\n'}</span>
                  <span className="text-[#666]">{'           │         │       │         │\n'}</span>
                  <span className="text-[#666]">{'           ▼         ▼       ▼         ▼\n'}</span>
                  <span className="text-[#555]">{'       worktree  worktree worktree  worktree\n'}</span>
                </pre>
              </TerminalFrame>
            </RevealSection>
          </div>
        </section>

        {/* ─── 9. FOOTER ─────────────────────────────────────────── */}
        <footer className="px-6 py-12 border-t border-[#1a1a1a]">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <span className="text-[#333] text-sm">
                  {'// built with <3 by developers, for developers'}
                </span>
              </div>
              <div className="flex items-center gap-6">
                <a
                  href="https://github.com/nichochar/claude-manager"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#444] hover:text-[#00ff88] transition-colors flex items-center gap-2 text-sm"
                >
                  <Github className="w-4 h-4" />
                  GitHub
                </a>
                <a
                  href="https://claude-mgr.com/docs"
                  className="text-[#444] hover:text-[#00ff88] transition-colors text-sm"
                >
                  Docs
                </a>
                <span className="text-[#333] text-xs">v0.0.16</span>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-[#111] text-center">
              <p className="text-[#333] text-xs">
                <span className="text-[#00ff8844]">&gt;</span> claude.mgr is
                free and open-source software.{' '}
                <a
                  href="https://github.com/nichochar/claude-manager/blob/main/LICENSE"
                  className="text-[#444] hover:text-[#00ff88] transition-colors underline underline-offset-2"
                >
                  MIT License
                </a>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
