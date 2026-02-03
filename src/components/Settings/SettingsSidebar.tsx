import { ChevronRight } from 'lucide-react';
import { SECTIONS } from './constants';
import type { SettingsSection } from './types';

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

export const SettingsSidebar = ({ activeSection, onSectionChange }: SettingsSidebarProps) => {
  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="w-48 shrink-0 hidden lg:block">
        <div className="space-y-1">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => onSectionChange(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-secondary text-foreground border-l-2 border-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{section.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Section Selector */}
      <div className="lg:hidden mb-4 shrink-0">
        <select
          value={activeSection}
          onChange={(e) => onSectionChange(e.target.value as SettingsSection)}
          className="w-full px-3 py-2 bg-secondary border border-border text-sm"
        >
          {SECTIONS.map((section) => (
            <option key={section.id} value={section.id}>
              {section.label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
};
