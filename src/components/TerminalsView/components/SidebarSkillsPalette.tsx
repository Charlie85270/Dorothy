'use client';

import { useState, useMemo } from 'react';
import { Search, GripVertical, Sparkles } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';

function DraggableSkillItem({ skillName }: { skillName: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `skill-${skillName}`,
    data: { type: 'skill', skillName },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`
        flex items-center gap-2 px-2.5 py-2 cursor-grab active:cursor-grabbing transition-all
        hover:bg-primary/5
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      <GripVertical className="w-3 h-3 text-muted-foreground shrink-0" />
      <p className="text-xs text-foreground truncate flex-1 min-w-0">{skillName}</p>
    </div>
  );
}

interface SidebarSkillsPaletteProps {
  installedSkills: string[];
}

export default function SidebarSkillsPalette({ installedSkills }: SidebarSkillsPaletteProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query) return installedSkills;
    const q = query.toLowerCase();
    return installedSkills.filter(s => s.toLowerCase().includes(q));
  }, [query, installedSkills]);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-2">
        <div className="relative">
          <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search installed skills..."
            className="w-full pl-7 pr-2 py-1.5 bg-secondary border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-border"
          />
        </div>
      </div>

      {/* Skills list */}
      <div className="flex-1 overflow-y-auto">
        {installedSkills.length > 0 && (
          <p className="px-2.5 py-1 text-[10px] text-muted-foreground">
            Drag a skill onto a terminal to use it
          </p>
        )}
        {filtered.map(name => (
          <DraggableSkillItem key={name} skillName={name} />
        ))}
        {installedSkills.length === 0 && (
          <div className="p-4 text-center">
            <Sparkles className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No skills installed</p>
            <p className="text-[10px] text-muted-foreground mt-1">Install skills from the Skills page</p>
          </div>
        )}
        {installedSkills.length > 0 && filtered.length === 0 && (
          <p className="p-4 text-center text-xs text-muted-foreground">No matching skills</p>
        )}
      </div>
    </div>
  );
}
