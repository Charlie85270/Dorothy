import type { AgentCharacter } from '@/types/electron';

export const CHARACTER_OPTIONS: { id: AgentCharacter; emoji: string; name: string; description: string }[] = [
  { id: 'robot', emoji: '🤖', name: 'Robot', description: 'Classic AI assistant' },
  { id: 'ninja', emoji: '🥷', name: 'Ninja', description: 'Stealthy and efficient' },
  { id: 'wizard', emoji: '🧙', name: 'Wizard', description: 'Magical problem solver' },
  { id: 'astronaut', emoji: '👨‍🚀', name: 'Astronaut', description: 'Space explorer' },
  { id: 'knight', emoji: '⚔️', name: 'Knight', description: 'Noble defender' },
  { id: 'pirate', emoji: '🏴‍☠️', name: 'Pirate', description: 'Adventurous coder' },
  { id: 'alien', emoji: '👽', name: 'Alien', description: 'Out of this world' },
  { id: 'viking', emoji: '🪓', name: 'Viking', description: 'Fearless warrior' },
];
