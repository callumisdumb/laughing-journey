'use client';

import { useEffect, type ReactNode } from 'react';
import { useAppearance } from '@/lib/appearance';
import { DRAWER_STATE, RAIL_STATE, applyLayoutMode, useChrome, useLayoutMode } from '@/lib/layout';
import { useRoute } from '@/lib/router';
import { ContextDrawer, ContextDrawerOverlay } from './ContextDrawer';
import { Rail, RailOverlay } from './Rail';
import { TopBar } from './TopBar';

export function AppShell({ children }: { children: ReactNode }) {
  const railCollapsed = useAppearance((s) => s.railCollapsed);
  const drawerCollapsed = useAppearance((s) => s.drawerCollapsed);
  const mode = useLayoutMode();
  // Selected field by field. `useChrome()` with no selector returns the whole store object, which
  // Zustand replaces on every write, so an effect depending on it re-runs after its own set: the
  // first render of this loop was React error 185 at every width above 1024.
  const railOverlayOpen = useChrome((s) => s.railOverlayOpen);
  const drawerOverlayOpen = useChrome((s) => s.drawerOverlayOpen);
  const setRailOverlayOpen = useChrome((s) => s.setRailOverlayOpen);
  const setDrawerOverlayOpen = useChrome((s) => s.setDrawerOverlayOpen);
  const route = useRoute();
  const chair = route.query.get('mode') === 'chair';
  const head = route.segments[0];
  // Configuration and reporting screens have no selection for the drawer, so they take the full width (D-026).
  const chromeMode = chair ? 'minimal' : head === 'admin' || head === 'reports' ? 'wide' : undefined;

  // The boot script writes the mode before the first paint; this keeps it current as the window is
  // resized. Both write the same attribute, so the stylesheet has one thing to read either way.
  useEffect(() => applyLayoutMode(mode), [mode]);

  // An overlay left open while the window grows into a mode that docks the same panel would sit over
  // the column it duplicates. Closing it on the transition means the panel is never shown twice.
  useEffect(() => {
    if (RAIL_STATE[mode] !== 'overlay' && railOverlayOpen) setRailOverlayOpen(false);
    if (DRAWER_STATE[mode] !== 'overlay' && drawerOverlayOpen) setDrawerOverlayOpen(false);
  }, [mode, railOverlayOpen, drawerOverlayOpen, setRailOverlayOpen, setDrawerOverlayOpen]);

  return (
    <div
      className="app-shell"
      data-layout={mode}
      data-rail={railCollapsed ? 'collapsed' : 'expanded'}
      data-drawer={drawerCollapsed ? 'collapsed' : 'open'}
      data-chrome={chromeMode}
      data-app-ready="true"
    >
      {RAIL_STATE[mode] === 'overlay' ? null : <Rail />}
      <TopBar />
      <main id="main" className="app-content" tabIndex={-1}>
        {children}
      </main>
      {DRAWER_STATE[mode] === 'docked' && chromeMode === undefined ? <ContextDrawer /> : null}

      {RAIL_STATE[mode] === 'overlay' ? <RailOverlay open={railOverlayOpen} onClose={() => setRailOverlayOpen(false)} /> : null}
      {DRAWER_STATE[mode] === 'overlay' && chromeMode === undefined ? (
        <ContextDrawerOverlay open={drawerOverlayOpen} onClose={() => setDrawerOverlayOpen(false)} />
      ) : null}
    </div>
  );
}
