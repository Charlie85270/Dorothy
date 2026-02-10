import type { LayoutItem } from 'react-grid-layout';
import type { LayoutPreset } from '../types';
import { isLayoutCompatible } from '../utils/gridLayout';

const STORAGE_KEY = 'terminals-grid-layouts';
const OLD_KEY_PREFIX = 'terminals-rgl-tab-';

type LayoutStore = Record<string, Partial<Record<LayoutPreset, LayoutItem[]>>>;

/** One-time migration: move old per-key layouts into the new nested structure. */
function migrateOldKeys(): LayoutStore | null {
  if (typeof window === 'undefined') return null;
  const store: LayoutStore = {};
  let found = false;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(OLD_KEY_PREFIX)) continue;
    found = true;
    // key format: terminals-rgl-tab-{tabId}-{preset}
    const rest = key.slice(OLD_KEY_PREFIX.length);
    const lastDash = rest.lastIndexOf('-');
    if (lastDash === -1) continue;
    // preset names can contain dashes (e.g. '2-col', '3x2'), so split from the end
    // Actually, preset names are: single, 2-col, 2-row, 2x2, 3x2, 3x3, focus
    // The tabId is a UUID (contains dashes). We need to find where the tabId ends.
    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars)
    // So tabId is the first 36 chars, preset is the rest after the dash.
    if (rest.length > 37) {
      const tabId = rest.slice(0, 36);
      const preset = rest.slice(37) as LayoutPreset;
      try {
        const data = localStorage.getItem(key);
        if (data) {
          if (!store[tabId]) store[tabId] = {};
          store[tabId][preset] = JSON.parse(data);
        }
      } catch { /* ignore */ }
    }
  }
  if (!found) return null;
  // Clean up old keys
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(OLD_KEY_PREFIX)) keysToRemove.push(key);
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
  return store;
}

function readStore(): LayoutStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as LayoutStore;
    // Try migrating old keys on first read
    const migrated = migrateOldKeys();
    if (migrated) {
      writeStore(migrated);
      return migrated;
    }
  } catch { /* ignore */ }
  return {};
}

function writeStore(store: LayoutStore) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch { /* ignore */ }
}

/** Read and validate a saved layout. Returns null if missing or out of bounds. */
export function getLayout(
  tabId: string,
  preset: LayoutPreset,
  cols: number,
  rows: number,
): LayoutItem[] | null {
  const store = readStore();
  const layouts = store[tabId]?.[preset];
  if (!layouts || layouts.length === 0) return null;
  if (!isLayoutCompatible(layouts, cols, rows)) return null;
  return layouts;
}

/** Persist a layout into the nested store structure. */
export function saveLayout(tabId: string, preset: LayoutPreset, layout: LayoutItem[]) {
  const store = readStore();
  if (!store[tabId]) store[tabId] = {};
  store[tabId][preset] = layout;
  writeStore(store);
}

/** Remove all saved layouts for a deleted tab. */
export function deleteTabLayouts(tabId: string) {
  const store = readStore();
  if (store[tabId]) {
    delete store[tabId];
    writeStore(store);
  }
}
