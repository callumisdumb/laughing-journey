'use client';

import { DEMO_NOW_ISO, formatDateTime } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, DateField, Switch } from '@mas/ui';
import { RotateCcw } from 'lucide-react';
import { useAppStore, useNow } from '@/lib/store';
import styles from './DemoClock.module.css';

/**
 * The demo clock, and the reason it is settable.
 *
 * Statutory clocks are the part of this product that is hardest to show standing still. "The inquiry
 * decision is due in three days" is a number on a screen. Moving the clock four days and watching
 * the same number go overdue, the band turn red, the worklist reorder and the home screen's count
 * change is the demonstration, and it is the one thing a room of practitioners will actually test
 * against what they know.
 *
 * One value drives everything, because a screen reading a different instant from the panel beside it
 * would be worse than a frozen one. Moves are absolute rather than accumulated: the shortcuts compute
 * a date from the current instant and set it, so a jump forwards and a jump back are the same
 * operation and repeated moves cannot drift.
 *
 * Setting it turns the live clock off, because a demo instant the real clock overwrites a second
 * later is not a setting.
 */
const JUMPS = [
  { days: 1, back: 'demoClock.jump.day.back', on: 'demoClock.jump.day.on' },
  { days: 7, back: 'demoClock.jump.week.back', on: 'demoClock.jump.week.on' },
  { days: 28, back: 'demoClock.jump.month.back', on: 'demoClock.jump.month.on' },
] as const;

function shift(from: Date, days: number): string {
  const next = new Date(from.getTime());
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

export function DemoClock({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const now = useNow();
  const liveClock = useAppStore((s) => s.session.liveClock);
  const setLiveClock = useAppStore((s) => s.setLiveClock);
  const nowIso = useAppStore((s) => s.session.nowIso);
  const setDemoNow = useAppStore((s) => s.setDemoNow);
  const resetDemoNow = useAppStore((s) => s.resetDemoNow);
  const moved = nowIso !== DEMO_NOW_ISO;

  return (
    <div className={styles.clock} data-compact={compact ? 'true' : undefined}>
      <p className={styles.reading}>
        <span className={styles.readingLabel}>{liveClock ? t('demoClock.liveNow') : t('demoClock.demoNow')}</span>
        <strong className={styles.readingValue}>{formatDateTime(now.toISOString())}</strong>
      </p>

      <div className={styles.jumps} role="group" aria-label={t('demoClock.jumpsLabel')}>
        {JUMPS.map((jump) => (
          <Button key={`back-${jump.days}`} size="sm" variant="quiet" onClick={() => setDemoNow(shift(now, -jump.days))}>
            {t(jump.back)}
          </Button>
        ))}
        {JUMPS.map((jump) => (
          <Button key={`on-${jump.days}`} size="sm" variant="secondary" onClick={() => setDemoNow(shift(now, jump.days))}>
            {t(jump.on)}
          </Button>
        ))}
      </div>

      {/* The typed field, for landing on a specific date rather than stepping to it. */}
      <DateField
        label={t('demoClock.setLabel')}
        value={now.toISOString().slice(0, 10)}
        onChange={(iso) => {
          if (iso) setDemoNow(`${iso}T09:00:00+01:00`);
        }}
        hint={t('demoClock.setHint')}
      />

      <div className={styles.foot}>
        <Switch label={t('settings.clock.live')} checked={liveClock} onChange={(e) => setLiveClock(e.target.checked)} />
        <Button size="sm" variant="quiet" icon={<RotateCcw size={14} aria-hidden="true" />} disabled={!moved} onClick={resetDemoNow}>
          {t('demoClock.reset')}
        </Button>
      </div>
      {moved ? <p className={styles.moved}>{t('demoClock.movedNote', { seeded: formatDateTime(DEMO_NOW_ISO) })}</p> : null}
      <p className={styles.note}>{t('demoClock.note')}</p>
    </div>
  );
}
