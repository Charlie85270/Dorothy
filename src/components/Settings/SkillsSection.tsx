import { ExternalLink, Sparkles } from 'lucide-react';
import type { Skill } from './types';

interface SkillsSectionProps {
  skills: Skill[];
}

export const SkillsSection = ({ skills }: SkillsSectionProps) => {
  const userSkills = skills.filter(s => s.source === 'user');
  const pluginSkills = skills.filter(s => s.source === 'plugin');
  const projectSkills = skills.filter(s => s.source === 'project');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold mb-1">Skills & Plugins</h2>
          <p className="text-sm text-muted-foreground">Installed skills and plugins for Claude Code</p>
        </div>
        <a
          href="https://skills.sh"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-foreground text-sm hover:bg-secondary/80 transition-colors"
        >
          <span>skills.sh</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* User Skills */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white" />
          User Skills
          <span className="text-muted-foreground">({userSkills.length})</span>
        </h3>
        <div className="space-y-2">
          {userSkills.length > 0 ? (
            userSkills.map((skill) => (
              <div
                key={skill.path}
                className="flex items-center justify-between py-3 px-4 bg-secondary border border-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{skill.name}</p>
                  {skill.description && (
                    <p className="text-xs text-muted-foreground truncate">{skill.description}</p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm py-4">No user skills installed</p>
          )}
        </div>
      </div>

      {/* Plugin Skills */}
      <div className="border border-border bg-card p-6">
        <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-muted-foreground" />
          Plugin Skills
          <span className="text-muted-foreground">({pluginSkills.length})</span>
        </h3>
        <div className="space-y-2">
          {pluginSkills.length > 0 ? (
            pluginSkills.map((skill) => (
              <div
                key={skill.path}
                className="flex items-center justify-between py-3 px-4 bg-secondary border border-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{skill.name}</p>
                  {skill.description && (
                    <p className="text-xs text-muted-foreground truncate">{skill.description}</p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm py-4">No plugin skills installed</p>
          )}
        </div>
      </div>

      {/* Project Skills */}
      {projectSkills.length > 0 && (
        <div className="border border-border bg-card p-6">
          <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            Project Skills
            <span className="text-muted-foreground">({projectSkills.length})</span>
          </h3>
          <div className="space-y-2">
            {projectSkills.map((skill) => (
              <div
                key={skill.path}
                className="flex items-center justify-between py-3 px-4 bg-secondary border border-border"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{skill.name}</p>
                  {skill.projectName && (
                    <p className="text-xs text-muted-foreground truncate">{skill.projectName}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {skills.length === 0 && (
        <div className="border border-border bg-card p-8 text-center">
          <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-3">No skills or plugins installed</p>
          <a
            href="https://skills.sh"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-foreground hover:underline"
          >
            Browse skills on skills.sh
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
};
