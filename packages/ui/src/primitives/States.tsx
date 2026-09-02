import { AlertTriangle, CloudOff, Inbox, Lock, ShieldAlert, TimerOff } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../cn';
import styles from './States.module.css';

export type StateKind = 'empty' | 'error' | 'restricted' | 'offline' | 'stale';

interface StateShellProps {
  kind: StateKind;
  icon?: ReactNode;
  title: ReactNode;
  text?: ReactNode;
  actions?: ReactNode;
  className?: string;
  role?: 'status' | 'alert';
}

const DEFAULT_ICONS: Record<StateKind, ReactNode> = {
  empty: <Inbox size={22} aria-hidden="true" />,
  error: <AlertTriangle size={22} aria-hidden="true" />,
  restricted: <Lock size={22} aria-hidden="true" />,
  offline: <CloudOff size={22} aria-hidden="true" />,
  stale: <TimerOff size={22} aria-hidden="true" />,
};

export function StateShell({ kind, icon, title, text, actions, className, role }: StateShellProps) {
  return (
    <div className={cn(styles.state, className)} data-kind={kind} role={role}>
      <span className={styles.icon}>{icon ?? DEFAULT_ICONS[kind]}</span>
      <div className={styles.title}>{title}</div>
      {text ? <div className={styles.text}>{text}</div> : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}

export function EmptyState(p: Omit<StateShellProps, 'kind'>) {
  return <StateShell kind="empty" role="status" {...p} />;
}

export function ErrorState(p: Omit<StateShellProps, 'kind'>) {
  return <StateShell kind="error" role="alert" {...p} />;
}

export function OfflineState(p: Partial<Omit<StateShellProps, 'kind'>>) {
  return (
    <StateShell
      kind="offline"
      role="status"
      title={p.title ?? 'You are offline'}
      text={p.text ?? 'The record you are looking at is the last copy held on this device. Changes will be kept locally and sent when the connection returns.'}
      actions={p.actions}
      className={p.className}
    />
  );
}

export function StaleState(p: Partial<Omit<StateShellProps, 'kind'>> & { lastSyncLabel?: string }) {
  return (
    <StateShell
      kind="stale"
      role="status"
      title={p.title ?? 'Connector data may be out of date'}
      text={p.text ?? `The last successful sync was ${p.lastSyncLabel ?? 'some time ago'}. Events since then have not been pulled in.`}
      actions={p.actions}
      className={p.className}
    />
  );
}

export interface RestrictedStateProps {
  title?: ReactNode;
  reason: ReactNode;
  breakGlass: 'available' | 'unavailable' | 'not-needed' | 'active';
  onBreakGlass?: () => void;
  breakGlassAction?: ReactNode;
  className?: string;
}

export function RestrictedState({ title, reason, breakGlass, breakGlassAction, className }: RestrictedStateProps) {
  return (
    <StateShell
      kind="restricted"
      role="status"
      icon={breakGlass === 'available' ? <ShieldAlert size={22} aria-hidden="true" /> : undefined}
      title={title ?? 'Restricted record'}
      text={
        <>
          {reason}
          {breakGlass === 'available' ? ' You can open it with a recorded reason. Access lasts four hours and every read is audited.' : null}
          {breakGlass === 'unavailable' ? ' Break-glass access is not available for your agency or role.' : null}
        </>
      }
      actions={breakGlass === 'available' ? breakGlassAction : undefined}
      className={className}
    />
  );
}

export interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({ width, height, className }: SkeletonProps) {
  const style = { '--skeleton-width': width, '--skeleton-height': height } as CSSProperties;
  return <span className={cn(styles.skeleton, className)} style={style} aria-hidden="true" />;
}

export function SkeletonLines({ lines = 3, label = 'Loading' }: { lines?: number; label?: string }) {
  const widths = ['92%', '78%', '64%', '84%', '58%'];
  return (
    <div className={styles.skeletonStack} role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={widths[i % widths.length]} height="0.9em" />
      ))}
    </div>
  );
}
