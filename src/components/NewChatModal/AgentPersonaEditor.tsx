import React, { useState, useRef } from 'react';
import { User } from 'lucide-react';
import type { AgentCharacter } from '@/types/electron';
import type { AgentPersonaValues } from './types';
import { CHARACTER_OPTIONS } from './constants';

const AgentPersonaEditor = React.memo(function AgentPersonaEditor({
  projectPath,
  onChange,
  initialCharacter,
}: {
  projectPath: string;
  onChange: (v: AgentPersonaValues) => void;
  initialCharacter?: AgentCharacter;
}) {
  const [character, setCharacter] = useState<AgentCharacter>(initialCharacter || 'robot');
  const [name, setName] = useState('');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const handleCharacterChange = (id: AgentCharacter) => {
    setCharacter(id);
    onChangeRef.current({ character: id, name });
  };

  const handleNameChange = (value: string) => {
    setName(value);
    onChangeRef.current({ character, name: value });
  };

  const projectName = projectPath.split('/').pop() || 'project';
  const charLabel = CHARACTER_OPTIONS.find(c => c.id === character)?.name || 'Agent';

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2 flex items-center gap-2">
          <User className="w-4 h-4 text-accent-purple" />
          Agent Persona
        </label>
        <div className="grid grid-cols-4 gap-2">
          {CHARACTER_OPTIONS.map((char) => (
            <button
              key={char.id}
              onClick={() => handleCharacterChange(char.id)}
              className={`
                p-3 rounded-none border transition-all text-center
                ${character === char.id
                  ? 'border-accent-purple bg-accent-purple/10'
                  : 'border-border-primary hover:border-border-accent bg-bg-tertiary/30'
                }
              `}
            >
              <span className="text-2xl block mb-1">{char.emoji}</span>
              <span className="text-xs font-medium block">{char.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Agent Name (optional)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder={`${charLabel} on ${projectName}`}
          className="w-full px-4 py-2 rounded-none text-sm bg-bg-primary border border-border-primary focus:border-accent-blue focus:outline-none"
        />
      </div>
    </div>
  );
});

export default AgentPersonaEditor;
