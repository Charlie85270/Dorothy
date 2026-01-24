'use client';

import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Sparkles,
  Terminal,
  BarChart2,
  Zap,
  GitBranch,
  Layers,
  Shield,
  ArrowRight,
  Github,
  Star,
  Download,
  MessageSquare,
  FolderKanban,
  Settings,
  ChevronDown,
  Play,
  Check,
} from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import Image from 'next/image';

// Floating orb component
function FloatingOrb({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 1 }}
      className={`absolute rounded-full blur-3xl ${className}`}
    />
  );
}

// Animated counter
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
    >
      <motion.span
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        {value}{suffix}
      </motion.span>
    </motion.span>
  );
}

// Feature card
function FeatureCard({
  icon: Icon,
  title,
  description,
  gradient,
  delay = 0,
}: {
  icon: typeof Bot;
  title: string;
  description: string;
  gradient: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="group relative p-6 rounded-2xl bg-[#12121a] border border-[#27272a] hover:border-[#22d3ee]/30 transition-all duration-300"
    >
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-semibold mb-2 text-[#f5f5f7]">{title}</h3>
      <p className="text-[#a1a1aa] text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}

// Navigation
function Navigation() {
  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-[#27272a]"
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#22d3ee] to-[#60a5fa] flex items-center justify-center glow-cyan">
            <Bot className="w-5 h-5 text-[#0a0a0f]" />
          </div>
          <span className="font-bold text-lg">
            <span className="text-[#f5f5f7]">CLAUDE</span>
            <span className="text-[#22d3ee]">.MGR</span>
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-[#a1a1aa] hover:text-[#f5f5f7] transition-colors text-sm">Features</a>
          <a href="#how-it-works" className="text-[#a1a1aa] hover:text-[#f5f5f7] transition-colors text-sm">How it Works</a>
          <a href="#demo" className="text-[#a1a1aa] hover:text-[#f5f5f7] transition-colors text-sm">Demo</a>
        </div>

        <div className="flex items-center gap-4">
          <a
            href="https://github.com/Charlie85270/claude-mgr"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1a24] border border-[#27272a] hover:border-[#22d3ee]/50 transition-all text-sm"
          >
            <Github className="w-4 h-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          <a
            href="#download"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#22d3ee] to-[#60a5fa] text-[#0a0a0f] font-medium hover:opacity-90 transition-opacity text-sm"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </a>
        </div>
      </div>
    </motion.nav>
  );
}

// Hero Section
function HeroSection() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section ref={ref} className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background effects */}
      <div className="absolute inset-0 grid-bg" />
      <FloatingOrb className="w-[600px] h-[600px] bg-[#22d3ee]/20 -top-40 -left-40" delay={0.2} />
      <FloatingOrb className="w-[500px] h-[500px] bg-[#a78bfa]/20 -bottom-40 -right-40" delay={0.4} />
      <FloatingOrb className="w-[300px] h-[300px] bg-[#60a5fa]/20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" delay={0.6} />

      <motion.div style={{ y, opacity }} className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1a1a24] border border-[#27272a] mb-8"
        >
          <Sparkles className="w-4 h-4 text-[#22d3ee]" />
          <span className="text-sm text-[#a1a1aa]">Your AI Agent Command Center</span>
        </motion.div>

        {/* Main heading */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
        >
          <span className="text-[#f5f5f7]">Manage Your</span>
          <br />
          <span className="gradient-text">Claude Agents</span>
          <br />
          <span className="text-[#f5f5f7]">Like Never Before</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-lg md:text-xl text-[#a1a1aa] mb-10 max-w-2xl mx-auto leading-relaxed"
        >
          A beautiful desktop application to orchestrate, monitor, and supercharge
          your Claude Code agents with a stunning 3D interface.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="/api/download?platform=mac"
            className="group flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-[#22d3ee] to-[#60a5fa] text-[#0a0a0f] font-semibold text-lg hover:opacity-90 transition-all shine-effect"
          >
            <Download className="w-5 h-5" />
            Download for Mac
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </a>
          <a
            href="#demo"
            className="flex items-center gap-3 px-8 py-4 rounded-xl bg-[#1a1a24] border border-[#27272a] hover:border-[#22d3ee]/50 transition-all text-lg"
          >
            <Play className="w-5 h-5 text-[#22d3ee]" />
            Watch Demo
          </a>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex items-center justify-center gap-8 md:gap-16 mt-16 pt-8 border-t border-[#27272a]"
        >
          <div className="text-center">
            <div className="text-3xl font-bold text-[#22d3ee]"><AnimatedNumber value={100} suffix="%" /></div>
            <div className="text-sm text-[#71717a]">Open Source</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[#a78bfa]"><AnimatedNumber value={3} suffix="D" /></div>
            <div className="text-sm text-[#71717a]">Interface</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[#60a5fa]"><AnimatedNumber value={0} suffix="$" /></div>
            <div className="text-sm text-[#71717a]">Forever Free</div>
          </div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <ChevronDown className="w-6 h-6 text-[#71717a]" />
        </motion.div>
      </motion.div>
    </section>
  );
}

// Features Section
function FeaturesSection() {
  const features = [
    {
      icon: Bot,
      title: "Multi-Agent Management",
      description: "Create, monitor, and control multiple Claude agents simultaneously. Each agent runs in its own isolated environment.",
      gradient: "from-[#22d3ee] to-[#60a5fa]",
    },
    {
      icon: Layers,
      title: "3D Visual Interface",
      description: "Experience your agents in a beautiful 3D office environment. Watch them work in real-time with animated characters.",
      gradient: "from-[#a78bfa] to-[#f472b6]",
    },
    {
      icon: GitBranch,
      title: "Git Worktree Integration",
      description: "Each agent can work in its own git branch using worktrees. Parallel development without conflicts.",
      gradient: "from-[#4ade80] to-[#22d3ee]",
    },
    {
      icon: Sparkles,
      title: "Skills Management",
      description: "Install, manage, and assign skills to your agents. Extend their capabilities with custom plugins.",
      gradient: "from-[#f59e0b] to-[#ef4444]",
    },
    {
      icon: BarChart2,
      title: "Usage Analytics",
      description: "Track token usage, costs, and productivity metrics. Visualize your usage patterns over time.",
      gradient: "from-[#60a5fa] to-[#a78bfa]",
    },
    {
      icon: Terminal,
      title: "Full Terminal Access",
      description: "Interactive terminal for each agent. Send commands, review outputs, and debug in real-time.",
      gradient: "from-[#22d3ee] to-[#4ade80]",
    },
  ];

  return (
    <section id="features" className="relative py-32 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-[#22d3ee] text-sm font-medium uppercase tracking-wider">Features</span>
          <h2 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
            <span className="text-[#f5f5f7]">Everything You Need to</span>
            <br />
            <span className="gradient-text">Master Your Agents</span>
          </h2>
          <p className="text-[#a1a1aa] text-lg max-w-2xl mx-auto">
            Powerful features designed to make managing Claude Code agents
            intuitive, visual, and incredibly productive.
          </p>
        </motion.div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} {...feature} delay={index * 0.1} />
          ))}
        </div>
      </div>
    </section>
  );
}

// How it Works Section
function HowItWorksSection() {
  const steps = [
    {
      step: "01",
      title: "Download & Install",
      description: "Download the app for your platform and install it in seconds. No complex setup required.",
      icon: Download,
    },
    {
      step: "02",
      title: "Create Agents",
      description: "Spawn new agents with custom configurations. Assign skills, set up worktrees, and choose their character.",
      icon: Bot,
    },
    {
      step: "03",
      title: "Give Instructions",
      description: "Send prompts to your agents and watch them work. They'll execute tasks autonomously.",
      icon: MessageSquare,
    },
    {
      step: "04",
      title: "Monitor & Control",
      description: "Track progress in the 3D view, review outputs, and manage multiple agents from one dashboard.",
      icon: Settings,
    },
  ];

  return (
    <section id="how-it-works" className="relative py-32 px-6 bg-[#0d0d12]">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-[#a78bfa] text-sm font-medium uppercase tracking-wider">How it Works</span>
          <h2 className="text-4xl md:text-5xl font-bold mt-4 mb-6 text-[#f5f5f7]">
            Get Started in Minutes
          </h2>
          <p className="text-[#a1a1aa] text-lg max-w-2xl mx-auto">
            From download to your first agent, it takes less than 5 minutes.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="relative"
            >
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-1/2 w-full h-px bg-gradient-to-r from-[#27272a] to-transparent" />
              )}

              <div className="relative z-10 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1a1a24] to-[#12121a] border border-[#27272a] mb-6">
                  <item.icon className="w-7 h-7 text-[#22d3ee]" />
                </div>
                <div className="text-[#22d3ee] text-sm font-mono mb-2">{item.step}</div>
                <h3 className="text-xl font-semibold mb-3 text-[#f5f5f7]">{item.title}</h3>
                <p className="text-[#a1a1aa] text-sm leading-relaxed">{item.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Screenshot data
const screenshots = [
  {
    id: '3d',
    src: '/3d.png',
    title: '3D Agent View',
    description: 'Watch your agents work in a beautiful 3D office environment with animated characters',
    gradient: 'from-[#22d3ee] to-[#60a5fa]',
    icon: Layers,
    tags: ['Real-time', 'Interactive', 'Immersive'],
  },
  {
    id: 'agents',
    src: '/agetns.png',
    title: 'Agent Management',
    description: 'Create, configure, and control multiple agents simultaneously with full terminal access',
    gradient: 'from-[#a78bfa] to-[#f472b6]',
    icon: Bot,
    tags: ['Multi-agent', 'Terminal', 'Git Worktree'],
  },
  {
    id: 'stats',
    src: '/stats.png',
    title: 'Usage Analytics',
    description: 'Track token usage, costs, and productivity metrics with detailed visualizations',
    gradient: 'from-[#4ade80] to-[#22d3ee]',
    icon: BarChart2,
    tags: ['Tokens', 'Costs', 'Insights'],
  },
  {
    id: 'skills',
    src: '/skills.png',
    title: 'Skills & Plugins',
    description: 'Directly integrated with skills.sh — the most popular skills library for AI agents. Install and manage hundreds of community skills with one click.',
    gradient: 'from-[#f59e0b] to-[#ef4444]',
    icon: Sparkles,
    tags: ['skills.sh', 'One-click install', 'Community'],
    link: { url: 'https://skills.sh', label: 'Visit skills.sh →' },
  },
];

// Screenshot type
interface Screenshot {
  id: string;
  src: string;
  title: string;
  description: string;
  gradient: string;
  icon: typeof Bot;
  tags: string[];
  link?: { url: string; label: string };
}

// Individual scroll-animated screenshot component
function ScrollScreenshot({
  screenshot,
  index,
}: {
  screenshot: Screenshot;
  index: number;
}) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  // Parallax effect for image
  const imageY = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const imageScale = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.9, 1, 1, 0.9]);
  const imageOpacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);

  // Text animations
  const textY = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [30, 0, 0, -30]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  // Glow animation
  const glowOpacity = useTransform(scrollYProgress, [0.2, 0.5, 0.8], [0, 0.5, 0]);

  const isEven = index % 2 === 0;
  const Icon = screenshot.icon;

  return (
    <div ref={ref} className="min-h-[80vh] flex items-center py-10">
      <div className={`w-full max-w-[1400px] mx-auto px-6 grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 items-center ${isEven ? '' : 'lg:flex-row-reverse'
        }`}>
        {/* Text content - smaller column */}
        <motion.div
          style={{ y: textY, opacity: textOpacity }}
          className={`space-y-5 lg:col-span-2 ${isEven ? 'lg:order-1' : 'lg:order-2'}`}
        >
          <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r ${screenshot.gradient} bg-opacity-20`}
            style={{ background: `linear-gradient(135deg, ${screenshot.gradient.includes('22d3ee') ? 'rgba(34, 211, 238, 0.15)' : 'rgba(167, 139, 250, 0.15)'}, transparent)` }}
          >
            <Icon className="w-5 h-5 text-[#f5f5f7]" />
            <span className="text-sm font-medium text-[#f5f5f7]">0{index + 1}</span>
          </div>

          <h3 className="text-3xl md:text-4xl font-bold text-[#f5f5f7]">
            {screenshot.title}
          </h3>

          <p className="text-lg text-[#a1a1aa] leading-relaxed">
            {screenshot.description}
          </p>

          {/* Feature tags */}
          <div className="flex flex-wrap gap-2 pt-2">
            {screenshot.tags.map((tag) => (
              <span
                key={tag}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${tag === 'skills.sh'
                  ? 'bg-[#f59e0b]/20 border-[#f59e0b]/50 text-[#f59e0b]'
                  : 'bg-[#1a1a24] border-[#27272a] text-[#a1a1aa]'
                  }`}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Optional link */}
          {screenshot.link && (
            <a
              href={screenshot.link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[#f59e0b] hover:text-[#fbbf24] transition-colors text-sm font-medium pt-2"
            >
              {screenshot.link.label}
            </a>
          )}
        </motion.div>

        {/* Screenshot - larger column */}
        <motion.div
          style={{ y: imageY, scale: imageScale, opacity: imageOpacity }}
          className={`relative lg:col-span-3 ${isEven ? 'lg:order-2' : 'lg:order-1'}`}
        >
          {/* Browser frame */}
          <div className="rounded-2xl overflow-hidden border border-[#27272a] bg-[#12121a] shadow-2xl shadow-black/50">
            {/* Title bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a24] border-b border-[#27272a]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                <div className="w-3 h-3 rounded-full bg-[#4ade80]" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs text-[#71717a]">{screenshot.title}</span>
              </div>
            </div>

            {/* Image */}
            <div className="overflow-hidden bg-[#0a0a0f]">
              <img
                src={screenshot.src}
                alt={screenshot.title}
                className="w-full h-auto object-cover object-top"
              />
            </div>
          </div>

          {/* Glow effect */}
          <motion.div
            style={{ opacity: glowOpacity }}
            className={`absolute -inset-6 blur-3xl -z-10 bg-gradient-to-r ${screenshot.gradient}`}
          />

          {/* Floating accent */}
          <motion.div
            animate={{ y: [-8, 8, -8], rotate: [-3, 3, -3] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute -top-4 -right-4 w-16 h-16 rounded-xl bg-gradient-to-br ${screenshot.gradient} opacity-60 blur-sm`}
          />
        </motion.div>
      </div>
    </div>
  );
}

// Demo/Screenshot Section with scroll animations
function DemoSection() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Progress bar animation
  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section id="demo" ref={containerRef} className="relative">
      {/* Fixed progress bar */}
      <div className="sticky top-0 z-40 h-1 bg-[#1a1a24]">
        <motion.div
          style={{ width: progressWidth }}
          className="h-full bg-gradient-to-r from-[#22d3ee] via-[#a78bfa] to-[#60a5fa]"
        />
      </div>

      {/* Section header */}
      <div className="pt-20 pb-10 text-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="text-[#4ade80] text-sm font-medium uppercase tracking-wider">Preview</span>
          <h2 className="text-4xl md:text-5xl font-bold mt-4 mb-4 text-[#f5f5f7]">
            See It In Action
          </h2>
          <p className="text-[#a1a1aa] text-lg max-w-2xl mx-auto">
            Scroll to explore the beautiful interface that makes managing agents a joy.
          </p>

          {/* Scroll indicator */}
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="mt-6"
          >
            <ChevronDown className="w-5 h-5 text-[#71717a] mx-auto" />
          </motion.div>
        </motion.div>
      </div>

      {/* Screenshots */}
      <div className="relative">
        {/* Background gradient lines */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-[#22d3ee]/10 to-transparent" />
          <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-[#a78bfa]/10 to-transparent" />
        </div>

        {screenshots.map((screenshot, index) => (
          <ScrollScreenshot key={screenshot.id} screenshot={screenshot} index={index} />
        ))}
      </div>

      {/* End indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="text-center py-16"
      >
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-[#1a1a24] border border-[#27272a]">
          <Check className="w-5 h-5 text-[#4ade80]" />
          <span className="text-[#a1a1aa]">And much more to discover...</span>
        </div>
      </motion.div>
    </section>
  );
}

// Download Section
function DownloadSection() {
  const [downloadCount, setDownloadCount] = useState<number | null>(null);

  useEffect(() => {
    // Fetch download stats
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => setDownloadCount(data.total))
      .catch(() => setDownloadCount(null));
  }, []);

  return (
    <section id="download" className="relative py-32 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-3xl overflow-hidden"
        >
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#22d3ee]/20 via-[#a78bfa]/20 to-[#60a5fa]/20" />
          <div className="absolute inset-0 bg-[#12121a]/90" />

          {/* Content */}
          <div className="relative z-10 p-12 md:p-16 text-center">
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#22d3ee] to-[#60a5fa] flex items-center justify-center mx-auto mb-8 glow-cyan"
            >
              <Bot className="w-10 h-10 text-[#0a0a0f]" />
            </motion.div>

            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-[#f5f5f7]">
              Ready to Get Started?
            </h2>

            <p className="text-[#a1a1aa] text-lg mb-10 max-w-xl mx-auto">
              Download Claude Manager for free and take control of your AI agents today.
            </p>

            {/* Download buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <a
                href="/api/download?platform=mac"
                className="group flex items-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-[#22d3ee] to-[#60a5fa] text-[#0a0a0f] font-semibold text-lg hover:opacity-90 transition-all"
              >
                <Download className="w-5 h-5" />
                Download for macOS
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>

            {/* Download count */}
            {downloadCount !== null && downloadCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
              >
                <span className="text-[#71717a] text-sm">
                  <span className="text-[#22d3ee] font-semibold">{downloadCount.toLocaleString()}</span> downloads
                </span>
              </motion.div>
            )}

            {/* Features list */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#a1a1aa]">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#4ade80]" />
                <span>Free Forever.</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#4ade80]" />
                <span>Open Source.</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#4ade80]" />
                <span>No Account Required.</span>
              </div>
            </div>

            {/* macOS installation note */}
            <div className="mt-8 p-4 rounded-xl bg-[#1a1a24] border border-[#27272a] text-left max-w-lg mx-auto">
              <p className="text-xs text-[#71717a] mb-2">
                <span className="text-[#f59e0b]">⚠️ macOS users:</span> If you see &quot;app is damaged&quot;, it's because of Gatekeeper (unsigned app). Run this in Terminal:
              </p>
              <code className="text-xs text-[#22d3ee] bg-[#0a0a0f] px-2 py-1 rounded block">
                xattr -cr /Applications/claude.mgr.app
              </code>
            </div>
          </div>

          {/* Border gradient */}
          <div className="absolute inset-0 rounded-3xl border border-[#27272a]" />
        </motion.div>
      </div>
    </section>
  );
}

// Footer
function Footer() {
  return (
    <footer className="relative py-16 px-6 border-t border-[#27272a]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#22d3ee] to-[#60a5fa] flex items-center justify-center">
              <Bot className="w-5 h-5 text-[#0a0a0f]" />
            </div>
            <span className="font-bold text-lg">
              <span className="text-[#f5f5f7]">CLAUDE</span>
              <span className="text-[#22d3ee]">.MGR</span>
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-8">
            <a
              href="https://github.com/Charlie85270/claude-mgr"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[#a1a1aa] hover:text-[#f5f5f7] transition-colors"
            >
              <Github className="w-5 h-5" />
              <span>GitHub</span>
            </a>
            <a
              href="https://github.com/Charlie85270/claude-mgr/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#a1a1aa] hover:text-[#f5f5f7] transition-colors"
            >
              Report Issue
            </a>
          </div>

          {/* Copyright */}
          <div className="text-[#71717a] text-sm">
            Built with <span className="text-[#ef4444]">♥</span> for the Claude community
          </div>
        </div>
      </div>
    </footer>
  );
}

// Main Page
export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] text-[#f5f5f7] overflow-x-hidden">
      <Navigation />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <DemoSection />
      <DownloadSection />
      <Footer />
    </main>
  );
}
