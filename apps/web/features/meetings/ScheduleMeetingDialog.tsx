'use client';

import { MEETING_TYPES_BY_PROCESS, agencyShort, canRecordTransition, londonToIso, meetingTypeLabel, processShort, roleLabel, scheduleRoute, stageLabel, transitionLabel, type Invitee, type Meeting, type MeetingType, type Process } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, CheckboxField, DateField, Dialog, RadioGroup, SelectField, TextField, TextareaField, useToast } from '@mas/ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { mayBeInvited, proposeInvitees } from '@/lib/invites';
import { useNavigate } from '@/lib/router';
import { meetingPath } from '@/lib/routes';
import { accessForUser, userName } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useGrants, useNow } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './ScheduleMeetingDialog.module.css';

interface Props {
  /** Mount the dialog when it opens and drop it when it closes: its state starts fresh each time. */
  open: boolean;
  onClose: () => void;
  /** The case, where the dialog was opened on one; otherwise it asks. */
  process?: Process;
  meetingType?: MeetingType;
  /** An inquorate meeting this one reconvenes: the same type and list, a new date. */
  reconvene?: Meeting;
  onScheduled?: (meetingId: string) => void;
}

const CPPM_TYPES: readonly MeetingType[] = ['cppm', 'pre-birth-cppm', 'cppm-review'];

/**
 * One dialog for the three places a meeting is scheduled: the case, the Meetings screen, which
 * asks for the case first, and the global create menu. The type decides the route (D-213): where
 * the stage engine's tables schedule it from the case's stage it is recorded as that transition,
 * with the transition's own permission and requirements shown before anything is typed; where the
 * engine awaits it or has no view of it, it is a plain meeting; and where the tables schedule it
 * from a stage the case has not reached, the dialog says which, rather than letting a case skip.
 *
 * The invite list is proposed by the need-to-know matrix for the stage and every proposed name
 * carries the row that seats them. Everybody the matrix left off is listed beside it with the
 * reason, and anybody unticked by hand joins that list: the meeting records who was not invited
 * as carefully as who was.
 */
