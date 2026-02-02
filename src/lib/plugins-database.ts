// Plugin database for Claude Code plugins marketplace

export interface Plugin {
  name: string;
  description: string;
  category: string;
  marketplace: string;
  author?: string;
  tags?: string[];
  homepage?: string;
  binaryRequired?: string; // For LSP plugins
}

export const PLUGIN_CATEGORIES = [
  'Code Intelligence',
  'External Integrations',
  'Development Workflows',
  'Output Styles',
  'Security',
  'Productivity',
] as const;

export type PluginCategory = (typeof PLUGIN_CATEGORIES)[number];

export const PLUGINS_DATABASE: Plugin[] = [
  // === Code Intelligence (LSP) Plugins ===
  {
    name: 'typescript-lsp',
    description: 'TypeScript/JavaScript language server for code intelligence, diagnostics, and navigation',
    category: 'Code Intelligence',
    marketplace: 'claude-plugins-official',
    tags: ['typescript', 'javascript', 'lsp'],
    binaryRequired: 'typescript-language-server',
  },
  {
    name: 'pyright-lsp',
    description: 'Python language server for type checking, diagnostics, and code navigation',
    category: 'Code Intelligence',
    marketplace: 'claude-plugins-official',
    tags: ['python', 'lsp'],
    binaryRequired: 'pyright-langserver',
  },
  {
    name: 'rust-analyzer-lsp',
    description: 'Rust language server for code intelligence and diagnostics',
    category: 'Code Intelligence',
    marketplace: 'claude-plugins-official',
    tags: ['rust', 'lsp'],
    binaryRequired: 'rust-analyzer',
  },
  {
    name: 'gopls-lsp',
    description: 'Go language server for code intelligence and diagnostics',
    category: 'Code Intelligence',
    marketplace: 'claude-plugins-official',
    tags: ['go', 'golang', 'lsp'],
    binaryRequired: 'gopls',
  },
  {
    name: 'clangd-lsp',
    description: 'C/C++ language server for code intelligence and diagnostics',
    category: 'Code Intelligence',
    marketplace: 'claude-plugins-official',
    tags: ['c', 'cpp', 'lsp'],
    binaryRequired: 'clangd',
  },
  {
    name: 'csharp-lsp',
    description: 'C# language server for code intelligence and diagnostics',
    category: 'Code Intelligence',
    marketplace: 'claude-plugins-official',
    tags: ['csharp', 'dotnet', 'lsp'],
    binaryRequired: 'csharp-ls',
  },
  {
    name: 'jdtls-lsp',
    description: 'Java language server for code intelligence and diagnostics',
    category: 'Code Intelligence',
    marketplace: 'claude-plugins-official',
    tags: ['java', 'lsp'],
    binaryRequired: 'jdtls',
  },
  {
    name: 'kotlin-lsp',
    description: 'Kotlin language server for code intelligence and diagnostics',
    category: 'Code Intelligence',
    marketplace: 'claude-plugins-official',
    tags: ['kotlin', 'lsp'],
    binaryRequired: 'kotlin-language-server',
  },
  {
    name: 'swift-lsp',
    description: 'Swift language server for code intelligence and diagnostics',
    category: 'Code Intelligence',
    marketplace: 'claude-plugins-official',
    tags: ['swift', 'ios', 'macos', 'lsp'],
    binaryRequired: 'sourcekit-lsp',
  },
  {
    name: 'lua-lsp',
    description: 'Lua language server for code intelligence and diagnostics',
    category: 'Code Intelligence',
    marketplace: 'claude-plugins-official',
    tags: ['lua', 'lsp'],
    binaryRequired: 'lua-language-server',
  },
  {
    name: 'php-lsp',
    description: 'PHP language server for code intelligence and diagnostics',
    category: 'Code Intelligence',
    marketplace: 'claude-plugins-official',
    tags: ['php', 'lsp'],
    binaryRequired: 'intelephense',
  },

  // === External Integrations ===
  {
    name: 'github',
    description: 'GitHub integration for issues, PRs, and repository management',
    category: 'External Integrations',
    marketplace: 'claude-plugins-official',
    tags: ['github', 'git', 'source-control'],
  },
  {
    name: 'gitlab',
    description: 'GitLab integration for issues, merge requests, and repository management',
    category: 'External Integrations',
    marketplace: 'claude-plugins-official',
    tags: ['gitlab', 'git', 'source-control'],
  },
  {
    name: 'atlassian',
    description: 'Atlassian integration for Jira and Confluence',
    category: 'External Integrations',
    marketplace: 'claude-plugins-official',
    tags: ['jira', 'confluence', 'project-management'],
  },
  {
    name: 'asana',
    description: 'Asana integration for task and project management',
    category: 'External Integrations',
    marketplace: 'claude-plugins-official',
    tags: ['asana', 'project-management', 'tasks'],
  },
  {
    name: 'linear',
    description: 'Linear integration for issue tracking and project management',
    category: 'External Integrations',
    marketplace: 'claude-plugins-official',
    tags: ['linear', 'project-management', 'issues'],
  },
  {
    name: 'notion',
    description: 'Notion integration for docs and knowledge management',
    category: 'External Integrations',
    marketplace: 'claude-plugins-official',
    tags: ['notion', 'docs', 'knowledge'],
  },
  {
    name: 'figma',
    description: 'Figma integration for design collaboration',
    category: 'External Integrations',
    marketplace: 'claude-plugins-official',
    tags: ['figma', 'design', 'ui'],
  },
  {
    name: 'vercel',
    description: 'Vercel integration for deployments and infrastructure',
    category: 'External Integrations',
    marketplace: 'claude-plugins-official',
    tags: ['vercel', 'deployment', 'infrastructure'],
  },
  {
    name: 'firebase',
    description: 'Firebase integration for backend services',
    category: 'External Integrations',
    marketplace: 'claude-plugins-official',
    tags: ['firebase', 'backend', 'google'],
  },
  {
    name: 'supabase',
    description: 'Supabase integration for database and auth services',
    category: 'External Integrations',
    marketplace: 'claude-plugins-official',
    tags: ['supabase', 'database', 'backend'],
  },
  {
    name: 'slack',
    description: 'Slack integration for team communication',
    category: 'External Integrations',
    marketplace: 'claude-plugins-official',
    tags: ['slack', 'communication', 'messaging'],
  },
  {
    name: 'sentry',
    description: 'Sentry integration for error monitoring and performance',
    category: 'External Integrations',
    marketplace: 'claude-plugins-official',
    tags: ['sentry', 'monitoring', 'errors'],
  },

  // === Development Workflows ===
  {
    name: 'commit-commands',
    description: 'Git commit workflows including commit, push, and PR creation',
    category: 'Development Workflows',
    marketplace: 'claude-plugins-official',
    author: 'Anthropic',
    tags: ['git', 'commit', 'workflow'],
  },
  {
    name: 'pr-review-toolkit',
    description: 'Specialized agents for reviewing pull requests with confidence-based scoring',
    category: 'Development Workflows',
    marketplace: 'claude-plugins-official',
    author: 'Anthropic',
    tags: ['pr', 'review', 'code-review'],
  },
  {
    name: 'agent-sdk-dev',
    description: 'Development kit for working with the Claude Agent SDK',
    category: 'Development Workflows',
    marketplace: 'claude-plugins-official',
    author: 'Anthropic',
    tags: ['sdk', 'agent', 'development'],
  },
  {
    name: 'plugin-dev',
    description: 'Toolkit for creating Claude Code plugins',
    category: 'Development Workflows',
    marketplace: 'claude-plugins-official',
    author: 'Anthropic',
    tags: ['plugin', 'development', 'tools'],
  },
  {
    name: 'code-review',
    description: 'Uses multiple agents with confidence-based scoring for comprehensive PR analysis',
    category: 'Development Workflows',
    marketplace: 'anthropics-claude-code',
    author: 'Anthropic',
    tags: ['review', 'code-quality', 'agents'],
  },
  {
    name: 'feature-dev',
    description: 'Specialized agents for codebase analysis and architecture planning',
    category: 'Development Workflows',
    marketplace: 'anthropics-claude-code',
    author: 'Anthropic',
    tags: ['feature', 'architecture', 'planning'],
  },
  {
    name: 'hookify',
    description: 'Creates custom behavior rules via markdown configuration',
    category: 'Development Workflows',
    marketplace: 'anthropics-claude-code',
    author: 'Anthropic',
    tags: ['hooks', 'configuration', 'rules'],
  },

  // === Output Styles ===
  {
    name: 'explanatory-output-style',
    description: 'Adds educational insights about implementation choices and codebase patterns',
    category: 'Output Styles',
    marketplace: 'claude-plugins-official',
    author: 'Anthropic',
    tags: ['style', 'educational', 'learning'],
  },
  {
    name: 'learning-output-style',
    description: 'Interactive learning mode that requests meaningful contributions at decision points',
    category: 'Output Styles',
    marketplace: 'claude-plugins-official',
    author: 'Anthropic',
    tags: ['style', 'interactive', 'learning'],
  },

  // === Security ===
  {
    name: 'security-guidance',
    description: 'Warns about injection vulnerabilities, XSS risks, and unsafe patterns',
    category: 'Security',
    marketplace: 'anthropics-claude-code',
    author: 'Anthropic',
    tags: ['security', 'vulnerabilities', 'xss'],
  },

  // === Productivity ===
  {
    name: 'frontend-design',
    description: 'Generates polished, production-grade UI interfaces with high design quality',
    category: 'Productivity',
    marketplace: 'anthropics-claude-code',
    author: 'Anthropic',
    tags: ['frontend', 'design', 'ui'],
  },
  {
    name: 'claude-opus-4-5-migration',
    description: 'Assists with upgrading code from earlier model versions to Claude Opus 4.5',
    category: 'Productivity',
    marketplace: 'anthropics-claude-code',
    author: 'Anthropic',
    tags: ['migration', 'upgrade', 'models'],
  },
  {
    name: 'ralph-wiggum',
    description: 'Enables iterative self-referential AI loops for complex task completion',
    category: 'Productivity',
    marketplace: 'anthropics-claude-code',
    author: 'Anthropic',
    tags: ['ai', 'loops', 'automation'],
  },
];

// Get unique marketplaces
export const MARKETPLACES = [
  {
    id: 'claude-plugins-official',
    name: 'Official Anthropic',
    description: 'Official plugins maintained by Anthropic',
    source: 'Built-in',
  },
  {
    id: 'anthropics-claude-code',
    name: 'Demo Plugins',
    description: 'Demo plugins from anthropics/claude-code repository',
    source: 'anthropics/claude-code',
  },
] as const;
