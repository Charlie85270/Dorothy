'use client';
import { useRef, useCallback } from 'react';
import { GameState, PlayerState, NPC, Direction, Building } from '../types';
import { PLAYER_START, BUILDINGS } from '../constants';

function createInitialPlayer(): PlayerState {
  return {
    x: PLAYER_START.x,
    y: PLAYER_START.y,
    targetX: PLAYER_START.x,
    targetY: PLAYER_START.y,
    direction: 'up' as Direction,
    isMoving: false,
    moveProgress: 0,
    animFrame: 0,
  };
}

function createInitialState(): GameState {
  return {
    screen: 'title',
    player: createInitialPlayer(),
    npcs: [],
    buildings: BUILDINGS,
    interacting: null,
    dialogueText: null,
    dialogueQueue: [],
    assetsLoaded: false,
    showInteractionPrompt: false,
    titleStarted: false,
  };
}

export function useGameState() {
  const stateRef = useRef<GameState>(createInitialState());

  const getState = useCallback(() => stateRef.current, []);

  const setState = useCallback((updater: (prev: GameState) => Partial<GameState>) => {
    const updates = updater(stateRef.current);
    stateRef.current = { ...stateRef.current, ...updates };
  }, []);

  const updatePlayer = useCallback((updater: (prev: PlayerState) => Partial<PlayerState>) => {
    const updates = updater(stateRef.current.player);
    stateRef.current = {
      ...stateRef.current,
      player: { ...stateRef.current.player, ...updates },
    };
  }, []);

  const setScreen = useCallback((screen: GameState['screen']) => {
    stateRef.current = { ...stateRef.current, screen };
  }, []);

  const setNPCs = useCallback((npcs: NPC[]) => {
    stateRef.current = { ...stateRef.current, npcs };
  }, []);

  const startDialogue = useCallback((lines: string[]) => {
    if (lines.length === 0) return;
    stateRef.current = {
      ...stateRef.current,
      dialogueText: lines[0],
      dialogueQueue: lines.slice(1),
    };
  }, []);

  const advanceDialogue = useCallback((): boolean => {
    const state = stateRef.current;
    if (state.dialogueQueue.length > 0) {
      stateRef.current = {
        ...state,
        dialogueText: state.dialogueQueue[0],
        dialogueQueue: state.dialogueQueue.slice(1),
      };
      return true;
    }
    stateRef.current = {
      ...state,
      dialogueText: null,
      dialogueQueue: [],
      interacting: null,
    };
    return false;
  }, []);

  const setInteracting = useCallback((target: NPC | Building | null) => {
    stateRef.current = { ...stateRef.current, interacting: target };
  }, []);

  return {
    getState,
    setState,
    updatePlayer,
    setScreen,
    setNPCs,
    startDialogue,
    advanceDialogue,
    setInteracting,
  };
}
