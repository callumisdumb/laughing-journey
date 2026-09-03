'use client';

import { AGENCIES, DETAIL_LEVELS, agencyShort, classificationOfShare, applyMeetingTransition, attendanceLabel, contextFor, detailLevelLabel, formatDate, formatDateTime, formatTime, isExcludedParty, meetingStatusLabel, meetingTypeLabel, minuteStatusLabel, packItemKindLabel, processShort, researchStatusLabel, resolveNeedToKnow, roleLabel, stageLabel, type Action, type Agency, type DetailLevel, type LawfulBasisRecord, type Meeting, type SharingRecord } from '@mas/domain';
import { useT } from '@mas/messages';
import { AgencyMark, Button, CheckboxField, ClockNumeral, DateField, Dialog, EmptyState, Pill, ProcessMark, RestrictedState, SelectField, Sheet, SheetBody, SheetHead, TextField, TextareaField, VoiceBlock, useToast } from '@mas/ui';
import { CheckCircle2, Maximize2, Minimize2, Play, Printer, Send, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { chronologyPath, personPath, processPath } from '@/lib/routes';
import { useSelection } from '@/lib/selection';
import { accessForUser, clocksForProcess, fullName, personById, userName } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useNow } from '@/lib/store';
import { MinutesPrintPack } from './MinutesPrintPack';
import styles from './MeetingWorkspace.module.css';

type Phase = 'before' | 'during' | 'after';
const ATTENDANCE: Meeting['invitees'][number]['attendance'][] = ['invited', 'accepted', 'declined', 'present', 'remote', 'apologies', 'absent'];

