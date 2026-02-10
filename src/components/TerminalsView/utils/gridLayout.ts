import type { LayoutItem } from 'react-grid-layout';

/** Generate a default left-to-right, top-to-bottom layout for the given panel IDs. */
export function generateLayout(panelIds: string[], cols: number): LayoutItem[] {
  return panelIds.map((id, idx) => ({
    i: id,
    x: idx % cols,
    y: Math.floor(idx / cols),
    w: 1,
    h: 1,
  }));
}

/** Check if every item in the layout fits within the grid bounds (cols AND rows). */
export function isLayoutCompatible(layout: LayoutItem[], cols: number, rows: number): boolean {
  return layout.every(item =>
    item.x >= 0 && item.x + item.w <= cols &&
    item.y >= 0 && item.y + item.h <= rows
  );
}

/** Structural equality check for two layouts. */
export function layoutsEqual(a: readonly LayoutItem[], b: readonly LayoutItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i], bi = b[i];
    if (ai.i !== bi.i || ai.x !== bi.x || ai.y !== bi.y || ai.w !== bi.w || ai.h !== bi.h) {
      return false;
    }
  }
  return true;
}

/**
 * Merge a saved layout with the current set of visible panel IDs.
 * - Keeps saved positions for panels that still exist
 * - Appends new panels after existing ones
 * - Drops panels that are no longer visible
 * - Falls back to generateLayout if saved is null or incompatible
 */
export function mergeLayoutWithPanels(
  saved: LayoutItem[] | null,
  visibleIds: string[],
  cols: number,
  rows: number,
): LayoutItem[] {
  if (saved && saved.length > 0 && isLayoutCompatible(saved, cols, rows)) {
    const visibleIdSet = new Set(visibleIds);
    const validSaved = saved.filter(item => visibleIdSet.has(item.i));

    if (validSaved.length > 0) {
      const savedIdSet = new Set(validSaved.map(item => item.i));
      const newIds = visibleIds.filter(id => !savedIdSet.has(id));
      const maxY = Math.max(0, ...validSaved.map(item => item.y + item.h));
      const newItems: LayoutItem[] = newIds.map((id, i) => ({
        i: id,
        x: (validSaved.length + i) % cols,
        y: maxY + Math.floor((validSaved.length + i) / cols),
        w: 1,
        h: 1,
      }));
      return [...validSaved, ...newItems];
    }
  }
  return generateLayout(visibleIds, cols);
}
