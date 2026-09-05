'use client';

import { meetingTypeLabel, transitionLabel, whatHappensNext, type AnyTransition, type Creates, type MeetingType, type Process, type TransitionAvailability } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button } from '@mas/ui';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScheduleMeetingDialog } from '@/features/meetings/ScheduleMeetingDialog';
import { meetingPath } from '@/lib/routes';
import { useAppStore, useCurrentUser, useData, type TransitionRecordResult } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import { CreatesHost, canOpenCreates } from './CreatesHost';
import { RecordTransitionDialog } from './RecordTransitionDialog';
import { TRANSITION_FORMS } from './index';
import styles from './transitions.module.css';

type Opened = { kind: 'form'; transition: AnyTransition } | { kind: 'schedule'; type: MeetingType } | { kind: 'creates'; creates: Extract<Creates, { kind: 'dialog' }> } | null;

/**
 * What happens next: the transitions the case's stage carries, as buttons (D-217).
 *
 * The stepper above is a view of the tables; this is the tables' offer. Each transition the stage
 * carries is a button that opens its form, the schedule dialog, or the dialog that already records
 * it. A button this person may not press says who may; one the record is not ready for says what
 * is missing and opens the thing that records it. Transitions a meeting fires are listed as
 * sentences with the meeting they wait for, because pressing them here would be holding a meeting
 * from the wrong room.
 */
