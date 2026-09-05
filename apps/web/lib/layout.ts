'use client';

import { useSyncExternalStore } from 'react';
import { create } from 'zustand';

/**
 * Four layout modes, chosen by viewport width, named rather than implied.
 *
 * The layout used to break below 1440 for one reason: the grid column widths came from media queries
 * and the components' own states came from the appearance store, so the two could disagree and did.
 * At 1100px the rail's column was 72px wide while the rail still rendered its expanded contents,
 * which want 125px. That is not a collapsed rail, it is a clipped one, and the difference is visible
 * to anyone who looks: labels sliced down the middle rather than replaced by icons. The drawer had
 * the mirror of it, holding 360px at an 800px viewport and leaving 368px for the record.
 *
 * So width picks one mode, the mode is written to `data-layout` on the shell, and both the grid and
 * every component read that one attribute. They cannot disagree, because there is nothing left to
 * disagree about. The boundaries live here and nowhere else: the stylesheet carries no media query
 * for layout, only `[data-layout='...']` selectors, so a breakpoint cannot be changed in one place
 * and missed in the other.
 */
export const LAYOUT_MODES = ['wide', 'standard', 'compact', 'narrow'] as const;
export type LayoutMode = (typeof LAYOUT_MODES)[number];

/**
 * The lower bound of each mode, in CSS pixels.
 *
 * 1600 is where a docked drawer and a full main column both fit without the record's own columns
 * dropping to one. 1280 is the width below which an expanded 248px rail and a 360px drawer leave the
 * record less than half the screen, which is the wrong half. 1024 is the smallest width the brief
 * asks a desktop screen to work at, and below it the chrome gets out of the way entirely: that is
 * also what carries WCAG 2.2 1.4.10, where a 1280px viewport at 400 percent zoom is a 320px one.
 */
export const LAYOUT_MIN_WIDTH = {
  wide: 1600,
  standard: 1280,
  compact: 1024,
  narrow: 0,
} as const satisfies Record<LayoutMode, number>;

/** How the rail renders in each mode. `overlay` means it is off-canvas until asked for. */
export const RAIL_STATE = {
  wide: 'expanded',
  standard: 'expanded',
  compact: 'icons',
  narrow: 'overlay',
} as const satisfies Record<LayoutMode, 'expanded' | 'icons' | 'overlay'>;

/** How the context drawer renders. `docked` is a third column; `overlay` is a panel over the record. */
export const DRAWER_STATE = {
  wide: 'docked',
  standard: 'docked',
  compact: 'overlay',
  narrow: 'overlay',
} as const satisfies Record<LayoutMode, 'docked' | 'overlay'>;

export function layoutModeFor(width: number): LayoutMode {
  if (width >= LAYOUT_MIN_WIDTH.wide) return 'wide';
  if (width >= LAYOUT_MIN_WIDTH.standard) return 'standard';
  if (width >= LAYOUT_MIN_WIDTH.compact) return 'compact';
  return 'narrow';
}

function currentMode(): LayoutMode {
  if (typeof window === 'undefined') return 'standard';
  return layoutModeFor(window.innerWidth);
}

/**
 * Subscribed through `matchMedia` rather than a resize listener, so the callback fires when the mode
 * changes and not on every pixel of a drag. Three queries, one per boundary, because a mode change
 * is the only thing anything here cares about.
 */
function subscribe(onChange: () => void): () => void {
  const queries = [LAYOUT_MIN_WIDTH.wide, LAYOUT_MIN_WIDTH.standard, LAYOUT_MIN_WIDTH.compact].map((min) =>
    window.matchMedia(`(min-width: ${min}px)`),
  );
  for (const q of queries) q.addEventListener('change', onChange);
  return () => {
    for (const q of queries) q.removeEventListener('change', onChange);
  };
}

/**
 * The mode this render should use. `standard` on the server, which is what the boot script writes
 * before paint too, so the first painted frame and the first React frame agree.
 */
export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore<LayoutMode>(subscribe, currentMode, () => 'standard');
}

export function applyLayoutMode(mode: LayoutMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.layout = mode;
}

/**
 * Written into the document head so the shell is laid out correctly in the first painted frame,
 * mirroring the appearance boot script. Without it a compact viewport paints the wide layout once
 * and reflows, which on a projector during a demonstration is the first thing the room sees.
 */
export const LAYOUT_BOOT_SCRIPT = `(function(){try{var w=window.innerWidth;document.documentElement.dataset.layout=w>=${LAYOUT_MIN_WIDTH.wide}?'wide':w>=${LAYOUT_MIN_WIDTH.standard}?'standard':w>=${LAYOUT_MIN_WIDTH.compact}?'compact':'narrow';}catch(e){}})();`;

/**
 * The two overlay panels' open state.
 *
 * Deliberately not in the appearance store: that one persists everything it holds to local storage,
 * and an overlay that reopens itself on the next visit because it was open when you closed the tab
 * is not a preference, it is a bug. Deliberately not React state in the shell either, because the
 * buttons that open these live in the top bar and the panels live beside the rail, and threading a
 * setter between them through props would put layout plumbing into every component in the middle.
 */
interface ChromeState {
  railOverlayOpen: boolean;
  drawerOverlayOpen: boolean;
  setRailOverlayOpen: (v: boolean) => void;
  setDrawerOverlayOpen: (v: boolean) => void;
}

export const useChrome = create<ChromeState>((set) => ({
  railOverlayOpen: false,
  drawerOverlayOpen: false,
  setRailOverlayOpen: (railOverlayOpen) => set({ railOverlayOpen }),
  setDrawerOverlayOpen: (drawerOverlayOpen) => set({ drawerOverlayOpen }),
}));
