'use client';

import { create } from 'zustand';

export type SelectionKind = 'person' | 'process' | 'event' | 'meeting' | 'action' | 'share' | 'connector-event' | 'analysis';

export interface Selection {
  kind: SelectionKind;
  id: string;
  /** Optional context, e.g. the process the event is being viewed under. */
  processId?: string;
  personId?: string;
}

interface SelectionState {
  selection: Selection | null;
  select: (s: Selection | null) => void;
}

/** What the context drawer is looking at. Screens set it; the drawer reads it. */
export const useSelection = create<SelectionState>((set) => ({
  selection: null,
  select: (selection) => set({ selection }),
}));
