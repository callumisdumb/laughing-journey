'use client';

import { Button, EmptyState, ErrorState, OfflineState, RestrictedState, SkeletonLines, StaleState } from '@mas/ui';
import type { ReactNode } from 'react';
import { useRoute } from '@/lib/router';

export type ScreenStateKind = 'ready' | 'loading' | 'empty' | 'error' | 'restricted' | 'offline' | 'stale';

const DEV_STATES: ScreenStateKind[] = ['loading', 'empty', 'error', 'restricted', 'offline', 'stale'];

/** The ?state= demo override (DECISIONS D-012): lets Playwright and demos reach every designed state. */
export function useDevState(): ScreenStateKind | null {
  const route = useRoute();
  const s = route.query.get('state');
  if (!s) return null;
  return DEV_STATES.includes(s as ScreenStateKind) ? (s as ScreenStateKind) : null;
}

export interface ScreenStateProps {
  state: ScreenStateKind;
  children: ReactNode;
  empty?: { title: ReactNode; text?: ReactNode; actions?: ReactNode };
  error?: { title?: ReactNode; text?: ReactNode; onRetry?: () => void };
  restricted?: { reason: ReactNode; breakGlass: 'available' | 'unavailable' | 'not-needed' | 'active'; onBreakGlass?: () => void };
  stale?: { lastSyncLabel?: string; onRefresh?: () => void };
  loadingLines?: number;
}

/** One wrapper so every screen reaches every designed state the same way. */
export function ScreenState({ state, children, empty, error, restricted, stale, loadingLines = 6 }: ScreenStateProps) {
  switch (state) {
    case 'loading':
      return <SkeletonLines lines={loadingLines} />;
    case 'empty':
      return <EmptyState title={empty?.title ?? 'Nothing here yet'} text={empty?.text} actions={empty?.actions} />;
    case 'error':
      return (
        <ErrorState
          title={error?.title ?? 'This screen could not load'}
          text={error?.text ?? 'The local record store returned an error. Try again, and if it happens twice, reset the demo data from Settings.'}
          actions={error?.onRetry ? <Button variant="secondary" onClick={error.onRetry}>Try again</Button> : undefined}
        />
      );
    case 'restricted':
      return (
        <RestrictedState
          reason={restricted?.reason ?? 'You are not on the distribution list for this record.'}
          breakGlass={restricted?.breakGlass ?? 'unavailable'}
          breakGlassAction={restricted?.onBreakGlass ? <Button variant="primary" onClick={restricted.onBreakGlass}>Open with a reason</Button> : undefined}
        />
      );
    case 'offline':
      return (
        <>
          <OfflineState />
          {children}
        </>
      );
    case 'stale':
      return (
        <>
          <StaleState lastSyncLabel={stale?.lastSyncLabel} actions={stale?.onRefresh ? <Button variant="secondary" onClick={stale.onRefresh}>Sync now</Button> : undefined} />
          {children}
        </>
      );
    default:
      return <>{children}</>;
  }
}
