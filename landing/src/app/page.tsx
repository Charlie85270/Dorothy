'use client';

import { Download, ArrowRight, Github, Check, Copy, ClipboardCheck } from 'lucide-react';
import { useState, useEffect } from 'react';
import Image from 'next/image';

/* ═══════════════════════════════════════════════════════════════ */

function Marquee({ items }: { items: string[] }) {
  const doubled = [...items, ...items];
  return (
    <div className="overflow-hidden">
      <div className="marquee-track flex items-center gap-10 w-max py-4">
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-nowrap">
            <span className="text-sm tracking-wide">{item}</span>
            <span className="w-1 h-1 rounded-full bg-teal opacity-40" />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

export default function Home() {
  const [count, setCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(d => setCount(d.total)).catch(() => { });
  }, []);

  return (
    <main className="min-h-screen bg-cream text-brown overflow-x-hidden">

      {/* ───────── NAV ───────── */}
      <nav className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2.5">
          <img src="/dorothy/dorothy-without-text.png" alt="" width={32} height={32} className="w-10 h-10 scale-100 rounded-full" />
          <img src="/dorothy/text.png" alt="Dorothy" width={90} height={90} className="w-[90px] bg-transparent h-auto object-contain" />
        </a>
        <div className="hidden md:flex items-center gap-8 text-[13px] text-brown-light">
          <a href="#features" className="hover:text-brown transition-colors">Features</a>
          <a href="#preview" className="hover:text-brown transition-colors">Preview</a>
          <a href="#download" className="hover:text-brown transition-colors">Download</a>
        </div>
        <div className="flex items-center gap-3">
          <a href="https://github.com/Charlie85270/Dorothy" target="_blank" rel="noopener noreferrer" className="text-brown-light hover:text-brown transition-colors">
            <Github className="w-[18px] h-[18px]" />
          </a>
          <a href="#download" className="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-teal text-white text-[13px] font-medium rounded-full hover:bg-teal-dark transition-colors">
            <Download className="w-3.5 h-3.5" />
            Download
          </a>
        </div>
      </nav>

      {/* ───────── HERO ───────── */}
      <section className="relative max-w-6xl mx-auto px-6 pt-10 md:pt-16 pb-20">
        {/* Decorative circles */}
        <div className="absolute top-0 right-12 w-64 h-64 circle-deco hidden lg:block" />


        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          {/* Left — text */}
          <div className="flex-1 text-center lg:text-left max-w-xl">
            <p className="font-display italic text-teal text-lg mb-4">Your Dearest Claude</p>

            <h1 className="font-display text-5xl md:text-7xl leading-[1.05] mb-6">
              Perfectly<br />Managed.
            </h1>

            <p className="text-brown-light text-[15px] leading-relaxed mb-8 max-w-md mx-auto lg:mx-0">
              Claude is powerful but he can quickly become overwhelming.<br />
              Thankfully, his wife Dorothy is here to keep everything under control.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
              <a href="/api/download?platform=mac" className="group flex items-center gap-2.5 px-7 py-3 bg-teal text-white font-medium rounded-full hover:bg-teal-dark transition-colors">
                <Download className="w-4 h-4" />
                Download for Mac
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
              <a href="#features" className="px-7 py-3 border border-warm text-brown-light font-medium rounded-full hover:border-teal hover:text-teal transition-colors text-[14px]">
                Learn more
              </a>
            </div>

            {/* Small stats */}
            <div className="flex items-center gap-6 mt-8 justify-center lg:justify-start text-[13px] text-brown-light">
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-teal" /> Free forever</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-teal" /> Open source</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-teal" /> No account</span>
            </div>
          </div>

          {/* Right — illustration */}
          <div className="relative shrink-0">
            <Image
              src="/dorothy/background-2.png"
              alt="Dorothy and Developer"
              width={520}
              height={300}
              className="rounded-2xl w-[360px] md:w-[680px] h-auto object-cover drop-shadow-lg"
            />
          </div>
        </div>
      </section>

      {/* ───────── MARQUEE STRIP ───────── */}
      <div className="border-y border-warm">
        <Marquee items={[
          'Multi-Agent Management',
          'Super Agent Orchestrator',
          'Kanban Task Board',
          '3D Agent World',
          'Skills & Plugins',
          'GitHub & JIRA Automations',
          'Telegram & Slack Bots',
          'Usage Analytics',
        ]} />
      </div>

      {/* ───────── FEATURES ───────── */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-20 md:py-28">
        <div className="text-center mb-14">
          <p className="font-display italic text-teal text-base mb-2">What&apos;s inside</p>
          <h2 className="font-display text-4xl md:text-5xl">Everything you need</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
          {[
            { n: '01', title: 'Super Agent', desc: 'An orchestrator that coordinates all your agents. Give it a task and watch it delegate.' },
            { n: '02', title: 'Multi-Agent Terminal', desc: 'Run multiple Claude agents side-by-side with full interactive terminal access.' },
            { n: '03', title: 'Kanban Board', desc: 'Visual task management with drag-and-drop. Agents auto-pick work by skill.' },
            { n: '04', title: '3D Agent World', desc: 'Watch your agents in a fun animated 3D office. Because why not.' },
            { n: '05', title: 'Skills & Plugins', desc: 'Install community skills from skills.sh with one click. Hundreds available.' },
            { n: '06', title: 'Automations', desc: 'Connect GitHub, JIRA, Telegram, and Slack. Agents process items automatically.' },
          ].map((f) => (
            <div key={f.n} className="group">
              <span className="font-display text-teal text-sm">{f.n}</span>
              <h3 className="font-display text-xl mt-1 mb-2 group-hover:text-teal transition-colors">{f.title}</h3>
              <p className="text-sm text-brown-light leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── APP PREVIEW ───────── */}
      <section id="preview" className="bg-teal/5 py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="font-display italic text-teal text-base mb-2">See it in action</p>
            <h2 className="font-display text-4xl md:text-5xl">A peek inside Dorothy</h2>
          </div>

          {/* Main screenshot */}
          <div className="rounded-xl overflow-hidden border border-warm bg-white mx-auto max-w-4xl"
            style={{ boxShadow: '0 8px 40px rgba(58,46,36,0.08)' }}>
            <div className="flex items-center gap-1.5 px-4 py-2.5 bg-cream-dark border-b border-warm">
              <div className="w-2.5 h-2.5 rounded-full bg-rust/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-mustard/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-teal/50" />
              <span className="text-[10px] text-brown-light/60 ml-2">Dorothy</span>
            </div>
            <Image src="/0.png" alt="Dorothy Dashboard" width={960} height={600} className="w-full h-auto" />
          </div>
        </div>
      </section>

      {/* ───────── TESTIMONIAL ───────── */}
      <section className="max-w-3xl mx-auto px-6 py-20 md:py-24 text-center">
        <div className="w-12 h-px bg-teal mx-auto mb-8" />
        <blockquote className="font-display italic text-2xl md:text-3xl leading-snug mb-6">
          &ldquo;Dorothy makes managing Claude a breeze!&rdquo;
        </blockquote>
        <p className="text-sm text-brown-light">— A Happy Developer</p>
        <div className="w-12 h-px bg-teal mx-auto mt-8" />
      </section>

      {/* ───────── DOWNLOAD CTA ───────── */}
      <section id="download" className="bg-teal text-white py-20 md:py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <Image src="/dorothy/dorothy-without-text.png" alt="Dorothy" width={64} height={64} className="w-16 h-16 mx-auto rounded-full mb-6 ring-4 ring-white/20 object-cover" />

          <h2 className="font-display text-3xl md:text-5xl mb-3">Ready to meet Dorothy?</h2>
          <p className="text-white/70 text-[15px] mb-8 max-w-md mx-auto">
            Free, open source, no account needed. Download and start managing your Claude agents today.
          </p>

          <div className="flex items-center flex-col gap-4 justify-center">
            <a href="/api/download?platform=mac" className="group inline-flex items-center gap-2.5 px-8 py-3.5 bg-white text-teal font-semibold rounded-full hover:bg-cream transition-colors text-[15px]">
              <Download className="w-4.5 h-4.5" />
              Download for macOS
              <ArrowRight className="w-4.5 h-4.5 group-hover:translate-x-0.5 transition-transform" />
            </a>

            {count !== null && count > 0 && (
              <p className="mt-4 text-sm text-white/50">
                <span className="text-white font-medium">{count.toLocaleString()}</span> downloads
              </p>
            )}

            {/* macOS note */}
            <div className="inline-block p-3 rounded-lg bg-white/10 border border-white/10 text-left max-w-sm">
              <p className="text-[11px] text-white/50">
                <span className="text-white/70 font-medium">macOS:</span> If &quot;app is damaged&quot;, run{' '}
                <div className="flex items-center mt-4 gap-1">
                  <code className="text-white/80 bg-black/10 px-1 py-0.5 rounded font-mono text-[11px]">xattr -cr /Applications/Dorothy.app</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText('xattr -cr /Applications/Dorothy.app'); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    className="ml-1.5 inline-flex items-center align-middle text-white/40 hover:text-white/80 transition-colors"
                    title="Copy command"
                  >
                    {copied ? <ClipboardCheck className="w-3 h-3 text-white/80" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── FOOTER ───────── */}
      <footer className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-warm">
        <div className="flex items-center gap-2">
          <img src="/dorothy/dorothy-without-text.png" alt="" width={20} height={20} className="w-5 h-5 rounded-full object-cover" />
          <img src="/dorothy/text.png" alt="Dorothy" width={64} height={64} className="w-16 h-auto bg-transparent object-contain opacity-60" />
        </div>
        <div className="flex items-center gap-6 text-[12px] text-brown-light">
          <a href="https://github.com/Charlie85270/Dorothy" target="_blank" rel="noopener noreferrer" className="hover:text-brown transition-colors">GitHub</a>
          <a href="https://github.com/Charlie85270/Dorothy/issues" target="_blank" rel="noopener noreferrer" className="hover:text-brown transition-colors">Issues</a>
          <a href="https://skills.sh" target="_blank" rel="noopener noreferrer" className="hover:text-brown transition-colors">skills.sh</a>
        </div>
        <p className="text-[11px] text-brown-light/50">Made with &#9829; for the Claude community</p>
      </footer>
    </main>
  );
}
