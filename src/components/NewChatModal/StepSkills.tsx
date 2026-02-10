import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sparkles,
  Search,
  Check,
  ChevronDown,
  ChevronRight,
  Filter,
  Download,
  CheckCircle,
} from 'lucide-react';
import { SKILLS_DATABASE, SKILL_CATEGORIES, type Skill } from '@/lib/skills-database';
import type { ClaudeSkill } from '@/lib/claude-code';

interface StepSkillsProps {
  selectedSkills: string[];
  onToggleSkill: (name: string) => void;
  allInstalledSkills: ClaudeSkill[];
  installedSkillSet: Set<string>;
  onInstallSkill: (skill: Skill) => void;
}

// Source label/color config hoisted outside render
const SOURCE_LABELS: Record<string, string> = {
  project: 'Project Skills',
  user: 'User Skills',
  plugin: 'Plugin Skills',
};

const SOURCE_COLORS: Record<string, { bg: string; text: string; selected: string }> = {
  project: { bg: 'bg-accent-purple/10', text: 'text-accent-purple', selected: 'bg-accent-purple/30 border-accent-purple' },
  user: { bg: 'bg-accent-blue/10', text: 'text-accent-blue', selected: 'bg-accent-blue/30 border-accent-blue' },
  plugin: { bg: 'bg-accent-amber/10', text: 'text-accent-amber', selected: 'bg-accent-amber/30 border-accent-amber' },
};

const INITIAL_EXPANDED = ['Frontend', 'Development', 'Design'];

const StepSkills = React.memo(function StepSkills({
  selectedSkills,
  onToggleSkill,
  allInstalledSkills,
  installedSkillSet,
  onInstallSkill,
}: StepSkillsProps) {
  // Local state — filter/search/expand state is only needed here
  const [skillSearch, setSkillSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(INITIAL_EXPANDED);

  const isSkillInstalled = (name: string) => installedSkillSet.has(name.toLowerCase());

  const filteredSkills = useMemo(() => {
    let skills = SKILLS_DATABASE;

    if (skillSearch) {
      const q = skillSearch.toLowerCase();
      skills = skills.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.repo.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      );
    }

    if (selectedCategory) {
      skills = skills.filter((s) => s.category === selectedCategory);
    }

    return skills;
  }, [skillSearch, selectedCategory]);

  const skillsByCategory = useMemo(() => {
    const grouped: Record<string, Skill[]> = {};
    for (const skill of filteredSkills) {
      if (!grouped[skill.category]) {
        grouped[skill.category] = [];
      }
      grouped[skill.category].push(skill);
    }
    return grouped;
  }, [filteredSkills]);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  return (
    <div className="space-y-4">
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

      {/* Selected Skills */}
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

      {/* Installed Skills Section */}
      {allInstalledSkills.length > 0 && (
        <div className="rounded-none border border-accent-green/30 bg-accent-green/5 p-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2 text-accent-green">
            <CheckCircle className="w-4 h-4" />
            Your Installed Skills ({allInstalledSkills.length})
          </h4>
          <div className="space-y-3">
            {(['project', 'user', 'plugin'] as const).map((sourceType) => {
              const sourceSkills = allInstalledSkills.filter(s => s.source === sourceType);
              if (sourceSkills.length === 0) return null;

              const colors = SOURCE_COLORS[sourceType];

              return (
                <div key={sourceType}>
                  <p className="text-xs text-text-muted mb-2">{SOURCE_LABELS[sourceType]} ({sourceSkills.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {sourceSkills.map((skill, idx) => {
                      const isSelected = selectedSkills.includes(skill.name);
                      return (
                        <button
                          key={`${skill.source}-${skill.name}-${idx}`}
                          onClick={() => onToggleSkill(skill.name)}
                          className={`
                            flex items-center gap-2 px-3 py-1.5 rounded-none text-sm transition-all border
                            ${isSelected
                              ? colors.selected
                              : `${colors.bg} ${colors.text} border-transparent hover:border-current`
                            }
                          `}
                          title={skill.description || skill.path}
                        >
                          {isSelected ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          <span>{skill.name}</span>
                          {skill.projectName && (
                            <span className="text-xs opacity-60">({skill.projectName})</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search & Filter for Marketplace */}
      <div className="pt-2 border-t border-border-primary">
        <p className="text-xs text-text-muted mb-3">Or browse the skills marketplace to install new skills:</p>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={skillSearch}
              onChange={(e) => setSkillSearch(e.target.value)}
              placeholder="Search skills marketplace..."
              className="w-full pl-10 pr-4 py-2 rounded-none text-sm"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setSelectedCategory(selectedCategory ? null : SKILL_CATEGORIES[0])}
              className="flex items-center gap-2 px-4 py-2 rounded-none bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
            >
              <Filter className="w-4 h-4" />
              {selectedCategory || 'All'}
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Skills by Category from Marketplace */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
        {Object.entries(skillsByCategory).map(([category, skills]) => (
          <div key={category} className="border border-border-primary rounded-none overflow-hidden">
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between px-4 py-3 bg-bg-tertiary/50 hover:bg-bg-tertiary transition-colors"
            >
              <span className="font-medium text-sm flex items-center gap-2">
                {expandedCategories.includes(category) ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                {category}
              </span>
              <span className="text-xs text-text-muted">{skills.length} skills</span>
            </button>

            <AnimatePresence>
              {expandedCategories.includes(category) && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {skills.map((skill) => {
                      const isSelected = selectedSkills.includes(skill.name);
                      const installed = isSkillInstalled(skill.name);
                      return (
                        <div
                          key={skill.name}
                          className={`
                            text-left p-3 rounded-none transition-all
                            ${isSelected
                              ? 'bg-accent-purple/20 border-accent-purple/50'
                              : installed
                              ? 'bg-bg-secondary/50 hover:bg-bg-tertiary border-transparent'
                              : 'bg-bg-secondary/30 border-border-primary/50'
                            }
                            border
                          `}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`font-medium text-sm ${!installed ? 'text-text-muted' : ''}`}>
                              {skill.name}
                            </span>
                            {installed ? (
                              isSelected ? (
                                <Check className="w-4 h-4 text-accent-purple" />
                              ) : (
                                <span className="text-xs text-accent-green px-1.5 py-0.5 rounded bg-accent-green/10">
                                  Installed
                                </span>
                              )
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onInstallSkill(skill);
                                }}
                                className="flex items-center gap-1 text-xs text-accent-blue px-2 py-1 rounded bg-accent-blue/10 hover:bg-accent-blue/20 transition-colors"
                              >
                                <Download className="w-3 h-3" />
                                Install
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-text-muted mt-1 font-mono">{skill.repo}</p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-accent-blue">{skill.installs} installs</p>
                            {installed && (
                              <button
                                onClick={() => onToggleSkill(skill.name)}
                                className={`text-xs px-2 py-0.5 rounded transition-colors ${
                                  isSelected
                                    ? 'bg-accent-purple/20 text-accent-purple'
                                    : 'bg-bg-tertiary text-text-muted hover:text-text-primary'
                                }`}
                              >
                                {isSelected ? 'Remove' : 'Add'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
});

export default StepSkills;
