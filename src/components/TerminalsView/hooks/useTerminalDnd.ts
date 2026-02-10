'use client';

import { useCallback } from 'react';
import {
  useSensor,
  useSensors,
  PointerSensor,
  type DragEndEvent,
} from '@dnd-kit/core';

interface UseTerminalDndOptions {
  onSkillDrop?: (skillName: string, agentId: string) => void;
  onAgentReorder?: (agentId: string, newIndex: number) => void;
}

export function useTerminalDnd({ onSkillDrop, onAgentReorder }: UseTerminalDndOptions) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Skill dropped onto a terminal panel
    if (activeData?.type === 'skill' && overData?.type === 'terminal-panel') {
      onSkillDrop?.(activeData.skillName as string, overData.agentId as string);
    }

    // Agent reorder in sidebar
    if (activeData?.type === 'agent' && overData?.type === 'agent') {
      onAgentReorder?.(active.id as string, overData.index as number);
    }
  }, [onSkillDrop, onAgentReorder]);

  return {
    sensors,
    handleDragEnd,
  };
}
