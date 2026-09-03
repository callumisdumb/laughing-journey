'use client';

import type { ReactNode } from 'react';
import { useAppearance } from '@/lib/appearance';
import { useRoute } from '@/lib/router';
import { ContextDrawer } from './ContextDrawer';
import { Rail } from './Rail';
import { TopBar } from './TopBar';

export function AppShell({ children }: { children: ReactNode }) {
  const railCollapsed = useAppearance((s) => s.railCollapsed);
  const drawerCollapsed = useAppearance((s) => s.drawerCollapsed);
  const route = useRoute();
  const chair = route.query.get('mode') === 'chair';
  const head = route.segments[0];
  // Configuration and reporting screens have no selection for the drawer, so they take the full width (D-026).
  const chrome = chair ? 'minimal' : head === 'admin' || head === 'reports' ? 'wide' : undefined;
  return (
    <div className="app-shell" data-rail={railCollapsed ? 'collapsed' : 'expanded'} data-drawer={drawerCollapsed ? 'collapsed' : 'open'} data-chrome={chrome} data-app-ready="true">
      <Rail />
      <TopBar />
      <main id="main" className="app-content" tabIndex={-1}>
        {children}
      </main>
      <ContextDrawer />
    </div>
  );
}
