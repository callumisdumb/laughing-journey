'use client';

import type { Agency, EventFamily, LensId, Significance, Visibility } from '@mas/domain';
import { create } from 'zustand';

export type ChronologyView = 'single' | 'integrated' | 'pack';

export interface Window {
  from: string;
  to: string;
}

export interface ChronologyFilters {
  agencies: Agency[];
  families: EventFamily[];
  significance: Significance[];
  processId: string | null;
  source: 'all' | 'manual' | 'connector';
  visibility: Visibility[];
}

interface ChronologyState {
  personId: string | null;
  view: ChronologyView;
  window: Window | null;
  selectedEventId: string | null;
  selectedAnalysisId: string | null;
  lenses: LensId[];
  filters: ChronologyFilters;
  reset: (personId: string) => void;
  setView: (v: ChronologyView) => void;
  setWindow: (w: Window | null) => void;
  select: (eventId: string | null) => void;
  selectAnalysis: (id: string | null) => void;
  toggleLens: (id: LensId) => void;
  setFilters: (f: Partial<ChronologyFilters>) => void;
}

const EMPTY_FILTERS: ChronologyFilters = { agencies: [], families: [], significance: [], processId: null, source: 'all', visibility: [] };

export const useChronologyStore = create<ChronologyState>((set, get) => ({
  personId: null,
  view: 'integrated',
  window: null,
  selectedEventId: null,
  selectedAnalysisId: null,
  lenses: [],
  filters: EMPTY_FILTERS,
  reset: (personId) => {
    if (get().personId === personId) return;
    set({ personId, view: 'integrated', window: null, selectedEventId: null, selectedAnalysisId: null, lenses: [], filters: EMPTY_FILTERS });
  },
  setView: (view) => set({ view }),
  setWindow: (window) => set({ window }),
  select: (selectedEventId) => set({ selectedEventId, selectedAnalysisId: null }),
  selectAnalysis: (selectedAnalysisId) => set({ selectedAnalysisId, selectedEventId: null }),
  toggleLens: (id) => set({ lenses: get().lenses.includes(id) ? get().lenses.filter((l) => l !== id) : [...get().lenses, id] }),
  setFilters: (f) => set({ filters: { ...get().filters, ...f } }),
}));
