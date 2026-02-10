import type { AgentStatus, AgentCharacter } from '@/types/electron';
import type { LayoutItem } from 'react-grid-layout';

export type LayoutPreset = 'single' | '2-col' | '2-row' | '2x2' | '3x2' | '3x3' | 'focus';

export interface GridDefinition {
  cols: number;
  rows: number;
  label: string;
  icon: string; // Unicode grid representation
  maxPanels: number;
}

export type RGLLayoutItem = LayoutItem;

export interface GridCell {
  agentId: string;
  col: number;
  row: number;
  colSpan?: number;
  rowSpan?: number;
}

export interface TerminalPanelState {
  agentId: string;
  isFullscreen: boolean;
  isFocused: boolean;
}

export interface TerminalsViewState {
  layout: LayoutPreset;
  panels: TerminalPanelState[];
  sidebarOpen: boolean;
  broadcastMode: boolean;
  focusedPanelId: string | null;
  fullscreenPanelId: string | null;
  searchQuery: string;
  filterStatus: AgentStatus['status'] | 'all';
  filterProject: string | 'all';
}

export interface TerminalInstance {
  agentId: string;
  terminal: import('xterm').Terminal | null;
  fitAddon: import('xterm-addon-fit').FitAddon | null;
  container: HTMLDivElement | null;
  disposed: boolean;
}

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: string;
}

export interface ContextMenuAction {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
}

export interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
  agentId: string | null;
}

// --- Two-tier tab system ---

export interface CustomTab {
  id: string;           // crypto.randomUUID()
  name: string;         // user-editable
  agentIds: string[];   // ordered list of agents on this tab
  layout: LayoutPreset; // per-tab layout preset
}

export type ActiveTab =
  | { type: 'custom'; tabId: string }
  | { type: 'project'; projectPath: string };

export interface TabManagerState {
  customTabs: CustomTab[];
  activeTab: ActiveTab;
}
