'use client';

import { motion } from 'framer-motion';
import { Heart, Coffee, CalendarHeart, ExternalLink } from 'lucide-react';

// Stripe Payment Links
const ONE_TIME_TIERS = [
  { label: '$10', url: 'https://buy.stripe.com/fZu4gA28j8149cY0TycV200' },
  { label: '$25', url: 'https://buy.stripe.com/28E14oaEP6X0exi31GcV202' },
  { label: '$50', url: 'https://buy.stripe.com/aFacN614f81460M7hWcV203' },
  { label: '$100', url: 'https://buy.stripe.com/7sY5kE28j5SW2OA59OcV204' },
];

const RECURRING_TIERS = [
  { label: '$5/mo', url: 'https://buy.stripe.com/fZu8wQ28j4OS88U31GcV205' },
  { label: '$10/mo', url: 'https://buy.stripe.com/28E00k28j0yCfBm7hWcV206' },
  { label: '$25/mo', url: 'https://buy.stripe.com/14AeVe14fepsgFq0TycV207' },
];

function openExternal(url: string) {
  if (window.electronAPI?.updates?.openExternal) {
    window.electronAPI.updates.openExternal(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function SupportPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)] pt-4 lg:pt-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-4 lg:px-6 pb-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-5">
            <Heart className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mb-3">
            Support Dorothy
          </h1>
          <p className="text-muted-foreground text-sm lg:text-base max-w-lg mx-auto">
            Help us keep building the future of AI agent management.
          </p>
        </motion.div>

        {/* Story */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-6 mb-8"
        >
          <h2 className="text-lg font-semibold mb-3">Why Dorothy?</h2>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Dorothy started as a simple idea: give developers a beautiful, powerful desktop app
              to orchestrate their AI coding agents. What began as a side project has grown into
              something we use every day — and so do hundreds of others.
            </p>
            <p>
              We're a small team pouring real energy into Dorothy — new integrations, better UX,
              and features that make AI-assisted development feel effortless. Your support helps
              us dedicate more time to building, covering infrastructure costs, and keeping Dorothy
              free and open.
            </p>
            <p>
              Every contribution, big or small, fuels the next feature and keeps the lights on.
              As a thank you, all supporters get early beta access to our upcoming premium version.
            </p>
          </div>
        </motion.div>

        {/* One-time Support */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-card border border-border rounded-xl p-6 mb-4"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Coffee className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="text-base font-semibold">One-time</h3>
              <p className="text-xs text-muted-foreground">Buy us a coffee</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {ONE_TIME_TIERS.map((tier) => (
              <button
                key={tier.label}
                onClick={() => openExternal(tier.url)}
                className="group flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all duration-200 cursor-pointer"
              >
                <span>{tier.label}</span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </motion.div>

        {/* Recurring Support */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-card border border-border rounded-xl p-6 mb-10"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarHeart className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Monthly</h3>
              <p className="text-xs text-muted-foreground">Become a supporter</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
            {RECURRING_TIERS.map((tier) => (
              <button
                key={tier.label}
                onClick={() => openExternal(tier.url)}
                className="group flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all duration-200 cursor-pointer"
              >
                <span>{tier.label}</span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </motion.div>

        {/* Thank you */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center text-xs text-muted-foreground"
        >
          <p>Payments are securely handled by Stripe. Thank you for your generosity.</p>
        </motion.div>
      </div>
    </div>
  );
}
