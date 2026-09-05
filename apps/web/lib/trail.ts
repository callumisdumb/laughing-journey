'use client';

import { create } from 'zustand';

/**
 * Where you have been, and where you were before that.
 *
 * The product is a web of records now rather than a set of screens: a name on a meeting minute is a
 * link into a person, a reference on a person is a link into a process, a practitioner on a case is
 * a link into their card. That is the right shape, and it is also how people get lost. Two things
 * answer it, and they answer different questions.
 *
 * The **trail** answers "how did I get here", as a list of the records passed through on the way to
 * this one, most recent last. It is a path and not a history: revisiting a record earlier in the
 * trail truncates back to it rather than adding a second entry, so a loop does not become a queue.
 *
 * **Recently viewed** answers "what was I working on", across the whole session and in view order,
 * most recent first. It survives navigating away and it deduplicates by record.
 *
 * Neither is persisted. A trail restored from local storage after a week claims a journey that did
 * not happen, and recently-viewed is a list of the people whose records this account opened, which
 * is not something to leave on a shared council laptop for the next person to read.
 */
export type TrailKind = 'person' | 'process' | 'meeting' | 'practitioner';

export interface TrailEntry {
  kind: TrailKind;
  id: string;
  label: string;
  path: string;
}

const RECENT_LIMIT = 12;
/** Long enough to show the way back from a chain of links, short enough to read in one line. */
const TRAIL_LIMIT = 6;

interface TrailState {
  trail: TrailEntry[];
  recent: TrailEntry[];
  visit: (entry: TrailEntry) => void;
  clear: () => void;
}

function sameRecord(a: TrailEntry, b: TrailEntry): boolean {
  return a.kind === b.kind && a.id === b.id;
}

export const useTrail = create<TrailState>((set, get) => ({
  trail: [],
  recent: [],
  visit: (entry) => {
    const { trail, recent } = get();
    const last = trail[trail.length - 1];
    if (last && sameRecord(last, entry)) return;

    // Arriving somewhere already on the trail means going back, not going deeper.
    const seen = trail.findIndex((e) => sameRecord(e, entry));
    const next = seen >= 0 ? trail.slice(0, seen + 1) : [...trail, entry].slice(-TRAIL_LIMIT);

    set({
      trail: next,
      recent: [entry, ...recent.filter((e) => !sameRecord(e, entry))].slice(0, RECENT_LIMIT),
    });
  },
  clear: () => set({ trail: [], recent: [] }),
}));
