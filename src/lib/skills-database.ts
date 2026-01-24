// Top 100 Skills from skills.sh
export interface Skill {
  rank: number;
  name: string;
  repo: string;
  installs: string;
  category: string;
  description?: string;
}

export const SKILLS_DATABASE: Skill[] = [
  { rank: 1, name: 'vercel-react-best-practices', repo: 'vercel-labs/agent-skills', installs: '36.8K', category: 'Frontend' },
  { rank: 2, name: 'web-design-guidelines', repo: 'vercel-labs/agent-skills', installs: '27.9K', category: 'Design' },
  { rank: 3, name: 'remotion-best-practices', repo: 'remotion-dev/skills', installs: '17.7K', category: 'Video' },
  { rank: 4, name: 'frontend-design', repo: 'anthropics/skills', installs: '6.9K', category: 'Design' },
  { rank: 5, name: 'skill-creator', repo: 'anthropics/skills', installs: '3.6K', category: 'Meta' },
  { rank: 6, name: 'building-native-ui', repo: 'expo/skills', installs: '2.6K', category: 'Mobile' },
  { rank: 7, name: 'agent-browser', repo: 'vercel-labs/agent-browser', installs: '2.5K', category: 'Automation' },
  { rank: 8, name: 'better-auth-best-practices', repo: 'better-auth/skills', installs: '2.2K', category: 'Auth' },
  { rank: 9, name: 'upgrading-expo', repo: 'expo/skills', installs: '2.2K', category: 'Mobile' },
  { rank: 10, name: 'seo-audit', repo: 'coreyhaines31/marketingskills', installs: '2.1K', category: 'Marketing' },
  { rank: 11, name: 'native-data-fetching', repo: 'expo/skills', installs: '2.1K', category: 'Mobile' },
  { rank: 12, name: 'audit-website', repo: 'squirrelscan/skills', installs: '2.0K', category: 'Security' },
  { rank: 13, name: 'expo-dev-client', repo: 'expo/skills', installs: '1.9K', category: 'Mobile' },
  { rank: 14, name: 'copywriting', repo: 'coreyhaines31/marketingskills', installs: '1.9K', category: 'Marketing' },
  { rank: 15, name: 'expo-deployment', repo: 'expo/skills', installs: '1.8K', category: 'Mobile' },
  { rank: 16, name: 'expo-api-routes', repo: 'expo/skills', installs: '1.8K', category: 'Mobile' },
  { rank: 17, name: 'expo-tailwind-setup', repo: 'expo/skills', installs: '1.8K', category: 'Mobile' },
  { rank: 18, name: 'expo-cicd-workflows', repo: 'expo/skills', installs: '1.7K', category: 'DevOps' },
  { rank: 19, name: 'react-native-best-practices', repo: 'callstackincubator/agent-skills', installs: '1.7K', category: 'Mobile' },
  { rank: 20, name: 'use-dom', repo: 'expo/skills', installs: '1.7K', category: 'Mobile' },
  { rank: 21, name: 'supabase-postgres-best-practices', repo: 'supabase/agent-skills', installs: '1.5K', category: 'Database' },
  { rank: 22, name: 'marketing-psychology', repo: 'coreyhaines31/marketingskills', installs: '1.5K', category: 'Marketing' },
  { rank: 23, name: 'pdf', repo: 'anthropics/skills', installs: '1.3K', category: 'Documents' },
  { rank: 24, name: 'programmatic-seo', repo: 'coreyhaines31/marketingskills', installs: '1.3K', category: 'Marketing' },
  { rank: 25, name: 'marketing-ideas', repo: 'coreyhaines31/marketingskills', installs: '1.3K', category: 'Marketing' },
  { rank: 26, name: 'vue-best-practices', repo: 'hyf0/vue-skills', installs: '1.2K', category: 'Frontend' },
  { rank: 27, name: 'pricing-strategy', repo: 'coreyhaines31/marketingskills', installs: '1.2K', category: 'Marketing' },
  { rank: 28, name: 'social-content', repo: 'coreyhaines31/marketingskills', installs: '1.2K', category: 'Marketing' },
  { rank: 29, name: 'copy-editing', repo: 'coreyhaines31/marketingskills', installs: '1.2K', category: 'Marketing' },
  { rank: 30, name: 'pptx', repo: 'anthropics/skills', installs: '1.1K', category: 'Documents' },
  { rank: 31, name: 'brainstorming', repo: 'obra/superpowers', installs: '1.1K', category: 'Productivity' },
  { rank: 32, name: 'xlsx', repo: 'anthropics/skills', installs: '1.1K', category: 'Documents' },
  { rank: 33, name: 'launch-strategy', repo: 'coreyhaines31/marketingskills', installs: '1.1K', category: 'Marketing' },
  { rank: 34, name: 'create-auth-skill', repo: 'better-auth/skills', installs: '1.1K', category: 'Auth' },
  { rank: 35, name: 'page-cro', repo: 'coreyhaines31/marketingskills', installs: '1.1K', category: 'Marketing' },
  { rank: 36, name: 'analytics-tracking', repo: 'coreyhaines31/marketingskills', installs: '1.0K', category: 'Marketing' },
  { rank: 37, name: 'docx', repo: 'anthropics/skills', installs: '1.0K', category: 'Documents' },
  { rank: 38, name: 'competitor-alternatives', repo: 'coreyhaines31/marketingskills', installs: '1.0K', category: 'Marketing' },
  { rank: 39, name: 'onboarding-cro', repo: 'coreyhaines31/marketingskills', installs: '1.0K', category: 'Marketing' },
  { rank: 40, name: 'schema-markup', repo: 'coreyhaines31/marketingskills', installs: '983', category: 'Marketing' },
  { rank: 41, name: 'email-sequence', repo: 'coreyhaines31/marketingskills', installs: '973', category: 'Marketing' },
  { rank: 42, name: 'baoyu-slide-deck', repo: 'jimliu/baoyu-skills', installs: '965', category: 'Documents' },
  { rank: 43, name: 'paid-ads', repo: 'coreyhaines31/marketingskills', installs: '961', category: 'Marketing' },
  { rank: 44, name: 'signup-flow-cro', repo: 'coreyhaines31/marketingskills', installs: '946', category: 'Marketing' },
  { rank: 45, name: 'free-tool-strategy', repo: 'coreyhaines31/marketingskills', installs: '938', category: 'Marketing' },
  { rank: 46, name: 'baoyu-article-illustrator', repo: 'jimliu/baoyu-skills', installs: '934', category: 'Content' },
  { rank: 47, name: 'ui-ux-pro-max', repo: 'nextlevelbuilder/ui-ux-pro-max-skill', installs: '932', category: 'Design' },
  { rank: 48, name: 'webapp-testing', repo: 'anthropics/skills', installs: '928', category: 'Testing' },
  { rank: 49, name: 'paywall-upgrade-cro', repo: 'coreyhaines31/marketingskills', installs: '915', category: 'Marketing' },
  { rank: 50, name: 'form-cro', repo: 'coreyhaines31/marketingskills', installs: '911', category: 'Marketing' },
  { rank: 51, name: 'referral-program', repo: 'coreyhaines31/marketingskills', installs: '907', category: 'Marketing' },
  { rank: 52, name: 'popup-cro', repo: 'coreyhaines31/marketingskills', installs: '890', category: 'Marketing' },
  { rank: 53, name: 'ab-test-setup', repo: 'coreyhaines31/marketingskills', installs: '881', category: 'Marketing' },
  { rank: 54, name: 'mcp-builder', repo: 'anthropics/skills', installs: '878', category: 'Development' },
  { rank: 55, name: 'baoyu-cover-image', repo: 'jimliu/baoyu-skills', installs: '864', category: 'Content' },
  { rank: 56, name: 'baoyu-xhs-images', repo: 'jimliu/baoyu-skills', installs: '837', category: 'Content' },
  { rank: 57, name: 'baoyu-comic', repo: 'jimliu/baoyu-skills', installs: '819', category: 'Content' },
  { rank: 58, name: 'test-driven-development', repo: 'obra/superpowers', installs: '805', category: 'Development' },
  { rank: 59, name: 'canvas-design', repo: 'anthropics/skills', installs: '801', category: 'Design' },
  { rank: 60, name: 'systematic-debugging', repo: 'obra/superpowers', installs: '786', category: 'Development' },
  { rank: 61, name: 'baoyu-post-to-wechat', repo: 'jimliu/baoyu-skills', installs: '749', category: 'Social' },
  { rank: 62, name: 'doc-coauthoring', repo: 'anthropics/skills', installs: '734', category: 'Documents' },
  { rank: 63, name: 'baoyu-post-to-x', repo: 'jimliu/baoyu-skills', installs: '721', category: 'Social' },
  { rank: 64, name: 'writing-plans', repo: 'obra/superpowers', installs: '710', category: 'Productivity' },
  { rank: 65, name: 'theme-factory', repo: 'anthropics/skills', installs: '705', category: 'Design' },
  { rank: 66, name: 'executing-plans', repo: 'obra/superpowers', installs: '698', category: 'Productivity' },
  { rank: 67, name: 'web-artifacts-builder', repo: 'anthropics/skills', installs: '667', category: 'Development' },
  { rank: 68, name: 'subagent-driven-development', repo: 'obra/superpowers', installs: '650', category: 'Development' },
  { rank: 69, name: 'verification-before-completion', repo: 'obra/superpowers', installs: '650', category: 'Development' },
  { rank: 70, name: 'using-superpowers', repo: 'obra/superpowers', installs: '648', category: 'Meta' },
  { rank: 71, name: 'requesting-code-review', repo: 'obra/superpowers', installs: '638', category: 'Development' },
  { rank: 72, name: 'baoyu-compress-image', repo: 'jimliu/baoyu-skills', installs: '637', category: 'Media' },
  { rank: 73, name: 'release-skills', repo: 'jimliu/baoyu-skills', installs: '635', category: 'Meta' },
  { rank: 74, name: 'baoyu-danger-gemini-web', repo: 'jimliu/baoyu-skills', installs: '630', category: 'AI' },
  { rank: 75, name: 'algorithmic-art', repo: 'anthropics/skills', installs: '629', category: 'Creative' },
  { rank: 76, name: 'dispatching-parallel-agents', repo: 'obra/superpowers', installs: '618', category: 'Development' },
  { rank: 77, name: 'writing-skills', repo: 'obra/superpowers', installs: '617', category: 'Meta' },
  { rank: 78, name: 'brand-guidelines', repo: 'anthropics/skills', installs: '598', category: 'Design' },
  { rank: 79, name: 'baoyu-danger-x-to-markdown', repo: 'jimliu/baoyu-skills', installs: '593', category: 'Content' },
  { rank: 80, name: 'receiving-code-review', repo: 'obra/superpowers', installs: '589', category: 'Development' },
  { rank: 81, name: 'internal-comms', repo: 'anthropics/skills', installs: '585', category: 'Communication' },
  { rank: 82, name: 'using-git-worktrees', repo: 'obra/superpowers', installs: '579', category: 'Development' },
  { rank: 83, name: 'template-skill', repo: 'anthropics/skills', installs: '570', category: 'Meta' },
  { rank: 84, name: 'agentation', repo: 'benjitaylor/agentation', installs: '569', category: 'AI' },
  { rank: 85, name: 'humanizer-zh', repo: 'op7418/humanizer-zh', installs: '557', category: 'Content' },
  { rank: 86, name: 'slack-gif-creator', repo: 'anthropics/skills', installs: '544', category: 'Creative' },
  { rank: 87, name: 'daily-meeting-update', repo: 'softaworks/agent-toolkit', installs: '534', category: 'Productivity' },
  { rank: 88, name: 'agent-md-refactor', repo: 'softaworks/agent-toolkit', installs: '530', category: 'Development' },
  { rank: 89, name: 'finishing-a-development-branch', repo: 'obra/superpowers', installs: '529', category: 'Development' },
  { rank: 90, name: 'session-handoff', repo: 'softaworks/agent-toolkit', installs: '518', category: 'Productivity' },
  { rank: 91, name: 'codex', repo: 'softaworks/agent-toolkit', installs: '517', category: 'AI' },
  { rank: 92, name: 'gemini', repo: 'softaworks/agent-toolkit', installs: '514', category: 'AI' },
  { rank: 93, name: 'commit-work', repo: 'softaworks/agent-toolkit', installs: '513', category: 'Development' },
  { rank: 94, name: 'qa-test-planner', repo: 'softaworks/agent-toolkit', installs: '513', category: 'Testing' },
  { rank: 95, name: 'meme-factory', repo: 'softaworks/agent-toolkit', installs: '512', category: 'Creative' },
  { rank: 96, name: 'dependency-updater', repo: 'softaworks/agent-toolkit', installs: '504', category: 'Development' },
  { rank: 97, name: 'domain-name-brainstormer', repo: 'softaworks/agent-toolkit', installs: '498', category: 'Productivity' },
  { rank: 98, name: 'gepetto', repo: 'softaworks/agent-toolkit', installs: '496', category: 'AI' },
  { rank: 99, name: 'ship-learn-next', repo: 'softaworks/agent-toolkit', installs: '496', category: 'Development' },
  { rank: 100, name: 'vue', repo: 'onmax/nuxt-skills', installs: '478', category: 'Frontend' },
];

// Get unique categories
export const SKILL_CATEGORIES = [...new Set(SKILLS_DATABASE.map(s => s.category))].sort();

// Get skills by category
export function getSkillsByCategory(category: string): Skill[] {
  return SKILLS_DATABASE.filter(s => s.category === category);
}

// Search skills
export function searchSkills(query: string): Skill[] {
  const q = query.toLowerCase();
  return SKILLS_DATABASE.filter(
    s => s.name.toLowerCase().includes(q) ||
         s.repo.toLowerCase().includes(q) ||
         s.category.toLowerCase().includes(q)
  );
}
