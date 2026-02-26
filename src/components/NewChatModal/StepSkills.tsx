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
} from 'lucide-react';
import { SKILLS_DATABASE, SKILL_CATEGORIES, type Skill } from '@/lib/skills-database';
import type { ClaudeSkill } from '@/lib/claude-code';
import type { AgentProvider } from '@/types/electron';
import ProviderBadge from '@/components/ProviderBadge';

interface StepSkillsProps {
  selectedSkills: string[];
  onToggleSkill: (name: string) => void;
  allInstalledSkills: ClaudeSkill[];
  installedSkillSet: Set<string>;
  onInstallSkill: (skill: Skill) => void;
  provider: AgentProvider;
  installedSkillsByProvider: Record<string, string[]>;
}

const PROVIDER_IDS = ['claude', 'codex', 'gemini'] as const;

const StepSkills = React.memo(function StepSkills({
  selectedSkills,
  onToggleSkill,
  allInstalledSkills,
  installedSkillSet,
  onInstallSkill,
  provider,
  installedSkillsByProvider,
}: StepSkillsProps) {
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

  // Is a skill installed on ANY provider (for global "installed" check)
  const isSkillInstalledAnywhere = useCallback(
    (name: string): boolean => {
      for (const skills of Object.values(installedSkillsByProvider)) {
        if (skills.some(s => s.toLowerCase() === name.toLowerCase())) return true;
      }
      return false;
    },
    [installedSkillsByProvider]
  );

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium mb-1 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent-purple" />
            Assign Skills
          </h3>
          <p className="text-text-secondary text-sm">
            Select skills to enhance your agent (optional)
          </p>
        </div>
        <div className="text-sm text-accent-purple">
          {selectedSkills.length} selected
        </div>
      </div>

      {/* Selected Skills Chips */}
      {selectedSkills.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 rounded-none bg-accent-purple/10 border border-accent-purple/20">
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
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={skillSearch}
            onChange={(e) => setSkillSearch(e.target.value)}
            placeholder="Search skills..."
            className="w-full pl-10 pr-4 py-2 rounded-none text-sm"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setShowCategoryDropdown(prev => !prev)}
            className="flex items-center gap-2 px-4 py-2 rounded-none bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
          >
            <Filter className="w-4 h-4" />
            {selectedCategory || 'All'}
            <ChevronDown className="w-4 h-4" />
          </button>
          {showCategoryDropdown && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border shadow-lg min-w-[160px]">
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

      {/* Skills Table */}
      <div className="border border-border bg-card overflow-hidden flex flex-col max-h-[400px]">
        <table className="w-full">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-secondary">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground w-10">#</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Skill</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Category</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Installs</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Action</th>
            </tr>
          </thead>
        </table>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <tbody>
              {filteredSkills.map((skill) => {
                const isSelected = selectedSkills.includes(skill.name);
                const installedOnProvider = isSkillInstalled(skill.name);
                const installedAnywhere = isSkillInstalledAnywhere(skill.name);

                return (
                  <tr
                    key={`${skill.repo}-${skill.name}`}
                    className={`border-b border-border/50 transition-colors ${isSelected ? 'bg-accent-purple/5' : 'hover:bg-secondary/50'}`}
                  >
                    <td className="px-4 py-3 text-xs text-muted-foreground w-10">
                      {skill.rank}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 flex items-center justify-center shrink-0 ${installedAnywhere ? 'bg-primary/10' : 'bg-secondary'}`}>
                          {installedAnywhere ? (
                            <CheckCircle className="w-4 h-4 text-primary" />
                          ) : (
                            <Package className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-sm">{skill.name}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            {PROVIDER_IDS.map(id =>
                              isSkillInstalledOn(skill.name, id) ? (
                                <ProviderBadge key={id} provider={id} />
                              ) : null
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs px-2 py-1 bg-secondary text-muted-foreground">
                        {skill.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">{skill.installs}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {installedOnProvider ? (
                        <button
                          onClick={() => onToggleSkill(skill.name)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                            isSelected
                              ? 'bg-accent-purple/15 text-accent-purple'
                              : 'bg-foreground text-background hover:bg-foreground/90'
                          }`}
                          style={{ borderRadius: 5 }}
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
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors"
                          style={{ borderRadius: 5 }}
                        >
                          <Download className="w-3 h-3" />
                          Install
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

export default StepSkills;
