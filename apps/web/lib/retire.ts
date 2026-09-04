'use client';

import { create } from 'zustand';
import type { Collection } from '@/lib/store';

export interface RetireTarget {
  collection: Collection;
  id: string;
  /** What is being retired, for the dialog's heading. */
  label: string;
}

interface RetireState {
  target: RetireTarget | null;
  retire: (target: RetireTarget) => void;
  clear: () => void;
}

/**
 * What the retire dialog is pointed at, held above the screens rather than inside one.
 *
 * The reason is the toast. A record created in a dialog can be sent to the correction path from the
 * toast that announces it, and by then the dialog that made it has closed and unmounted. So the
 * dialog is mounted once, at the root, and anything that wants it sets a target.
 */
export const useRetire = create<RetireState>((set) => ({
  target: null,
  retire: (target) => set({ target }),
  clear: () => set({ target: null }),
}));