export function TransitionPanel({ process }: { process: Process }) {
  const t = useT();
  const user = useCurrentUser();
  const data = useData();
  const readErrors = useWriteErrors();
  const [opened, setOpened] = useState<Opened>(null);
  if (!user || process.status !== 'open') return null;
  const all = whatHappensNext(process, user);
  const offered = all.filter((a) => !a.transition.firedBy);
  const held = all.filter((a) => a.transition.firedBy);

  function open(a: TransitionAvailability) {
    const { transition } = a;
    if (transition.schedules) {
      const type = transition.schedules.find((mt) => (mt === 'pre-birth-cppm' ? process.type === 'cp' && Boolean(process.detail.preBirth) : mt === 'cppm' ? !(process.type === 'cp' && process.detail.preBirth) : mt === 'mappa-level3' ? process.type === 'mappa' && process.detail.level === 3 : mt === 'mappa-level2' ? process.type === 'mappa' && process.detail.level !== 3 : true)) ?? transition.schedules[0]!;
      setOpened({ kind: 'schedule', type });
      return;
    }
    if (transition.via?.kind === 'dialog') {
      setOpened({ kind: 'creates', creates: transition.via });
      return;
    }
    setOpened({ kind: 'form', transition });
  }

  function follow(creates: Creates) {
    if (creates.kind === 'dialog') {
      setOpened({ kind: 'creates', creates });
      return;
    }
    const target = all.find((a) => a.transition.id === creates.transition);
    if (target) open(target);
  }

  function done(result: TransitionRecordResult) {
    const offer = result.offers?.[0];
    if (offer?.kind === 'dialog' && canOpenCreates(offer, process)) setOpened({ kind: 'creates', creates: offer });
  }

  const canFollow = (c: Creates) => (c.kind === 'dialog' ? canOpenCreates(c, process) : all.some((x) => x.transition.id === c.transition));
  const kindOf = (transition: AnyTransition) => (transition.schedules ? 'schedule' : transition.via?.kind === 'dialog' ? 'dialog' : TRANSITION_FORMS[transition.id] ? 'form' : 'pending');

  return (
    <div className={styles.panel} data-testid="next-panel">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>{t('processes.next.title')}</h2>
        <span className={styles.panelMeta}>{t('processes.next.meta', { count: offered.length })}</span>
      </div>
      {offered.length === 0 && held.length === 0 ? <p className={styles.held}>{t('processes.next.none')}</p> : null}
      <div className={styles.options}>
        {offered.map((a) => {
          const kind = kindOf(a.transition);
          const refused = !a.permission.allowed || a.missing.length > 0 || kind === 'pending';
          return (
            <div key={a.transition.id} className={styles.option} data-state={refused ? 'refused' : 'open'} data-testid={`next-${a.transition.id}`}>
              <Button variant={refused ? 'secondary' : 'primary'} size="sm" icon={<ArrowRight size={14} aria-hidden="true" />} disabled={refused} onClick={() => open(a)} data-testid={`next-${a.transition.id}-button`}>
                {transitionLabel(a.transition.id)}
              </Button>
              <span className={styles.optionMeta}>{a.leadsTo.length > 0 ? t('processes.next.leadsTo', { stage: a.leadsTo.join(', ') }) : t('processes.next.stays')}</span>
              {!a.permission.allowed ? <span className={styles.optionRefusal}>{`${a.permission.reason} ${a.permission.route ?? ''}`.trim()}</span> : null}
              {a.missing.map((m) => (
                <span key={m.code} className={styles.optionRefusal}>
                  {readErrors([m.code])[0]}{' '}
                  {m.creates && canFollow(m.creates) ? (
                    <Button size="sm" variant="quiet" onClick={() => follow(m.creates!)} data-testid={`creates-${m.creates.kind === 'dialog' ? m.creates.dialog : m.creates.transition}`}>
                      {m.creates.kind === 'dialog' ? t('processes.next.recordIt') : t('processes.next.recordFirst', { transition: transitionLabel(m.creates.transition) })}
                    </Button>
                  ) : null}
                </span>
              ))}
              {kind === 'pending' ? <span className={styles.optionRefusal}>{t('processes.next.formPending', { transition: transitionLabel(a.transition.id) })}</span> : null}
            </div>
          );
        })}
      </div>
      {held.map((a) => {
        const types = a.transition.firedBy ?? [];
        const meeting = data.meetings.find((m) => m.processId === process.id && types.includes(m.type) && (m.status === 'scheduled' || m.status === 'in-progress'));
        return (
          <p key={a.transition.id} className={styles.held} data-testid={`next-held-${a.transition.id}`}>
            {t('processes.next.held', { transition: transitionLabel(a.transition.id), meeting: types.map((mt) => meetingTypeLabel(mt)).join(', '), scheduled: meeting ? 'yes' : 'no' })}{' '}
            {meeting ? <AppLink href={meetingPath(meeting.id)}>{meeting.title}</AppLink> : null}
          </p>
        );
      })}

      {opened?.kind === 'form' ? <RecordTransitionDialog open onClose={() => setOpened(null)} process={process} transition={opened.transition} onDone={done} /> : null}
      {opened?.kind === 'schedule' ? <ScheduleMeetingDialog open onClose={() => setOpened(null)} process={process} meetingType={opened.type} /> : null}
      {opened?.kind === 'creates' ? <CreatesHost creates={opened.creates} process={process} onClose={() => setOpened(null)} /> : null}
    </div>
  );
}

/** The same offer as sentences, for the drawer and the demo panel. */
export function useTransitionsNarrative(process: Process | undefined): string[] {
  const t = useT();
  const user = useCurrentUser();
  const store = useAppStore((s) => s.data.meetings);
  if (!user || !process || process.status !== 'open') return [];
  return whatHappensNext(process, user).map((a) => {
    const meeting = a.transition.firedBy ? store.find((m) => m.processId === process.id && a.transition.firedBy!.includes(m.type) && m.status === 'scheduled') : undefined;
    return t('processes.next.sentence', {
      transition: transitionLabel(a.transition.id),
      moves: a.leadsTo.length > 0 ? 'yes' : 'no',
      stage: a.leadsTo.join(', '),
      who: a.permission.allowed ? 'you' : 'other',
      route: a.permission.allowed ? '' : (a.permission.route ?? a.permission.reason),
      missing: a.missing.length > 0 ? 'yes' : 'no',
      held: a.transition.firedBy ? (meeting ? 'scheduled' : 'unscheduled') : 'no',
    });
  });
}
