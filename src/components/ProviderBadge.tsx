import React from 'react';

function GeminiLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`${className} !text-black`}>
      <path d="M12 0C12 6.627 6.627 12 0 12c6.627 0 12 5.373 12 12 0-6.627 5.373-12 12-12-6.627 0-12-5.373-12-12Z" />
    </svg>
  );
}

function GrokLogo({ className }: { className?: string }) {
  // Official xAI Grok mark — black rounded square with the white glyph.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 509.641"
      shapeRendering="geometricPrecision"
      textRendering="geometricPrecision"
      imageRendering="optimizeQuality"
      fillRule="evenodd"
      clipRule="evenodd"
      className={className}
    >
      <path d="M115.612 0h280.776C459.975 0 512 52.026 512 115.612v278.416c0 63.587-52.025 115.613-115.612 115.613H115.612C52.026 509.641 0 457.615 0 394.028V115.612C0 52.026 52.026 0 115.612 0z" />
      <path fill="#fff" d="M213.235 306.019l178.976-180.002v.169l51.695-51.763c-.924 1.32-1.86 2.605-2.785 3.89-39.281 54.164-58.46 80.649-43.07 146.922l-.09-.101c10.61 45.11-.744 95.137-37.398 131.836-46.216 46.306-120.167 56.611-181.063 14.928l42.462-19.675c38.863 15.278 81.392 8.57 111.947-22.03 30.566-30.6 37.432-75.159 22.065-112.252-2.92-7.025-11.67-8.795-17.792-4.263l-124.947 92.341zm-25.786 22.437l-.033.034L68.094 435.217c7.565-10.429 16.957-20.294 26.327-30.149 26.428-27.803 52.653-55.359 36.654-94.302-21.422-52.112-8.952-113.177 30.724-152.898 41.243-41.254 101.98-51.661 152.706-30.758 11.23 4.172 21.016 10.114 28.638 15.639l-42.359 19.584c-39.44-16.563-84.629-5.299-112.207 22.313-37.298 37.308-44.84 102.003-1.128 143.81z" />
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
  grok: { label: 'Grok', icon: GrokLogo },
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

export { PROVIDER_CONFIG, GeminiLogo, GrokLogo };
