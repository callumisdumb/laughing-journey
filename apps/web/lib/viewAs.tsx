'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Who a subtree is being drawn for, when that is not the person signed in.
 *
 * The two-persona view renders the same record twice in one window, and the panels have to be the
 * real screens: a second implementation that showed what the rules would say is an assertion, and
 * the whole point of the view is that it is a demonstration rather than an assertion.
 *
 * So the override is here rather than in the store. The store holds one session, which is correct,
 * and a panel is not a session: it is the same session looking at what somebody else would see.
 * `useCurrentUser` reads this first, which is why every screen works inside a panel without knowing
 * a panel exists.
 */
const ViewAsContext = createContext<string | null>(null);

export function ViewAs({ userId, children }: { userId: string; children: ReactNode }) {
  return <ViewAsContext.Provider value={userId}>{children}</ViewAsContext.Provider>;
}

/** The persona this subtree is drawn for, or null when it is the signed-in one. */
export function useViewAs(): string | null {
  return useContext(ViewAsContext);
}
