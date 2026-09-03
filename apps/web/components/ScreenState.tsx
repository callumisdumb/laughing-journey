'use client';

import { useT } from '@mas/messages';
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
  const t = useT();
  switch (state) {
    case 'loading':
      return <SkeletonLines lines={loadingLines} />;
    case 'empty':
      return <EmptyState title={empty?.title ?? t('states.empty.title')} text={empty?.text} actions={empty?.actions} />;
    case 'error':
      return (
        <ErrorState
          title={error?.title ?? t('states.error.title')}
          text={error?.text ?? t('states.error.text')}
          actions={error?.onRetry ? <Button variant="secondary" onClick={error.onRetry}>{t('states.error.retry')}</Button> : undefined}
        />
      );
    case 'restricted':
      return (
        <RestrictedState
          reason={restricted?.reason ?? t('states.restricted.reason')}
          breakGlass={restricted?.breakGlass ?? 'unavailable'}
          breakGlassAction={restricted?.onBreakGlass ? <Button variant="primary" onClick={restricted.onBreakGlass}>{t('states.restricted.open')}</Button> : undefined}
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
          <StaleState lastSyncLabel={stale?.lastSyncLabel} actions={stale?.onRefresh ? <Button variant="secondary" onClick={stale.onRefresh}>{t('states.stale.refresh')}</Button> : undefined} />
          {children}
        </>
      );
    default:
      return <>{children}</>;
  }
}
