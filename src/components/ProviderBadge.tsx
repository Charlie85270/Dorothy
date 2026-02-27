import React from 'react';

function GeminiLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} !text-black`}>
      <path d="M12 0C12 6.627 6.627 12 0 12c6.627 0 12 5.373 12 12 0-6.627 5.373-12 12-12-6.627 0-12-5.373-12-12Z" />
    </svg>
  );
}

const PROVIDER_CONFIG: Record<string, {
  label: string;
  icon: string | React.FC<{ className?: string }>;
}> = {
  claude: { label: 'Claude', icon: '/claude-ai-icon.webp' },
  codex: { label: 'ChatGPT', icon: '/chatgpt-icon.webp' },
  gemini: { label: 'Gemini', icon: GeminiLogo },
};

interface ProviderBadgeProps {
  provider: string;
  className?: string;
}

export default function ProviderBadge({ provider, className = '' }: ProviderBadgeProps) {
  const config = PROVIDER_CONFIG[provider];
  if (!config) return null;
  const { label, icon } = config;

  return (
    <span
      title={label}
      className={`relative inline-flex items-center justify-center w-6 h-6 bg-secondary ${className}`}
      style={{ borderRadius: 6 }}
    >
      {typeof icon === 'string' ? (
        <img src={icon} alt={label} className="w-3.5 h-3.5 object-contain" />
      ) : (
        React.createElement(icon, { className: 'w-3.5 h-3.5' })
      )}
      <svg
        className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 text-green-500"
        viewBox="0 0 16 16"
        fill="none"
      >
        <circle cx="8" cy="8" r="8" fill="currentColor" />
        <path d="M4.5 8.5L7 11L11.5 5.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export { PROVIDER_CONFIG, GeminiLogo };