export function MeetingWorkspace({ meetingId }: { meetingId: string }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const now = useNow();
  const route = useRoute();
  const navigate = useNavigate();
  const select = useSelection((s) => s.select);
  const grants = useAppStore((s) => s.session.breakGlass);
  const upsert = useAppStore((s) => s.upsert);
  const audit = useAppStore((s) => s.audit);
  const newId = useAppStore((s) => s.newId);
  const { toast } = useToast();
  const dev = useDevState();

  const meeting = data.meetings.find((m) => m.id === meetingId);
  const process = meeting ? data.processes.find((p) => p.id === meeting.processId) : undefined;
  const chair = route.query.get('mode') === 'chair';
  const phase: Phase = (route.query.get('phase') as Phase | null) ?? (meeting?.status === 'held' ? 'after' : meeting?.status === 'in-progress' ? 'during' : 'before');

  const [shareForm, setShareForm] = useState({ summary: '', relevance: '' });
  const [decisionForm, setDecisionForm] = useState({ question: '', decision: '', rationale: '', dissentBy: '', dissentText: '' });
  const [actionForm, setActionForm] = useState({ title: '', owner: '', due: '' });
  const [requestForm, setRequestForm] = useState({ agency: 'health' as Agency, to: '', due: '' });
  const [returning, setReturning] = useState<{ id: string; summary: string } | null>(null);
  const [reviewDate, setReviewDate] = useState(meeting?.reviewDate ?? '');

  useEffect(() => {
    select({ kind: 'meeting', id: meetingId });
  }, [meetingId, select]);

  useEffect(() => {
    if (meeting && process) audit({ act: process.accessRestriction === 'restricted' ? 'read-restricted' : 'read', targetType: 'meeting', targetId: meeting.id, targetLabel: meeting.title, processId: process.id, restricted: process.accessRestriction === 'restricted' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  if (!user) return null;
  if (!meeting || !process) {
    return (
      <div className="page">
        <EmptyState title={t('meetings.notFound.title')} text={t('meetings.notFound.text')} actions={<AppLink href="/meetings">{t('meetings.notFound.back')}</AppLink>} />
      </div>
    );
  }
  if (route.query.get('view') === 'print') return <MinutesPrintPack meetingId={meetingId} />;
  const access = accessForUser(data, config, user, process, grants, now);
  const invited = meeting.invitees.some((i) => i.userId === user.id) || meeting.chairUserId === user.id || meeting.minuteTakerUserId === user.id;
  if (access.level === 'none' || (!invited && access.level !== 'full')) {
    return (
      <div className="page">
        <RestrictedState title={t('meetings.restricted.title', { type: meetingTypeLabel(meeting.type) })} reason={access.level === 'none' ? access.reason : t('meetings.restricted.workspaceReason')} breakGlass="unavailable" />
      </div>
    );
  }

  const subjects = meeting.subjectIds.map((id) => personById(data, id)).filter(Boolean) as NonNullable<ReturnType<typeof personById>>[];
  const subject = subjects[0];
  const update = (patch: Partial<Meeting>) => upsert('meetings', { ...meeting, ...patch });
  const setPhase = (p: Phase) => navigate(`${route.path}${setQuery(route.query, { phase: p })}`, { replace: true });
  const toggleChair = () => navigate(`${route.path}${setQuery(route.query, { mode: chair ? null : 'chair', phase: chair ? null : 'during' })}`);
  const meetingActions = data.actions.filter((a) => a.meetingId === meeting.id || meeting.actionIds.includes(a.id));
  const views = data.viewsRecords.filter((v) => meeting.viewsRecordIds.includes(v.id));
  const availableViews = data.viewsRecords.filter((v) => (meeting.subjectIds.includes(v.personId) || v.processId === process.id) && !meeting.viewsRecordIds.includes(v.id));
  const clocks = clocksForProcess(data, config, process, now);
  const personas = data.users.filter((u) => u.roleId !== 'system-administrator');

  function generateInvites() {
    const res = resolveNeedToKnow(contextFor(process!), config.needToKnow, config.exclusions);
    const additions: Meeting['invitees'] = [];
    // Anyone holding an excluded party role on the case-role register is skipped, whatever their agency row says.
    const excludedByRole = new Set<string>();
    for (const r of res.recipients) {
      if (r.detailLevel !== 'full') continue;
      const candidates = data.users.filter((u) => u.agency === r.agency && (r.role === 'any' ? true : u.roleId === r.role) && (u.caseMemberships.includes(process!.id) || r.role !== 'any'));
      const eligible = candidates.filter((u) => {
        const hit = isExcludedParty(process!, { userId: u.id }, config.exclusions, process!.stage, data.relationships);
        if (hit) excludedByRole.add(u.id);
        return !hit;
      });
      for (const u of eligible.slice(0, r.role === 'any' ? 1 : 2)) {
        if (meeting!.invitees.some((i) => i.userId === u.id) || additions.some((i) => i.userId === u.id)) continue;
        additions.push({ userId: u.id, name: userName(u), agency: u.agency, role: roleLabel(u.roleId), required: true, attendance: 'invited', reason: `${r.label}: ${r.reason}`, needToKnowRowId: r.rowId });
      }
    }
    update({ invitees: [...meeting!.invitees, ...additions] });
    toast({
      title: additions.length === 0 ? t('meetings.before.invites.toastComplete') : t('meetings.before.invites.toastAdded', { count: additions.length }),
      text: t('meetings.before.invites.toastText', { rule: res.exclusions.length > 0 ? 'excluded' : 'none', labels: res.exclusions.map((e) => e.label).join('; '), leftOff: excludedByRole.size }),
      tone: 'success',
    });
  }

  function sendRequest() {
    if (!requestForm.due) return;
    const to = data.users.find((u) => u.id === requestForm.to);
    update({ preMeetingRequests: [...meeting!.preMeetingRequests, { id: newId('pmr'), agency: requestForm.agency, toName: to ? userName(to) : agencyShort(requestForm.agency), toUserId: to?.id, sentAt: now.toISOString(), dueAt: requestForm.due, status: 'sent' }] });
    setRequestForm({ agency: 'health', to: '', due: '' });
    toast({ title: t('meetings.before.requests.toastTitle'), text: t('meetings.before.requests.toastText', { name: to ? userName(to) : agencyShort(requestForm.agency) }), tone: 'success' });
  }

  function recordReturn() {
    if (!returning) return;
    update({ preMeetingRequests: meeting!.preMeetingRequests.map((r) => (r.id === returning.id ? { ...r, status: 'returned', returnSummary: returning.summary, returnedAt: now.toISOString() } : r)), pack: [...meeting!.pack, { id: newId('pk'), kind: 'report', label: t('meetings.before.requests.packLabel', { agency: agencyShort(meeting!.preMeetingRequests.find((r) => r.id === returning.id)?.agency ?? 'health') }), ref: returning.id, included: true }] });
    setReturning(null);
    toast({ title: t('meetings.before.requests.returnedToast'), tone: 'success' });
  }

  function addShared() {
    if (shareForm.summary.trim().length < 5) return;
    update({ informationShared: [...meeting!.informationShared, { id: newId('is'), agency: user!.agency, byName: userName(user!), byUserId: user!.id, at: now.toISOString(), summary: shareForm.summary, relevance: shareForm.relevance, linkedEventIds: [] }] });
    setShareForm({ summary: '', relevance: '' });
  }

  function addDecision() {
    if (decisionForm.question.trim().length < 5 || decisionForm.decision.trim().length < 2) return;
    const dissentUser = data.users.find((u) => u.id === decisionForm.dissentBy);
    update({ decisions: [...meeting!.decisions, { id: newId('dec'), question: decisionForm.question, decision: decisionForm.decision, rationale: decisionForm.rationale, dissent: dissentUser && decisionForm.dissentText ? [{ byName: userName(dissentUser), byUserId: dissentUser.id, agency: dissentUser.agency, text: decisionForm.dissentText }] : [], decidedByName: meeting!.chairName, decidedByUserId: meeting!.chairUserId, decidedAt: now.toISOString() }] });
    setDecisionForm({ question: '', decision: '', rationale: '', dissentBy: '', dissentText: '' });
  }

  function addAction() {
    const owner = data.users.find((u) => u.id === actionForm.owner);
    if (!owner || actionForm.title.trim().length < 5 || !actionForm.due) return;
    const a: Action = { id: newId('act'), synthetic: true, processId: process!.id, meetingId: meeting!.id, title: actionForm.title, ownerUserId: owner.id, ownerName: userName(owner), ownerAgency: owner.agency, due: actionForm.due, status: 'open', createdAt: now.toISOString(), createdByName: userName(user!) };
    upsert('actions', a);
    update({ actionIds: [...meeting!.actionIds, a.id] });
    setActionForm({ title: '', owner: '', due: '' });
  }

  function closeMeeting() {
    const heldAt = now.toISOString();
    const result = applyMeetingTransition(process!.clocks, meeting!.type, heldAt, newId);
    upsert('processes', { ...process!, clocks: result.clocks });
    update({ status: 'held', minute: meeting!.minute.status === 'not-started' ? { ...meeting!.minute, status: 'draft', draftedAt: heldAt } : meeting!.minute });
    audit({ act: 'edit', targetType: 'meeting', targetId: meeting!.id, targetLabel: t('meetings.audit.held', { title: meeting!.title }), processId: process!.id });
    toast({ title: t('meetings.close.toastTitle'), text: t('meetings.close.toastText', { completed: result.completed.join(', ') || t('common.values.none'), started: result.started.join(', ') || t('common.values.none') }), tone: 'success' });
    setPhase('after');
  }

  function generateDistribution() {
    const res = resolveNeedToKnow(contextFor(process!), config.needToKnow, config.exclusions);
    const entries: Meeting['distribution'] = [];
    // Anyone holding an excluded party role on the case-role register never reaches the distribution list.
    const excludedByRole = new Set<string>();
    const excluded = (userId: string): boolean => {
      const hit = isExcludedParty(process!, { userId }, config.exclusions, process!.stage, data.relationships);
      if (hit) excludedByRole.add(userId);
      return hit !== null;
    };
    for (const i of meeting!.invitees) {
      if (!i.userId || entries.some((e) => e.recipientUserId === i.userId) || meeting!.distribution.some((e) => e.recipientUserId === i.userId)) continue;
      if (excluded(i.userId)) continue;
      entries.push({ id: newId('dist'), recipientName: i.name, recipientUserId: i.userId, agency: i.agency, role: i.role, detailLevel: 'full', reason: t('meetings.after.distribution.attendeeReason') });
    }
    for (const r of res.recipients) {
      if (r.detailLevel === 'full') continue;
      const u = data.users.filter((x) => x.agency === r.agency && (r.role === 'any' ? true : x.roleId === r.role)).find((x) => !excluded(x.id));
      if (!u || entries.some((e) => e.recipientUserId === u.id) || meeting!.distribution.some((e) => e.recipientUserId === u.id)) continue;
      entries.push({ id: newId('dist'), recipientName: userName(u), recipientUserId: u.id, agency: u.agency, role: roleLabel(u.roleId), detailLevel: r.detailLevel, fields: r.fields, reason: `${r.label}: ${r.reason}` });
    }
    update({ distribution: [...meeting!.distribution, ...entries] });
    toast({
      title: t('meetings.after.distribution.toastTitle', { count: entries.length }),
      text: t('meetings.after.distribution.toastText', { process: processShort(process!.type), stage: stageLabel(process!.type, process!.stage), exclusions: res.exclusions.map((e) => e.label).join('; ') || t('common.values.none'), leftOff: excludedByRole.size }),
      tone: 'success',
    });
  }

  function distribute() {
    const lb: LawfulBasisRecord = { id: newId('lb'), synthetic: true, purpose: t('meetings.after.distribute.purpose', { title: meeting!.title }), article6: '6(1)(e) public task', article9Condition: '9(2)(g) substantial public interest, DPA 2018 Sch 1 Pt 2 para 18 (safeguarding)', article10Criminal: process!.type === 'mappa' || process!.type === 'marac' ? 'DPA 2018 s10 and Sch 1' : 'not applicable', classification: process!.classification, accessRestriction: process!.accessRestriction, statutoryGateway: [process!.type === 'cp' ? 'National Guidance for Child Protection in Scotland 2021' : process!.type === 'asp' ? 'ASP (Scotland) Act 2007 s5' : process!.type === 'mappa' ? 'Management of Offenders etc. (Scotland) Act 2005 s10' : process!.type === 'marac' ? 'MARAC Operating Protocol' : 'AWI (Scotland) Act 2000'], necessityAndProportionality: t('meetings.after.distribute.necessity'), consentStatus: 'not-required', authorisedByUserId: user!.id, authorisedByName: userName(user!), createdAt: now.toISOString() };
    upsert('lawfulBases', lb);
    const shares: SharingRecord[] = meeting!.distribution.map((d) => ({ id: newId('shr'), synthetic: true, processId: process!.id, subjectId: meeting!.subjectIds[0] ?? '', stage: process!.stage, recipient: { userId: d.recipientUserId, name: d.recipientName, agency: d.agency, role: d.role }, detailLevel: d.detailLevel, fields: d.fields, lawfulBasisId: lb.id, channel: 'in-app' as const, status: 'sent' as const, ...classificationOfShare(process!), createdAt: now.toISOString(), sentAt: now.toISOString(), reason: d.reason, createdByUserId: user!.id, createdByName: userName(user!), summary: t('meetings.after.distribute.shareSummary', { title: meeting!.title, level: detailLevelLabel(d.detailLevel) }) }));
    for (const s of shares) upsert('sharingRecords', s);
    update({ minute: { ...meeting!.minute, status: 'distributed', distributedAt: now.toISOString() }, distribution: meeting!.distribution.map((d, i) => ({ ...d, sharingRecordId: shares[i]?.id })) });
    const recordClocks = process!.clocks.map((c) => (c.ruleId === 'cp.cppm.record.distribute' && !c.completedAt ? { ...c, completedAt: now.toISOString(), note: t('meetings.after.distribute.clockNote') } : c));
    if (recordClocks.some((c, i) => c !== process!.clocks[i])) upsert('processes', { ...process!, clocks: recordClocks });
    audit({ act: 'share', targetType: 'meeting', targetId: meeting!.id, targetLabel: t('meetings.after.distribute.distributed', { count: shares.length }), processId: process!.id, restricted: process!.accessRestriction === 'restricted' });
    toast({ title: t('meetings.after.distribute.distributed', { count: shares.length }), text: t('meetings.after.distribute.toastText'), tone: 'success' });
  }

  const state = dev ?? 'ready';

  return (
    <div className={`page ${chair ? styles.chair : ''}`}>
      {chair ? (
        <div className={styles.chairBanner}>
          <span>{t('meetings.head.chairBanner')}</span>
          <Button size="sm" variant="secondary" icon={<Minimize2 size={14} aria-hidden="true" />} onClick={toggleChair}>
            {t('meetings.head.exitChairMode')}
          </Button>
        </div>
      ) : null}
      <header className={styles.head}>
        <div className={styles.headTop}>
          <div className="cluster">
            <ProcessMark type={process.type} restricted={process.accessRestriction === 'restricted'} />
            <AppLink href={processPath(process.id)}>{process.reference}</AppLink>
            <Pill size="sm" tone={meeting.status === 'held' ? 'low' : meeting.status === 'scheduled' ? 'accent' : 'outline'}>
              {meetingStatusLabel(meeting.status)}
            </Pill>
            <Pill size="sm" tone="outline">
              {t('meetings.head.minutePill', { status: minuteStatusLabel(meeting.minute.status) })}
            </Pill>
          </div>
          <div className={styles.headActions}>
            {!chair ? (
              <Button variant="secondary" icon={<Maximize2 size={16} aria-hidden="true" />} onClick={toggleChair}>
                {t('meetings.head.chairMode')}
              </Button>
            ) : null}
            {meeting.status !== 'held' ? (
              <Button variant="primary" icon={<CheckCircle2 size={16} aria-hidden="true" />} onClick={closeMeeting}>
                {t('meetings.head.close')}
              </Button>
            ) : null}
          </div>
        </div>
        <div>
          <h1>{meeting.title}</h1>
          <div className={styles.meta}>
            <span>{meetingTypeLabel(meeting.type)}</span>
            <span>{t('meetings.head.when', { date: formatDate(meeting.scheduledAt), start: formatTime(meeting.scheduledAt), hasEnd: meeting.endsAt ? 'yes' : 'no', end: meeting.endsAt ? formatTime(meeting.endsAt) : '' })}</span>
            <span>{meeting.location}</span>
            <span>{t('meetings.head.chair', { name: meeting.chairName })}</span>
            {meeting.minuteTakerName ? <span>{t('meetings.head.minutes', { name: meeting.minuteTakerName })}</span> : null}
            {subjects.map((s) => (
              <AppLink key={s.id} href={personPath(s.id)}>
                {fullName(s)}
              </AppLink>
            ))}
          </div>
        </div>
      </header>

      <div className={styles.phase} role="group" aria-label={t('meetings.head.phaseGroup')}>
        {(['before', 'during', 'after'] as Phase[]).map((p) => (
          <button key={p} type="button" className={styles.phaseButton} aria-pressed={phase === p} onClick={() => setPhase(p)}>
            {p === 'before' ? t('meetings.phase.before') : p === 'during' ? t('meetings.phase.during') : t('meetings.phase.after')}
          </button>
        ))}
      </div>

      <ScreenState state={state}>
        {phase === 'before' ? (
          <div className={styles.grid}>
            <Sheet className={styles.col6}>
              <SheetHead title={t('meetings.before.invites.title')} meta={t('meetings.before.invites.meta')} actions={<Button size="sm" variant="secondary" icon={<UserPlus size={14} aria-hidden="true" />} onClick={generateInvites}>{t('meetings.before.invites.generate')}</Button>} />
              <SheetBody>
                <div className={styles.invitees}>
                  {meeting.invitees.map((i, idx) => (
                    <div key={`${i.name}-${idx}`} className={styles.invitee}>
                      <span className={styles.inviteeName}>
                        <AgencyMark agency={i.agency} hideLabel /> {t('meetings.before.invites.person', { required: i.required ? 'yes' : 'no', name: i.name, role: i.role })}
                      </span>
                      <Pill size="sm" tone={i.attendance === 'accepted' || i.attendance === 'present' ? 'low' : i.attendance === 'declined' || i.attendance === 'apologies' ? 'medium' : 'outline'}>
                        {attendanceLabel(i.attendance)}
                      </Pill>
                      <span className={styles.inviteeMeta}>{t('meetings.before.invites.reason', { reason: i.reason, hasRule: i.needToKnowRowId ? 'yes' : 'no', rowId: i.needToKnowRowId ?? '' })}</span>
                    </div>
                  ))}
                </div>
              </SheetBody>
            </Sheet>
            <Sheet className={styles.col6}>
              <SheetHead title={t('meetings.before.requests.title')} meta={t('meetings.before.requests.meta', { returned: meeting.preMeetingRequests.filter((r) => r.status === 'returned' || r.status === 'nothing-known').length, total: meeting.preMeetingRequests.length })} />
              <SheetBody>
                <div className={styles.invitees}>
                  {meeting.preMeetingRequests.map((r) => (
                    <div key={r.id} className={styles.invitee}>
                      <span className={styles.inviteeName}>
                        <AgencyMark agency={r.agency} hideLabel /> {r.toName}
                      </span>
                      <span className="cluster">
                        <Pill size="sm" tone={r.status === 'returned' ? 'low' : r.status === 'nothing-known' ? 'outline' : r.dueAt < now.toISOString().slice(0, 10) ? 'critical' : 'medium'}>
                          {r.status === 'sent' && r.dueAt < now.toISOString().slice(0, 10) ? t('meetings.before.requests.overdue') : researchStatusLabel(r.status)}
                        </Pill>
                        {r.status === 'sent' || r.status === 'overdue' ? (
                          <Button size="sm" variant="quiet" onClick={() => setReturning({ id: r.id, summary: '' })}>
                            {t('meetings.before.requests.recordReturn')}
                          </Button>
                        ) : null}
                      </span>
                      <span className={styles.inviteeMeta}>{t('meetings.before.requests.sentDue', { sent: formatDate(r.sentAt), due: formatDate(r.dueAt), summary: r.returnSummary ?? '' })}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.form} style={{ marginTop: 12 }}>
                  <strong>{t('meetings.before.requests.sendTitle')}</strong>
                  <div className="cluster" style={{ alignItems: 'flex-end' }}>
                    <SelectField label={t('meetings.before.requests.agency')} value={requestForm.agency} onChange={(e) => setRequestForm({ ...requestForm, agency: e.target.value as Agency, to: '' })} options={AGENCIES.map((a) => ({ value: a, label: agencyShort(a) }))} />
                    <SelectField label={t('meetings.before.requests.to')} value={requestForm.to} onChange={(e) => setRequestForm({ ...requestForm, to: e.target.value })} placeholder={t('meetings.before.requests.toPlaceholder')} options={personas.filter((u) => u.agency === requestForm.agency).map((u) => ({ value: u.id, label: `${userName(u)}, ${roleLabel(u.roleId)}` }))} />
                    <DateField label={t('meetings.before.requests.due')} hint={null} value={requestForm.due} onChange={(due) => setRequestForm({ ...requestForm, due })} />
                    <Button variant="secondary" icon={<Send size={14} aria-hidden="true" />} onClick={sendRequest} disabled={!requestForm.due}>
                      {t('meetings.before.requests.send')}
                    </Button>
                  </div>
                </div>
              </SheetBody>
            </Sheet>
            <Sheet className={styles.col12}>
              <SheetHead title={t('meetings.before.pack.title')} meta={t('meetings.before.pack.meta')} actions={subject ? <Button size="sm" variant="secondary" icon={<Printer size={14} aria-hidden="true" />} onClick={() => navigate(`${chronologyPath(subject.id)}?view=print`)}>{t('meetings.before.pack.preview')}</Button> : undefined} />
              <SheetBody>
                {meeting.pack.length === 0 ? <p style={{ color: 'var(--color-ink-3)' }}>{t('meetings.before.pack.empty')}</p> : null}
                {meeting.pack.map((pk) => (
                  <div key={pk.id} className={styles.packItem}>
                    <CheckboxField label={pk.label} checked={pk.included} onChange={(e) => update({ pack: meeting.pack.map((x) => (x.id === pk.id ? { ...x, included: e.target.checked } : x)) })} />
                    <span className={styles.packMeta}>
                      {t('meetings.before.pack.itemMeta', { kind: packItemKindLabel(pk.kind), hasWindow: pk.windowFrom ? 'yes' : 'no', from: pk.windowFrom ? formatDate(pk.windowFrom) : '', to: pk.windowTo ? formatDate(pk.windowTo) : t('meetings.before.pack.today'), hasRef: pk.ref ? 'yes' : 'no', ref: pk.ref ?? '' })}
                    </span>
                  </div>
                ))}
              </SheetBody>
            </Sheet>
          </div>
        ) : null}

        {phase === 'during' ? (
          <div className={styles.grid}>
            <Sheet className={styles.col6}>
              <SheetHead title={t('meetings.during.agenda.title')} />
              <SheetBody>
                <ol className={styles.agenda}>
                  {meeting.agenda.map((a, i) => (
                    <li key={a.id} className={styles.agendaItem} data-status={a.status} aria-current={a.status === 'current' ? 'step' : undefined}>
                      <span className={styles.agendaNumber}>{i + 1}</span>
                      <span>{a.title}</span>
                      <span className="cluster">
                        {a.status !== 'done' ? (
                          <Button size="sm" variant={a.status === 'current' ? 'primary' : 'quiet'} icon={a.status === 'current' ? <CheckCircle2 size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />} onClick={() => update({ agenda: meeting.agenda.map((x) => (x.id === a.id ? { ...x, status: a.status === 'current' ? 'done' : 'current' } : x.status === 'current' && a.status !== 'current' ? { ...x, status: 'done' } : x)) })}>
                            {a.status === 'current' ? t('meetings.during.agenda.done') : t('meetings.during.agenda.start')}
                          </Button>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </SheetBody>
            </Sheet>
            <Sheet className={styles.col6} tone="paper">
              <SheetHead title={t('meetings.during.views.title')} meta={t('meetings.during.views.meta', { count: views.length })} />
              <SheetBody>
                <div className={styles.voices}>
                  {views.map((v) => {
                    const p = personById(data, v.personId);
                    return <VoiceBlock key={v.id} record={v} personName={p ? (p.preferredName ?? p.givenName) : t('common.person.family')} size="sm" />;
                  })}
                </div>
                {availableViews.length > 0 ? (
                  <div className={styles.form} style={{ marginTop: 12 }}>
                    <SelectField label={t('meetings.during.views.readInto')} value="" onChange={(e) => e.target.value && update({ viewsRecordIds: [...meeting.viewsRecordIds, e.target.value] })} placeholder={t('meetings.during.views.placeholder')} options={availableViews.map((v) => ({ value: v.id, label: `${formatDate(v.recordedAt)}: ${v.content.slice(0, 60)}` }))} />
                  </div>
                ) : null}
              </SheetBody>
            </Sheet>
            <Sheet className={styles.col12}>
              <SheetHead title={t('meetings.during.attendance.title')} meta={t('meetings.during.attendance.meta', { count: meeting.invitees.filter((i) => i.attendance === 'present' || i.attendance === 'remote').length })} />
              <SheetBody>
                <div className={styles.attendance}>
                  {meeting.invitees.map((i, idx) => (
                    <div key={`${i.name}-${idx}`} className={styles.invitee}>
                      <span className={styles.inviteeName}>
                        <AgencyMark agency={i.agency} hideLabel /> {i.name}
                      </span>
                      <label>
                        <span className="visually-hidden">{t('meetings.during.attendance.selectLabel', { name: i.name })}</span>
                        <select className={styles.attendanceSelect} value={i.attendance} onChange={(e) => update({ invitees: meeting.invitees.map((x, j) => (j === idx ? { ...x, attendance: e.target.value as Meeting['invitees'][number]['attendance'] } : x)) })}>
                          {ATTENDANCE.map((a) => (
                            <option key={a} value={a}>
                              {attendanceLabel(a)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className={styles.inviteeMeta}>{i.role}</span>
                    </div>
                  ))}
                </div>
              </SheetBody>
            </Sheet>
            <Sheet className={styles.col6}>
              <SheetHead title={t('meetings.during.shared.title')} meta={t('meetings.during.shared.meta')} />
              <SheetBody>
                <div className={styles.shared}>
                  {meeting.informationShared.map((s) => (
                    <div key={s.id} className={styles.sharedItem}>
                      <span className={styles.sharedHead}>
                        <AgencyMark agency={s.agency} /> {s.byName} <span className={styles.sharedMeta}>{formatDateTime(s.at)}</span>
                      </span>
                      <span>{s.summary}</span>
                      <span className={styles.sharedMeta}>{t('meetings.during.shared.relevance', { relevance: s.relevance })}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.form} style={{ marginTop: 12 }}>
                  <strong>{t('meetings.during.shared.addTitle', { agency: agencyShort(user.agency) })}</strong>
                  <TextareaField label={t('meetings.during.shared.summary')} value={shareForm.summary} onChange={(e) => setShareForm({ ...shareForm, summary: e.target.value })} />
                  <TextField label={t('meetings.during.shared.relevanceField')} value={shareForm.relevance} onChange={(e) => setShareForm({ ...shareForm, relevance: e.target.value })} />
                  <Button variant="secondary" onClick={addShared} disabled={shareForm.summary.trim().length < 5}>
                    {t('meetings.during.shared.record')}
                  </Button>
                </div>
              </SheetBody>
            </Sheet>
            <Sheet className={styles.col6}>
              <SheetHead title={t('meetings.during.decisions.title')} meta={t('meetings.during.decisions.meta', { count: meeting.decisions.length })} />
              <SheetBody>
                <div className={styles.shared}>
                  {meeting.decisions.map((d) => (
                    <div key={d.id} className={styles.decision}>
                      <span className={styles.decisionQ}>{d.question}</span>
                      <span>{d.decision}</span>
                      <span className={styles.sharedMeta}>{t('meetings.during.decisions.rationale', { rationale: d.rationale, name: d.decidedByName, when: formatDateTime(d.decidedAt) })}</span>
                      {d.dissent.map((x, i) => (
                        <span key={i} className={styles.dissent}>
                          {t('meetings.during.decisions.dissent', { name: x.byName, agency: agencyShort(x.agency), text: x.text })}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
                <div className={styles.form} style={{ marginTop: 12 }}>
                  <strong>{t('meetings.during.decisions.addTitle')}</strong>
                  <TextField label={t('meetings.during.decisions.question')} value={decisionForm.question} onChange={(e) => setDecisionForm({ ...decisionForm, question: e.target.value })} />
                  <TextField label={t('meetings.during.decisions.decision')} value={decisionForm.decision} onChange={(e) => setDecisionForm({ ...decisionForm, decision: e.target.value })} />
                  <TextareaField label={t('meetings.during.decisions.rationaleField')} value={decisionForm.rationale} onChange={(e) => setDecisionForm({ ...decisionForm, rationale: e.target.value })} />
                  <div className="cluster" style={{ alignItems: 'flex-end' }}>
                    <SelectField label={t('meetings.during.decisions.dissentBy')} value={decisionForm.dissentBy} onChange={(e) => setDecisionForm({ ...decisionForm, dissentBy: e.target.value })} placeholder={t('meetings.during.decisions.noDissent')} options={meeting.invitees.filter((i) => i.userId).map((i) => ({ value: i.userId!, label: `${i.name} (${agencyShort(i.agency)})` }))} />
                    <TextField label={t('meetings.during.decisions.dissentText')} value={decisionForm.dissentText} onChange={(e) => setDecisionForm({ ...decisionForm, dissentText: e.target.value })} />
                  </div>
                  <Button variant="secondary" onClick={addDecision} disabled={decisionForm.question.trim().length < 5 || decisionForm.decision.trim().length < 2}>
                    {t('meetings.during.decisions.record')}
                  </Button>
                </div>
              </SheetBody>
            </Sheet>
            <Sheet className={styles.col12}>
              <SheetHead title={t('meetings.during.actions.title')} meta={t('meetings.during.actions.meta', { count: meetingActions.length })} />
              <SheetBody>
                <div className={styles.liveActions}>
                  {meetingActions.map((a) => (
                    <div key={a.id} className={styles.liveAction}>
                      <span>{a.title}</span>
                      <span>
                        {a.ownerName} ({agencyShort(a.ownerAgency)})
                      </span>
                      <Pill size="sm" tone={a.status === 'complete' ? 'low' : a.due < now.toISOString().slice(0, 10) ? 'critical' : 'outline'}>
                        {a.status === 'complete' ? t('meetings.during.actions.complete') : t('meetings.during.actions.due', { date: formatDate(a.due) })}
                      </Pill>
                    </div>
                  ))}
                </div>
                <div className={styles.form} style={{ marginTop: 12 }}>
                  <div className="cluster" style={{ alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 320px' }}>
                      <TextField label={t('meetings.during.actions.action')} value={actionForm.title} onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })} placeholder={t('meetings.during.actions.actionPlaceholder')} />
                    </div>
                    <SelectField label={t('meetings.during.actions.owner')} value={actionForm.owner} onChange={(e) => setActionForm({ ...actionForm, owner: e.target.value })} placeholder={t('meetings.during.actions.ownerPlaceholder')} options={meeting.invitees.filter((i) => i.userId).map((i) => ({ value: i.userId!, label: `${i.name} (${agencyShort(i.agency)})` }))} />
                    <DateField label={t('meetings.during.actions.dueField')} hint={null} value={actionForm.due} onChange={(due) => setActionForm({ ...actionForm, due })} />
                    <Button variant="primary" onClick={addAction} disabled={!actionForm.owner || !actionForm.due || actionForm.title.trim().length < 5}>
                      {t('meetings.during.actions.capture')}
                    </Button>
                  </div>
                </div>
              </SheetBody>
            </Sheet>
          </div>
        ) : null}

        {phase === 'after' ? (
          <div className={styles.grid}>
            <Sheet className={styles.col6}>
              <SheetHead title={t('meetings.after.minute.title')} meta={t('meetings.after.minute.meta', { status: minuteStatusLabel(meeting.minute.status), hasApproved: meeting.minute.approvedAt ? 'yes' : 'no', approved: meeting.minute.approvedAt ? formatDateTime(meeting.minute.approvedAt) : '', hasDistributed: meeting.minute.distributedAt ? 'yes' : 'no', distributed: meeting.minute.distributedAt ? formatDateTime(meeting.minute.distributedAt) : '' })} />
              <SheetBody>
                <div className={styles.minuteSteps}>
                  <Button variant="secondary" disabled={meeting.minute.status !== 'not-started'} onClick={() => update({ minute: { ...meeting.minute, status: 'draft', draftedAt: now.toISOString() } })}>
                    {t('meetings.after.minute.markDraft')}
                  </Button>
                  <Button variant="secondary" disabled={meeting.minute.status !== 'draft'} onClick={() => update({ minute: { ...meeting.minute, status: 'chair-approved', approvedAt: now.toISOString() } })}>
                    {t('meetings.after.minute.chairApproves')}
                  </Button>
                  <Button variant="primary" disabled={meeting.minute.status !== 'chair-approved' || meeting.distribution.length === 0} onClick={distribute}>
                    {t('meetings.after.minute.distribute', { count: meeting.distribution.length })}
                  </Button>
                  <Button variant="secondary" icon={<Printer size={16} aria-hidden="true" />} onClick={() => navigate(`${route.path}?view=print`)}>
                    {t('meetings.after.minute.print')}
                  </Button>
                </div>
                <div className={styles.form} style={{ marginTop: 12 }}>
                  <div className="cluster" style={{ alignItems: 'flex-end' }}>
                    <DateField label={t('meetings.after.minute.reviewDate')} hint={null} value={reviewDate} onChange={setReviewDate} />
                    <Button
                      variant="secondary"
                      onClick={() => {
                        update({ reviewDate: reviewDate || undefined });
                        toast({ title: t('meetings.after.minute.reviewToast'), text: reviewDate ? formatDate(reviewDate) : t('meetings.after.minute.reviewCleared') });
                      }}
                    >
                      {t('meetings.after.minute.setReviewDate')}
                    </Button>
                  </div>
                </div>
              </SheetBody>
            </Sheet>
            <Sheet className={styles.col6}>
              <SheetHead title={t('meetings.after.clocks.title')} meta={t('meetings.after.clocks.meta')} />
              <SheetBody>
                <div className="stack">
                  {clocks.map((c) => (
                    <ClockNumeral key={c.triggerId} daysRemaining={c.daysRemaining} band={c.band} status={c.status} label={c.label} sub={t('meetings.after.clocks.sub', { date: formatDate(c.dueAt), source: (c.overridden ? c.overrideReason : c.sourceRef) ?? '' })} size="sm" />
                  ))}
                </div>
              </SheetBody>
            </Sheet>
            <Sheet className={styles.col12}>
              <SheetHead title={t('meetings.after.distribution.title')} meta={t('meetings.after.distribution.meta')} actions={<Button size="sm" variant="secondary" onClick={generateDistribution}>{t('meetings.after.distribution.generate')}</Button>} />
              <SheetBody>
                <div className={styles.distribution}>
                  {meeting.distribution.map((d) => (
                    <div key={d.id} className={styles.invitee}>
                      <span className={styles.inviteeName}>
                        <AgencyMark agency={d.agency} hideLabel /> {d.recipientName}, {d.role}
                      </span>
                      <label>
                        <span className="visually-hidden">{t('meetings.after.distribution.levelLabel', { name: d.recipientName })}</span>
                        <select className={styles.attendanceSelect} value={d.detailLevel} disabled={meeting.minute.status === 'distributed'} onChange={(e) => update({ distribution: meeting.distribution.map((x) => (x.id === d.id ? { ...x, detailLevel: e.target.value as DetailLevel } : x)) })}>
                          {DETAIL_LEVELS.map((l) => (
                            <option key={l} value={l}>
                              {detailLevelLabel(l)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className={styles.inviteeMeta}>{t('meetings.after.distribution.reason', { reason: d.reason, hasFields: d.fields ? 'yes' : 'no', fields: d.fields?.join('; ') ?? '', sent: d.sharingRecordId ? 'yes' : 'no' })}</span>
                    </div>
                  ))}
                </div>
              </SheetBody>
            </Sheet>
          </div>
        ) : null}
      </ScreenState>

      <Dialog
        open={returning !== null}
        onClose={() => setReturning(null)}
        title={t('meetings.returnDialog.title')}
        actions={
          <>
            <Button variant="quiet" onClick={() => setReturning(null)}>
              {t('common.actions.cancel')}
            </Button>
            <Button variant="primary" disabled={(returning?.summary.trim().length ?? 0) < 5} onClick={recordReturn}>
              {t('meetings.returnDialog.confirm')}
            </Button>
          </>
        }
      >
        <TextareaField label={t('meetings.returnDialog.summary')} required value={returning?.summary ?? ''} onChange={(e) => setReturning(returning ? { ...returning, summary: e.target.value } : null)} />
      </Dialog>
    </div>
  );
}