export function ScheduleMeetingDialog({ open, onClose, process: fixed, meetingType, reconvene, onScheduled }: Props) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const grants = useGrants();
  const now = useNow();
  const navigate = useNavigate();
  const schedule = useAppStore((s) => s.scheduleMeeting);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const [processId, setProcessId] = useState(fixed?.id ?? reconvene?.processId ?? '');
  const [type, setType] = useState<MeetingType | ''>(reconvene?.type ?? meetingType ?? '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [location, setLocation] = useState(reconvene?.location ?? '');
  const [chairUserId, setChairUserId] = useState(reconvene?.chairUserId ?? user?.id ?? '');
  const [minuteTakerUserId, setMinuteTakerUserId] = useState(reconvene?.minuteTakerUserId ?? '');
  const [outOfHours, setOutOfHours] = useState(false);
  const [parents, setParents] = useState<'invited' | 'excluded'>('invited');
  const [parentsReason, setParentsReason] = useState('');
  const [childInvited, setChildInvited] = useState(true);
  /** Names unticked by hand, and people added by hand. The proposal itself is derived, never copied. */
  const [dropped, setDropped] = useState<string[]>([]);
  const [added, setAdded] = useState<Invitee[]>([]);
  const [extra, setExtra] = useState('');
  const [errors, setErrors] = useState<string[]>([]);


  const choices = user ? data.processes.filter((p) => p.status === 'open' && accessForUser(data, config, user, p, grants, now).level === 'full') : [];
  const process = fixed ?? choices.find((p) => p.id === processId);
  const types: readonly MeetingType[] = process
    ? MEETING_TYPES_BY_PROCESS[process.type].filter((mt) => {
        if (mt === 'pre-birth-cppm') return process.type === 'cp' && Boolean(process.detail.preBirth);
        if (mt === 'cppm') return !(process.type === 'cp' && process.detail.preBirth);
        if (mt === 'mappa-level3') return process.type === 'mappa' && process.detail.level === 3;
        if (mt === 'mappa-level2') return process.type === 'mappa' && process.detail.level !== 3;
        return true;
      })
    : [];
  const chosenType: MeetingType | '' = type && types.includes(type) ? type : (types[0] ?? '');
  const route = process && chosenType ? scheduleRoute(process, chosenType) : null;
  const permission = route?.kind === 'transition' && user ? canRecordTransition(user, route.transition) : null;
  const missing = route?.kind === 'transition' && process ? route.transition.requires(process) : [];
  const refused = !route || route.kind === 'refused' || (permission !== null && !permission.allowed) || missing.length > 0;

  const proposal = process && user ? proposeInvitees(t, data, config, process, reconvene?.invitees ?? [], [chairUserId]) : null;
  const keyOf = (i: Invitee) => i.userId ?? i.name;
  const listed: Array<{ invitee: Invitee; byHand: boolean }> = [
    ...(reconvene?.invitees ?? []).map((invitee) => ({ invitee: { ...invitee, attendance: 'invited' as const }, byHand: false })),
    ...(proposal?.additions ?? []).map((invitee) => ({ invitee, byHand: false })),
    ...added.map((invitee) => ({ invitee, byHand: true })),
  ].filter((row) => row.invitee.userId !== chairUserId);
  const checked = (i: Invitee) => !dropped.includes(keyOf(i));
  const invitable = process ? data.users.filter((u) => mayBeInvited(data, config, process, u) && u.id !== chairUserId && !listed.some((row) => row.invitee.userId === u.id)) : [];
  const chairs = process && user ? data.users.filter((u) => mayBeInvited(data, config, process, u) && (u.roleId === 'chair' || u.id === user.id || process.members.some((m) => m.userId === u.id))) : [];
  const minuteTakers = process ? data.users.filter((u) => u.roleId === 'minute-taker' && mayBeInvited(data, config, process, u)) : [];

  function pickProcess(id: string) {
    setProcessId(id);
    setDropped([]);
    setAdded([]);
    setErrors([]);
  }

  function addByHand() {
    const u = data.users.find((x) => x.id === extra);
    if (!u) return;
    setAdded([...added, { userId: u.id, name: userName(u), agency: u.agency, role: roleLabel(u.roleId), required: true, attendance: 'invited', reason: t('meetings.schedule.invites.byHand') }]);
    setDropped(dropped.filter((k) => k !== u.id));
    setExtra('');
  }

  function submit() {
    if (!user || !process || !chosenType) {
      setErrors(['scheduleRequired']);
      return;
    }
    const chair = data.users.find((u) => u.id === chairUserId);
    const minuteTaker = data.users.find((u) => u.id === minuteTakerUserId);
    const refusals: string[] = [];
    if (!date) refusals.push('meetingDateRequired');
    if (!chair) refusals.push('chairRequired');
    if (location.trim() === '') refusals.push('meetingLocationRequired');
    if (refusals.length > 0 || !chair) {
      setErrors(refusals);
      return;
    }
    const invitees = listed.filter((row) => checked(row.invitee)).map(({ invitee }) => ({ userId: invitee.userId, name: invitee.name, agency: invitee.agency, role: invitee.role, reason: invitee.reason, required: invitee.required }));
    const leftOff = [...(proposal?.leftOff ?? []), ...listed.filter((row) => !checked(row.invitee)).map(({ invitee }) => ({ name: invitee.name, reason: t('meetings.schedule.leftOff.unticked') }))];
    const result = schedule(process.id, chosenType, {
      scheduledAt: londonToIso(date, time),
      location: location.trim(),
      chairUserId: chair.id,
      chairName: userName(chair),
      minuteTakerUserId: minuteTaker?.id,
      minuteTakerName: minuteTaker ? userName(minuteTaker) : undefined,
      invitees,
      leftOff,
      outOfHours,
      parents,
      parentsExcludedReason: parents === 'excluded' ? parentsReason.trim() : undefined,
      childInvited,
      reconvenes: reconvene?.id,
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('meetings.schedule.toastTitle'), text: t('meetings.schedule.toastText', { count: invitees.length, leftOff: leftOff.length }), tone: 'success' });
    const id = result.created?.meetingId;
    onClose();
    if (id) {
      if (onScheduled) onScheduled(id);
      else navigate(meetingPath(id));
    }
  }

  const routeText = !route || !process
    ? ''
    : route.kind === 'transition'
      ? t('meetings.schedule.route.transition', { transition: transitionLabel(route.transition.id), moves: route.transition.to.some((s) => s !== process.stage) ? 'yes' : 'no', stage: route.transition.to.filter((s) => s !== process.stage).map((s) => stageLabel(process.type, s)).join(', ') })
      : route.kind === 'plain'
        ? t('meetings.schedule.route.plain')
        : t('meetings.schedule.route.refused', { type: meetingTypeLabel(chosenType as MeetingType), stages: route.stages.map((s) => stageLabel(process.type, s)).join(', '), stage: stageLabel(process.type, process.stage) });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={reconvene ? t('meetings.schedule.reconveneTitle', { title: reconvene.title }) : process ? t('meetings.schedule.titleFor', { reference: process.reference }) : t('meetings.schedule.title')}
      size="lg"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={refused} data-testid="meeting-submit">
            {t('meetings.schedule.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        {!fixed && !reconvene ? (
          choices.length === 0 ? (
            <p className={styles.hint} data-testid="meeting-no-cases">
              {t('meetings.schedule.noCases')}
            </p>
          ) : (
            <SelectField label={t('meetings.schedule.case')} hint={t('meetings.schedule.caseHint')} value={processId} onChange={(e) => pickProcess(e.target.value)} placeholder={t('meetings.schedule.casePlaceholder')} options={choices.map((p) => ({ value: p.id, label: t('nav.create.caseOption', { reference: p.reference, type: processShort(p.type), title: p.title }) }))} required data-testid="meeting-case" />
          )
        ) : null}

        {process ? (
          <>
            <div className={styles.grid}>
              <SelectField label={t('meetings.schedule.type')} value={chosenType} onChange={(e) => setType(e.target.value as MeetingType)} options={types.map((mt) => ({ value: mt, label: meetingTypeLabel(mt) }))} disabled={Boolean(reconvene)} required data-testid="meeting-type" />
              <p className={styles.route} data-state={route?.kind ?? 'none'} data-testid="meeting-route" aria-live="polite">
                {routeText}
                {permission && !permission.allowed ? ` ${permission.reason} ${permission.route ?? ''}` : ''}
                {missing.length > 0 ? ` ${readErrors(missing.map((m) => m.code)).join(' ')}` : ''}
              </p>
            </div>

            <div className={styles.grid}>
              <DateField label={t('meetings.schedule.date')} value={date} onChange={setDate} required data-testid="meeting-date" />
              <TextField label={t('meetings.schedule.time')} type="time" value={time} onChange={(e) => setTime(e.target.value)} required data-testid="meeting-time" />
              <TextField label={t('meetings.schedule.location')} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('meetings.schedule.locationPlaceholder')} required data-testid="meeting-location" />
            </div>
            <div className={styles.grid}>
              <SelectField label={t('meetings.schedule.chair')} hint={t('meetings.schedule.chairHint')} value={chairUserId} onChange={(e) => setChairUserId(e.target.value)} placeholder={t('meetings.schedule.chairPlaceholder')} options={chairs.map((u) => ({ value: u.id, label: `${userName(u)} (${roleLabel(u.roleId)})` }))} required data-testid="meeting-chair" />
              <SelectField label={t('meetings.schedule.minuteTaker')} value={minuteTakerUserId} onChange={(e) => setMinuteTakerUserId(e.target.value)} placeholder={t('meetings.schedule.minuteTakerNone')} options={minuteTakers.map((u) => ({ value: u.id, label: userName(u) }))} data-testid="meeting-minute-taker" />
            </div>

            {chosenType === 'ird' ? <CheckboxField label={t('meetings.schedule.outOfHours')} checked={outOfHours} onChange={(e) => setOutOfHours(e.target.checked)} data-testid="meeting-out-of-hours" /> : null}
            {CPPM_TYPES.includes(chosenType as MeetingType) ? (
              <div className={styles.grid}>
                <RadioGroup legend={t('meetings.schedule.parents')} name="meeting-parents" value={parents} onChange={(v) => setParents(v as 'invited' | 'excluded')} orientation="horizontal" options={[{ value: 'invited', label: t('meetings.schedule.parentsInvited') }, { value: 'excluded', label: t('meetings.schedule.parentsExcluded') }]} />
                {parents === 'excluded' ? <TextareaField label={t('meetings.schedule.parentsReason')} value={parentsReason} onChange={(e) => setParentsReason(e.target.value)} rows={2} required data-testid="meeting-parents-reason" /> : null}
                <CheckboxField label={t('meetings.schedule.childInvited')} checked={childInvited} onChange={(e) => setChildInvited(e.target.checked)} data-testid="meeting-child-invited" />
              </div>
            ) : null}

            <fieldset className={styles.section} data-testid="meeting-invitees">
              <legend className={styles.legend}>{t('meetings.schedule.invites.title')}</legend>
              <p className={styles.hint}>{t('meetings.schedule.invites.hint')}</p>
              {listed.length === 0 ? <p className={styles.hint}>{t('meetings.schedule.invites.empty')}</p> : null}
              <div className={styles.list}>
                {listed.map(({ invitee, byHand }) => (
                  <CheckboxField
                    key={keyOf(invitee)}
                    label={t('meetings.schedule.invites.person', { name: invitee.name, role: invitee.role, agency: agencyShort(invitee.agency) })}
                    hint={byHand ? invitee.reason : t('meetings.schedule.invites.reason', { reason: invitee.reason, hasRule: invitee.needToKnowRowId ? 'yes' : 'no', rowId: invitee.needToKnowRowId ?? '' })}
                    checked={checked(invitee)}
                    onChange={(e) => setDropped(e.target.checked ? dropped.filter((k) => k !== keyOf(invitee)) : [...dropped, keyOf(invitee)])}
                    data-testid={`invitee-${invitee.userId ?? invitee.name}`}
                  />
                ))}
              </div>
              <div className={styles.addRow}>
                <SelectField label={t('meetings.schedule.invites.add')} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={t('meetings.schedule.invites.addPlaceholder')} options={invitable.map((u) => ({ value: u.id, label: `${userName(u)} (${roleLabel(u.roleId)}, ${agencyShort(u.agency)})` }))} data-testid="meeting-add-invitee" />
                <Button variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={addByHand} disabled={!extra} data-testid="meeting-add-invitee-button">
                  {t('meetings.schedule.invites.addButton')}
                </Button>
              </div>
            </fieldset>

            <div className={styles.section} data-testid="meeting-left-off">
              <span className={styles.legend}>{t('meetings.schedule.leftOff.title')}</span>
              <p className={styles.hint}>{t('meetings.schedule.leftOff.hint')}</p>
              {proposal && proposal.leftOff.length === 0 && listed.every((row) => checked(row.invitee)) ? <p className={styles.hint}>{t('meetings.schedule.leftOff.none')}</p> : null}
              <ul className={styles.leftOff}>
                {(proposal?.leftOff ?? []).map((x) => (
                  <li key={`${x.name}:${x.reason}`}>
                    <strong>{x.name}</strong>: {x.reason}
                  </li>
                ))}
                {listed
                  .filter((row) => !checked(row.invitee))
                  .map(({ invitee }) => (
                    <li key={`unticked:${keyOf(invitee)}`}>
                      <strong>{invitee.name}</strong>: {t('meetings.schedule.leftOff.unticked')}
                    </li>
                  ))}
              </ul>
            </div>
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
