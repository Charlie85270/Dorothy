import React, { useState, useMemo, useCallback } from 'react';
import {
  X,
  Sparkles,
  Search,
  Check,
  ChevronDown,
  Filter,
  Download,
  CheckCircle,
  Package,
  BookOpen,
  Wrench,
} from 'lucide-react';
import { SKILLS_DATABASE, SKILL_CATEGORIES, type Skill } from '@/lib/skills-database';
import type { ClaudeSkill } from '@/lib/claude-code';
import type { AgentProvider } from '@/types/electron';
import ProviderBadge from '@/components/ProviderBadge';

interface StepToolsProps {
  selectedSkills: string[];
  onToggleSkill: (name: string) => void;
  allInstalledSkills: ClaudeSkill[];
  installedSkillSet: Set<string>;
  onInstallSkill: (skill: Skill) => void;
  provider: AgentProvider;
  installedSkillsByProvider: Record<string, string[]>;
  selectedObsidianVaults: string[];
  registeredVaults: string[];
  detectedVault: string | null;
  onToggleVault: (vaultPath: string) => void;
}

const PROVIDER_IDS = ['claude', 'codex', 'gemini', 'grok'] as const;

const StepTools = React.memo(function StepTools({
  selectedSkills,
  onToggleSkill,
  allInstalledSkills,
  installedSkillSet,
  onInstallSkill,
  provider,
  installedSkillsByProvider,
  selectedObsidianVaults,
  registeredVaults,
  detectedVault,
  onToggleVault,
}: StepToolsProps) {
  const [skillSearch, setSkillSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const isSkillInstalled = useCallback(
    (name: string) => installedSkillSet.has(name.toLowerCase()),
    [installedSkillSet]
  );

  const isSkillInstalledOn = useCallback(
    (name: string, providerId: string): boolean => {
      const skills = installedSkillsByProvider[providerId];
      if (!skills) return false;
      return skills.some(s => s.toLowerCase() === name.toLowerCase());
    },
    [installedSkillsByProvider]
  );

  const isSkillInstalledAnywhere = useCallback(
    (name: string): boolean => {
      for (const skills of Object.values(installedSkillsByProvider)) {
        if (skills.some(s => s.toLowerCase() === name.toLowerCase())) return true;
      }
      return false;
    },
    [installedSkillsByProvider]
  );

  // Deduplicated vault list: detected vault first, then registered (excluding detected)
  const allVaultPaths = useMemo(() => {
    const paths: string[] = [];
    if (detectedVault) paths.push(detectedVault);
    for (const vp of registeredVaults) {
      if (vp !== detectedVault) paths.push(vp);
    }
    return paths;
  }, [registeredVaults, detectedVault]);

  const filteredSkills = useMemo(() => {
    let skills = SKILLS_DATABASE;

    if (skillSearch) {
      const q = skillSearch.toLowerCase();
      skills = skills.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.repo.toLowerCase().includes(q) ||
          (s.category || '').toLowerCase().includes(q)
      );
    }

    if (selectedCategory) {
      skills = skills.filter((s) => s.category && s.category === selectedCategory);
    }

    return skills;
  }, [skillSearch, selectedCategory]);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h3 className="text-lg font-medium mb-1 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-accent-purple" />
          Tools
        </h3>
        <p className="text-text-secondary text-sm">
          Extend your agent with skills and connect knowledge sources
        </p>
      </div>

      {/* ─── Skills Section ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent-purple" />
            <span className="font-medium text-sm">Skills</span>
          </div>
          <span className="text-xs text-accent-purple">{selectedSkills.length} selected</span>
        </div>

        {/* Selected Skills Chips */}
        {selectedSkills.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-accent-purple/10 border border-accent-purple/20">
            {selectedSkills.map((skill) => (
              <button
                key={skill}
                onClick={() => onToggleSkill(skill)}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-accent-purple/20 text-accent-purple text-xs hover:bg-accent-purple/30 transition-colors"
              >
                {skill}
                <X className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={skillSearch}
              onChange={(e) => setSkillSearch(e.target.value)}
              placeholder="Search skills..."
              className="w-full pl-10 pr-4 py-2 rounded-lg text-sm"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowCategoryDropdown(prev => !prev)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              <Filter className="w-3.5 h-3.5" />
              {selectedCategory || 'All'}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showCategoryDropdown && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border shadow-lg rounded-lg min-w-[160px] overflow-hidden">
                <button
                  onClick={() => { setSelectedCategory(null); setShowCategoryDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors ${!selectedCategory ? 'text-accent-purple font-medium' : ''}`}
                >
                  All
                </button>
                {SKILL_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setSelectedCategory(cat); setShowCategoryDropdown(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors ${selectedCategory === cat ? 'text-accent-purple font-medium' : ''}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Skills Card List */}
        <div className="border border-border rounded-lg overflow-hidden max-h-[280px] overflow-y-auto">
          {filteredSkills.map((skill) => {
            const isSelected = selectedSkills.includes(skill.name);
            const installedOnProvider = isSkillInstalled(skill.name);
            const installedAnywhere = isSkillInstalledAnywhere(skill.name);

            return (
              <div
                key={`${skill.repo}-${skill.name}`}
                className={`flex items-center gap-3 px-3 py-2.5 border-b border-border/50 last:border-b-0 transition-colors ${
                  isSelected ? 'bg-accent-purple/5' : 'hover:bg-secondary/50'
                }`}
              >
                {/* Icon */}
                <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${installedAnywhere ? 'bg-primary/10' : 'bg-secondary'}`}>
                  {installedAnywhere ? (
                    <CheckCircle className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <Package className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </div>

                {/* Name + provider dots */}
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">{skill.name}</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    {PROVIDER_IDS.map(id =>
                      isSkillInstalledOn(skill.name, id) ? (
                        <ProviderBadge key={id} provider={id} />
                      ) : null
                    )}
                  </div>
                </div>

                {/* Category badge */}
                {skill.category && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded hidden sm:inline-block shrink-0">
                    {skill.category}
                  </span>
                )}

                {/* Action button */}
                {installedOnProvider ? (
                  <button
                    onClick={() => onToggleSkill(skill.name)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors shrink-0 ${
                      isSelected
                        ? 'bg-accent-purple/15 text-accent-purple'
                        : 'bg-foreground text-background hover:bg-foreground/90'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-3 h-3" />
                        Added
                      </>
                    ) : (
                      'Add'
                    )}
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onInstallSkill(skill);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors shrink-0"
                  >
                    <Download className="w-3 h-3" />
                    Install
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Vaults / Knowledge Section ─── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-purple-500" />
          <span className="font-medium text-sm">Knowledge</span>
          <span className="text-xs text-text-muted">Data sources your agent can reference</span>
        </div>

        <div className="rounded-lg border border-border-primary bg-secondary/30 p-3 space-y-2">
          {/* Dorothy Vault — always selected */}
          <div className="flex items-center gap-3 p-2">
            <div className="w-5 h-5 rounded border bg-purple-500 border-purple-500 flex items-center justify-center shrink-0">
              <Check className="w-3 h-3 text-white" />
            </div>
            <img src="/dorothy-without-text.png" alt="Dorothy" className="w-4 h-4 object-contain shrink-0" />
            <span className="text-sm">Dorothy Vault</span>
            <span className="text-[10px] text-text-muted ml-auto">Always included</span>
          </div>

          {/* All Obsidian vaults — detected first, then registered */}
          {allVaultPaths.map(vp => (
            <div key={vp} className="flex items-center gap-3 p-2">
              <button
                onClick={() => onToggleVault(vp)}
                className={`
                  w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0
                  ${selectedObsidianVaults.includes(vp)
                    ? 'bg-purple-500 border-purple-500'
                    : 'border-purple-500/50 hover:border-purple-500'
                  }
                `}
              >
                {selectedObsidianVaults.includes(vp) && <Check className="w-3 h-3 text-white" />}
              </button>
              <ObsidianIcon />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium block">{vp.split('/').pop()}</span>
                <span className="text-[11px] text-text-muted font-mono block truncate">{vp}</span>
              </div>
              {vp === detectedVault && (
                <span className="text-[10px] text-text-muted shrink-0">Detected</span>
              )}
            </div>
          ))}

          {/* No vaults at all */}
          {registeredVaults.length === 0 && !detectedVault && (
            <a
              href="/settings?section=obsidian"
              className="block text-xs text-muted-foreground hover:text-foreground transition-colors p-2"
            >
              Add vaults in Settings &rarr;
            </a>
          )}
        </div>
      </div>
    </div>
  );
});

function ObsidianIcon() {
  return (
    <svg className="w-4 h-4 text-[#A88BFA] shrink-0" viewBox="0 0 25 25" xmlns="http://www.w3.org/2000/svg">
      <path fill="currentColor" d="m6.91927 14.5955c.64053-.1907 1.67255-.4839 2.85923-.5565-.71191-1.7968-.88376-3.3691-.74554-4.76905.15962-1.61678.72977-2.9662 1.28554-4.11442.1186-.24501.2326-.47313.3419-.69198.1549-.30984.3004-.60109.4365-.8953.2266-.48978.3948-.92231.4798-1.32416.0836-.39515.0841-.74806-.0148-1.08657-.099-.338982-.3093-.703864-.7093-1.1038132-.5222-.1353116-1.1017-.0165173-1.53613.3742922l-5.15591 4.638241c-.28758.25871-.47636.60929-.53406.99179l-.44455 2.94723c.69903.6179 2.42435 2.41414 3.47374 4.90644.09364.2224.1819.4505.26358.6838z"/>
      <path fill="currentColor" d="m2.97347 10.3512c-.02431.1037-.05852.205-.10221.3024l-2.724986 6.0735c-.279882.6238-.15095061 1.3552.325357 1.8457l4.288349 4.4163c2.1899-3.2306 1.87062-6.2699.87032-8.6457-.75846-1.8013-1.90801-3.2112-2.65683-3.9922z"/>
      <path fill="currentColor" d="m5.7507 23.5094c.07515.012.15135.0192.2281.0215.81383.0244 2.18251.0952 3.29249.2997.90551.1669 2.70051.6687 4.17761 1.1005 1.1271.3294 2.2886-.5707 2.4522-1.7336.1192-.8481.343-1.8075.7553-2.6869l-.0095.0033c-.6982-1.9471-1.5865-3.2044-2.5178-4.0073-.9284-.8004-1.928-1.1738-2.8932-1.3095-1.60474-.2257-3.07497.1961-4.00103.4682.55465 2.3107.38396 5.0295-1.48417 7.8441z"/>
      <path fill="currentColor" d="m17.3708 19.3102c.9267-1.3985 1.5868-2.4862 1.9352-3.0758.1742-.295.1427-.6648-.0638-.9383-.5377-.7126-1.5666-2.1607-2.1272-3.5015-.5764-1.3785-.6624-3.51876-.6673-4.56119-.0019-.39626-.1275-.78328-.3726-1.09465l-3.3311-4.23183c-.0117.19075-.0392.37998-.0788.56747-.1109.52394-.32 1.04552-.5585 1.56101-.1398.30214-.3014.62583-.4646.95284-.1086.21764-.218.4368-.3222.652-.5385 1.11265-1.0397 2.32011-1.1797 3.73901-.1299 1.31514.0478 2.84484.8484 4.67094.1333.0113.2675.0262.4023.0452 1.1488.1615 2.3546.6115 3.4647 1.5685.9541.8226 1.8163 2.0012 2.5152 3.6463z"/>
    </svg>
  );
}

export default StepTools;
