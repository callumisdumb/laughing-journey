'use client';

import { AGENCIES, AGENCY_SHORT, DETAIL_LEVELS, DETAIL_LEVEL_LABELS, MEETING_TYPE_LABELS, PROCESS_SHORT, ROLE_DEFINITIONS, applyMeetingTransition, contextFor, formatDate, formatDateTime, formatTime, isExcludedParty, resolveNeedToKnow, type Action, type Agency, type DetailLevel, type LawfulBasisRecord, type Meeting, type SharingRecord } from '@mas/domain';
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
    if (meeting && process) audit({ act: process.classification === 'restricted' ? 'read-restricted' : 'read', targetType: 'meeting', targetId: meeting.id, targetLabel: meeting.title, processId: process.id, restricted: process.classification === 'restricted' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  if (!user) return null;
  if (!meeting || !process) {
    return (
      <div className="page">
        <EmptyState title="Meeting not found" text="This meeting does not exist in the demo dataset." actions={<AppLink href="/meetings">All meetings</AppLink>} />
      </div>
    );
  }
  if (route.query.get('view') === 'print') return <MinutesPrintPack meetingId={meetingId} />;
  const access = accessForUser(data, config, user, process, grants, now);
  const invited = meeting.invitees.some((i) => i.userId === user.id) || meeting.chairUserId === user.id || meeting.minuteTakerUserId === user.id;
  if (access.level === 'none' || (!invited && access.level !== 'full')) {
    return (
      <div className="page">
        <RestrictedState title={`${MEETING_TYPE_LABELS[meeting.type]}: not on the distribution list`} reason={access.level === 'none' ? access.reason : 'You are not invited to this meeting and are not a full member of the case. Meeting records go to attendees and the distribution list only.'} breakGlass="unavailable" />
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
        additions.push({ userId: u.id, name: userName(u), agency: u.agency, role: ROLE_DEFINITIONS[u.roleId].label, required: true, attendance: 'invited', reason: `${r.label}: ${r.reason}`, needToKnowRowId: r.rowId });
      }
    }
    update({ invitees: [...meeting!.invitees, ...additions] });
    const ruleText = res.exclusions.length > 0 ? `Excluded by rule: ${res.exclusions.map((e) => e.label).join('; ')}.` : 'Every invitee carries the reason they are invited.';
    const roleText = excludedByRole.size > 0 ? ` ${excludedByRole.size} ${excludedByRole.size === 1 ? 'person was' : 'people were'} left off because of their case role.` : '';
    toast({ title: additions.length === 0 ? 'Invite list already complete' : `${additions.length} ${additions.length === 1 ? 'invitee' : 'invitees'} added from need-to-know`, text: `${ruleText}${roleText}`, tone: 'success' });
  }

  function sendRequest() {
    if (!requestForm.due) return;
    const to = data.users.find((u) => u.id === requestForm.to);
    update({ preMeetingRequests: [...meeting!.preMeetingRequests, { id: newId('pmr'), agency: requestForm.agency, toName: to ? userName(to) : AGENCY_SHORT[requestForm.agency], toUserId: to?.id, sentAt: now.toISOString(), dueAt: requestForm.due, status: 'sent' }] });
    setRequestForm({ agency: 'health', to: '', due: '' });
    toast({ title: 'Information request sent', text: `${to ? userName(to) : AGENCY_SHORT[requestForm.agency]} will see it on their worklist with the purpose and lawful basis.`, tone: 'success' });
  }

  function recordReturn() {
    if (!returning) return;
    update({ preMeetingRequests: meeting!.preMeetingRequests.map((r) => (r.id === returning.id ? { ...r, status: 'returned', returnSummary: returning.summary, returnedAt: now.toISOString() } : r)), pack: [...meeting!.pack, { id: newId('pk'), kind: 'report', label: `${AGENCY_SHORT[meeting!.preMeetingRequests.find((r) => r.id === returning.id)?.agency ?? 'health']} report`, ref: returning.id, included: true }] });
    setReturning(null);
    toast({ title: 'Return recorded and added to the pack', tone: 'success' });
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
    audit({ act: 'edit', targetType: 'meeting', targetId: meeting!.id, targetLabel: `${meeting!.title} held`, processId: process!.id });
    toast({ title: 'Meeting closed', text: `Clocks completed: ${result.completed.join(', ') || 'none'}. Clocks started: ${result.started.join(', ') || 'none'}. Minute is now a draft.`, tone: 'success' });
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
      entries.push({ id: newId('dist'), recipientName: i.name, recipientUserId: i.userId, agency: i.agency, role: i.role, detailLevel: 'full', reason: 'Attendee', });
    }
    for (const r of res.recipients) {
      if (r.detailLevel === 'full') continue;
      const u = data.users.filter((x) => x.agency === r.agency && (r.role === 'any' ? true : x.roleId === r.role)).find((x) => !excluded(x.id));
      if (!u || entries.some((e) => e.recipientUserId === u.id) || meeting!.distribution.some((e) => e.recipientUserId === u.id)) continue;
      entries.push({ id: newId('dist'), recipientName: userName(u), recipientUserId: u.id, agency: u.agency, role: ROLE_DEFINITIONS[u.roleId].label, detailLevel: r.detailLevel, fields: r.fields, reason: `${r.label}: ${r.reason}` });
    }
    update({ distribution: [...meeting!.distribution, ...entries] });
    const roleText = excludedByRole.size > 0 ? ` ${excludedByRole.size} ${excludedByRole.size === 1 ? 'person was' : 'people were'} left off because of their case role.` : '';
    toast({ title: `${entries.length} recipients added`, text: `Detail level per recipient comes from the need-to-know rows for the ${PROCESS_SHORT[process!.type]} ${process!.stage} stage. Exclusions applied: ${res.exclusions.map((e) => e.label).join('; ') || 'none'}.${roleText}`, tone: 'success' });
  }

  function distribute() {
    const lb: LawfulBasisRecord = { id: newId('lb'), synthetic: true, purpose: `Distribution of the minute of ${meeting!.title}`, article6: '6(1)(e) public task', article9Condition: '9(2)(g) substantial public interest, DPA 2018 Sch 1 Pt 2 para 18 (safeguarding)', article10Criminal: process!.type === 'mappa' || process!.type === 'marac' ? 'DPA 2018 s10 and Sch 1' : 'not applicable', statutoryGateway: [process!.type === 'cp' ? 'National Guidance for Child Protection in Scotland 2021' : process!.type === 'asp' ? 'ASP (Scotland) Act 2007 s5' : process!.type === 'mappa' ? 'Management of Offenders etc. (Scotland) Act 2005 s10' : process!.type === 'marac' ? 'MARAC Operating Protocol' : 'AWI (Scotland) Act 2000'], necessityAndProportionality: 'Each recipient is on the need-to-know list for this stage and receives only the detail level the rules allow.', consentStatus: 'not-required', authorisedByUserId: user!.id, authorisedByName: userName(user!), createdAt: now.toISOString() };
    upsert('lawfulBases', lb);
    const shares: SharingRecord[] = meeting!.distribution.map((d) => ({ id: newId('shr'), synthetic: true, processId: process!.id, subjectId: meeting!.subjectIds[0] ?? '', stage: process!.stage, recipient: { userId: d.recipientUserId, name: d.recipientName, agency: d.agency, role: d.role }, detailLevel: d.detailLevel, fields: d.fields, lawfulBasisId: lb.id, channel: 'in-app' as const, status: 'sent' as const, createdAt: now.toISOString(), sentAt: now.toISOString(), reason: d.reason, createdByUserId: user!.id, createdByName: userName(user!), summary: `Minute of ${meeting!.title} (${DETAIL_LEVEL_LABELS[d.detailLevel]})` }));
    for (const s of shares) upsert('sharingRecords', s);
    update({ minute: { ...meeting!.minute, status: 'distributed', distributedAt: now.toISOString() }, distribution: meeting!.distribution.map((d, i) => ({ ...d, sharingRecordId: shares[i]?.id })) });
    const recordClocks = process!.clocks.map((c) => (c.ruleId === 'cp.cppm.record.distribute' && !c.completedAt ? { ...c, completedAt: now.toISOString(), note: 'Record distributed from the meeting workspace' } : c));
    if (recordClocks.some((c, i) => c !== process!.clocks[i])) upsert('processes', { ...process!, clocks: recordClocks });
    audit({ act: 'share', targetType: 'meeting', targetId: meeting!.id, targetLabel: `Minute distributed to ${shares.length} recipients`, processId: process!.id, restricted: process!.classification === 'restricted' });
    toast({ title: `Minute distributed to ${shares.length} recipients`, text: 'Each share carries the lawful basis and the reason the recipient needs it.', tone: 'success' });
  }

  const state = dev ?? 'ready';

  return (
    <div className={`page ${chair ? styles.chair : ''}`}>
      {chair ? (
        <div className={styles.chairBanner}>
          <span>Chair mode: larger type, minimal chrome. The current agenda item is enlarged.</span>
          <Button size="sm" variant="secondary" icon={<Minimize2 size={14} aria-hidden="true" />} onClick={toggleChair}>
            Exit chair mode
          </Button>
        </div>
      ) : null}
      <header className={styles.head}>
        <div className={styles.headTop}>
          <div className="cluster">
            <ProcessMark type={process.type} restricted={process.classification === 'restricted'} />
            <AppLink href={processPath(process.id)}>{process.reference}</AppLink>
            <Pill size="sm" tone={meeting.status === 'held' ? 'low' : meeting.status === 'scheduled' ? 'accent' : 'outline'}>
              {meeting.status}
            </Pill>
            <Pill size="sm" tone="outline">
              Minute: {meeting.minute.status.replace(/-/g, ' ')}
            </Pill>
          </div>
          <div className={styles.headActions}>
            {!chair ? (
              <Button variant="secondary" icon={<Maximize2 size={16} aria-hidden="true" />} onClick={toggleChair}>
                Chair mode
              </Button>
            ) : null}
            {meeting.status !== 'held' ? (
              <Button variant="primary" icon={<CheckCircle2 size={16} aria-hidden="true" />} onClick={closeMeeting}>
                Close meeting and update clocks
              </Button>
            ) : null}
          </div>
        </div>
        <div>
          <h1>{meeting.title}</h1>
          <div className={styles.meta}>
            <span>{MEETING_TYPE_LABELS[meeting.type]}</span>
            <span>
              {formatDate(meeting.scheduledAt)} {formatTime(meeting.scheduledAt)}
              {meeting.endsAt ? ` to ${formatTime(meeting.endsAt)}` : ''}
            </span>
            <span>{meeting.location}</span>
            <span>Chair {meeting.chairName}</span>
            {meeting.minuteTakerName ? <span>Minutes {meeting.minuteTakerName}</span> : null}
            {subjects.map((s) => (
              <AppLink key={s.id} href={personPath(s.id)}>
                {fullName(s)}
              </AppLink>
            ))}
          </div>
        </div>
      </header>

      <div className={styles.phase} role="group" aria-label="Meeting phase">
        {(['before', 'during', 'after'] as Phase[]).map((p) => (
          <button key={p} type="button" className={styles.phaseButton} aria-pressed={phase === p} onClick={() => setPhase(p)}>
            {p === 'before' ? 'Before' : p === 'during' ? 'During' : 'After'}
          </button>
        ))}
      </div>

      <ScreenState state={state}>
        {phase === 'before' ? (
          <div className={styles.grid}>
            <Sheet className={styles.col6}>
              <SheetHead title="Invite list" meta="Generated from need-to-know for this stage. Every invitee carries the reason." actions={<Button size="sm" variant="secondary" icon={<UserPlus size={14} aria-hidden="true" />} onClick={generateInvites}>Generate from need-to-know</Button>} />
              <SheetBody>
                <div className={styles.invitees}>
                  {meeting.invitees.map((i, idx) => (
                    <div key={`${i.name}-${idx}`} className={styles.invitee}>
                      <span className={styles.inviteeName}>
                        <AgencyMark agency={i.agency} hideLabel /> {i.name}, {i.role}
                        {i.required ? '' : ' (optional)'}
                      </span>
                      <Pill size="sm" tone={i.attendance === 'accepted' || i.attendance === 'present' ? 'low' : i.attendance === 'declined' || i.attendance === 'apologies' ? 'medium' : 'outline'}>
                        {i.attendance}
                      </Pill>
                      <span className={styles.inviteeMeta}>
                        {i.reason}
                        {i.needToKnowRowId ? ` (rule ${i.needToKnowRowId})` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </SheetBody>
            </Sheet>
            <Sheet className={styles.col6}>
              <SheetHead title="Pre-meeting information requests and returns" meta={`${meeting.preMeetingRequests.filter((r) => r.status === 'returned' || r.status === 'nothing-known').length} of ${meeting.preMeetingRequests.length} back`} />
              <SheetBody>
                <div className={styles.invitees}>
                  {meeting.preMeetingRequests.map((r) => (
                    <div key={r.id} className={styles.invitee}>
                      <span className={styles.inviteeName}>
                        <AgencyMark agency={r.agency} hideLabel /> {r.toName}
                      </span>
                      <span className="cluster">
                        <Pill size="sm" tone={r.status === 'returned' ? 'low' : r.status === 'nothing-known' ? 'outline' : r.dueAt < now.toISOString().slice(0, 10) ? 'critical' : 'medium'}>
                          {r.status === 'sent' && r.dueAt < now.toISOString().slice(0, 10) ? 'overdue' : r.status.replace('-', ' ')}
                        </Pill>
                        {r.status === 'sent' || r.status === 'overdue' ? (
                          <Button size="sm" variant="quiet" onClick={() => setReturning({ id: r.id, summary: '' })}>
                            Record return
                          </Button>
                        ) : null}
                      </span>
                      <span className={styles.inviteeMeta}>
                        Sent {formatDate(r.sentAt)}, due {formatDate(r.dueAt)}. {r.returnSummary ?? ''}
                      </span>
                    </div>
                  ))}
                </div>
                <div className={styles.form} style={{ marginTop: 12 }}>
                  <strong>Send a request</strong>
                  <div className="cluster" style={{ alignItems: 'flex-end' }}>
                    <SelectField label="Agency" value={requestForm.agency} onChange={(e) => setRequestForm({ ...requestForm, agency: e.target.value as Agency, to: '' })} options={AGENCIES.map((a) => ({ value: a, label: AGENCY_SHORT[a] }))} />
                    <SelectField label="To" value={requestForm.to} onChange={(e) => setRequestForm({ ...requestForm, to: e.target.value })} placeholder="Choose a person" options={personas.filter((u) => u.agency === requestForm.agency).map((u) => ({ value: u.id, label: `${userName(u)}, ${ROLE_DEFINITIONS[u.roleId].label}` }))} />
                    <DateField label="Due" value={requestForm.due} onChange={(due) => setRequestForm({ ...requestForm, due })} />
                    <Button variant="secondary" icon={<Send size={14} aria-hidden="true" />} onClick={sendRequest} disabled={!requestForm.due}>
                      Send request
                    </Button>
                  </div>
                </div>
              </SheetBody>
            </Sheet>
            <Sheet className={styles.col12}>
              <SheetHead title="Pack builder" meta="Choose the chronology window, the reports and the views that go in the pack." actions={subject ? <Button size="sm" variant="secondary" icon={<Printer size={14} aria-hidden="true" />} onClick={() => navigate(`${chronologyPath(subject.id)}?view=print`)}>Preview chronology pack</Button> : undefined} />
              <SheetBody>
                {meeting.pack.length === 0 ? <p style={{ color: 'var(--color-ink-3)' }}>No pack items yet. Returns you record are added automatically.</p> : null}
                {meeting.pack.map((pk) => (
                  <div key={pk.id} className={styles.packItem}>
                    <CheckboxField label={pk.label} checked={pk.included} onChange={(e) => update({ pack: meeting.pack.map((x) => (x.id === pk.id ? { ...x, included: e.target.checked } : x)) })} />
                    <span className={styles.packMeta}>
                      {pk.kind}
                      {pk.windowFrom ? `, ${formatDate(pk.windowFrom)} to ${pk.windowTo ? formatDate(pk.windowTo) : 'today'}` : ''}
                      {pk.ref ? `, ${pk.ref}` : ''}
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
              <SheetHead title="Agenda" />
              <SheetBody>
                <ol className={styles.agenda}>
                  {meeting.agenda.map((a, i) => (
                    <li key={a.id} className={styles.agendaItem} data-status={a.status} aria-current={a.status === 'current' ? 'step' : undefined}>
                      <span className={styles.agendaNumber}>{i + 1}</span>
                      <span>{a.title}</span>
                      <span className="cluster">
                        {a.status !== 'done' ? (
                          <Button size="sm" variant={a.status === 'current' ? 'primary' : 'quiet'} icon={a.status === 'current' ? <CheckCircle2 size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />} onClick={() => update({ agenda: meeting.agenda.map((x) => (x.id === a.id ? { ...x, status: a.status === 'current' ? 'done' : 'current' } : x.status === 'current' && a.status !== 'current' ? { ...x, status: 'done' } : x)) })}>
                            {a.status === 'current' ? 'Done' : 'Start'}
                          </Button>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </SheetBody>
            </Sheet>
            <Sheet className={styles.col6} tone="paper">
              <SheetHead title="Views read into the record" meta={views.length === 0 ? 'None yet' : `${views.length} read`} />
              <SheetBody>
                <div className={styles.voices}>
                  {views.map((v) => {
                    const p = personById(data, v.personId);
                    return <VoiceBlock key={v.id} record={v} personName={p ? (p.preferredName ?? p.givenName) : 'Family'} size="sm" />;
                  })}
                </div>
                {availableViews.length > 0 ? (
                  <div className={styles.form} style={{ marginTop: 12 }}>
                    <SelectField label="Read into the record" value="" onChange={(e) => e.target.value && update({ viewsRecordIds: [...meeting.viewsRecordIds, e.target.value] })} placeholder="Choose recorded views" options={availableViews.map((v) => ({ value: v.id, label: `${formatDate(v.recordedAt)}: ${v.content.slice(0, 60)}` }))} />
                  </div>
                ) : null}
              </SheetBody>
            </Sheet>
            <Sheet className={styles.col12}>
              <SheetHead title="Attendance" meta={`${meeting.invitees.filter((i) => i.attendance === 'present' || i.attendance === 'remote').length} present`} />
              <SheetBody>
                <div className={styles.attendance}>
                  {meeting.invitees.map((i, idx) => (
                    <div key={`${i.name}-${idx}`} className={styles.invitee}>
                      <span className={styles.inviteeName}>
                        <AgencyMark agency={i.agency} hideLabel /> {i.name}
                      </span>
                      <label>
                        <span className="visually-hidden">Attendance for {i.name}</span>
                        <select className={styles.attendanceSelect} value={i.attendance} onChange={(e) => update({ invitees: meeting.invitees.map((x, j) => (j === idx ? { ...x, attendance: e.target.value as Meeting['invitees'][number]['attendance'] } : x)) })}>
                          {ATTENDANCE.map((a) => (
                            <option key={a} value={a}>
                              {a}
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
              <SheetHead title="Information shared by agency" meta="Structured, dated, attributable" />
              <SheetBody>
                <div className={styles.shared}>
                  {meeting.informationShared.map((s) => (
                    <div key={s.id} className={styles.sharedItem}>
                      <span className={styles.sharedHead}>
                        <AgencyMark agency={s.agency} /> {s.byName} <span className={styles.sharedMeta}>{formatDateTime(s.at)}</span>
                      </span>
                      <span>{s.summary}</span>
                      <span className={styles.sharedMeta}>Relevance: {s.relevance}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.form} style={{ marginTop: 12 }}>
                  <strong>Add what {AGENCY_SHORT[user.agency]} shared</strong>
                  <TextareaField label="What was shared (facts, briefly)" value={shareForm.summary} onChange={(e) => setShareForm({ ...shareForm, summary: e.target.value })} />
                  <TextField label="Why it is relevant, necessary and proportionate" value={shareForm.relevance} onChange={(e) => setShareForm({ ...shareForm, relevance: e.target.value })} />
                  <Button variant="secondary" onClick={addShared} disabled={shareForm.summary.trim().length < 5}>
                    Record information shared
                  </Button>
                </div>
              </SheetBody>
            </Sheet>
            <Sheet className={styles.col6}>
              <SheetHead title="Decisions, rationale and dissent" meta={`${meeting.decisions.length} recorded`} />
              <SheetBody>
                <div className={styles.shared}>
                  {meeting.decisions.map((d) => (
                    <div key={d.id} className={styles.decision}>
                      <span className={styles.decisionQ}>{d.question}</span>
                      <span>{d.decision}</span>
                      <span className={styles.sharedMeta}>
                        Rationale: {d.rationale} Decided by {d.decidedByName}, {formatDateTime(d.decidedAt)}.
                      </span>
                      {d.dissent.map((x, i) => (
                        <span key={i} className={styles.dissent}>
                          Dissent: {x.byName} ({AGENCY_SHORT[x.agency]}): {x.text}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
                <div className={styles.form} style={{ marginTop: 12 }}>
                  <strong>Record a decision</strong>
                  <TextField label="Question" value={decisionForm.question} onChange={(e) => setDecisionForm({ ...decisionForm, question: e.target.value })} />
                  <TextField label="Decision" value={decisionForm.decision} onChange={(e) => setDecisionForm({ ...decisionForm, decision: e.target.value })} />
                  <TextareaField label="Rationale" value={decisionForm.rationale} onChange={(e) => setDecisionForm({ ...decisionForm, rationale: e.target.value })} />
                  <div className="cluster" style={{ alignItems: 'flex-end' }}>
                    <SelectField label="Dissent by" value={decisionForm.dissentBy} onChange={(e) => setDecisionForm({ ...decisionForm, dissentBy: e.target.value })} placeholder="No dissent" options={meeting.invitees.filter((i) => i.userId).map((i) => ({ value: i.userId!, label: `${i.name} (${AGENCY_SHORT[i.agency]})` }))} />
                    <TextField label="Dissent text" value={decisionForm.dissentText} onChange={(e) => setDecisionForm({ ...decisionForm, dissentText: e.target.value })} />
                  </div>
                  <Button variant="secondary" onClick={addDecision} disabled={decisionForm.question.trim().length < 5 || decisionForm.decision.trim().length < 2}>
                    Record decision
                  </Button>
                </div>
              </SheetBody>
            </Sheet>
            <Sheet className={styles.col12}>
              <SheetHead title="Actions captured live" meta={`${meetingActions.length} on this meeting`} />
              <SheetBody>
                <div className={styles.liveActions}>
                  {meetingActions.map((a) => (
                    <div key={a.id} className={styles.liveAction}>
                      <span>{a.title}</span>
                      <span>
                        {a.ownerName} ({AGENCY_SHORT[a.ownerAgency]})
                      </span>
                      <Pill size="sm" tone={a.status === 'complete' ? 'low' : a.due < now.toISOString().slice(0, 10) ? 'critical' : 'outline'}>
                        {a.status === 'complete' ? 'complete' : `due ${formatDate(a.due)}`}
                      </Pill>
                    </div>
                  ))}
                </div>
                <div className={styles.form} style={{ marginTop: 12 }}>
                  <div className="cluster" style={{ alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 320px' }}>
                      <TextField label="Action" value={actionForm.title} onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })} placeholder="Say what will happen, by whom, by when" />
                    </div>
                    <SelectField label="Owner" value={actionForm.owner} onChange={(e) => setActionForm({ ...actionForm, owner: e.target.value })} placeholder="Choose an attendee" options={meeting.invitees.filter((i) => i.userId).map((i) => ({ value: i.userId!, label: `${i.name} (${AGENCY_SHORT[i.agency]})` }))} />
                    <DateField label="Due" value={actionForm.due} onChange={(due) => setActionForm({ ...actionForm, due })} />
                    <Button variant="primary" onClick={addAction} disabled={!actionForm.owner || !actionForm.due || actionForm.title.trim().length < 5}>
                      Capture action
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
              <SheetHead title="Minute" meta={`Status: ${meeting.minute.status.replace(/-/g, ' ')}${meeting.minute.approvedAt ? `. Chair approved ${formatDateTime(meeting.minute.approvedAt)}` : ''}${meeting.minute.distributedAt ? `. Distributed ${formatDateTime(meeting.minute.distributedAt)}` : ''}`} />
              <SheetBody>
                <div className={styles.minuteSteps}>
                  <Button variant="secondary" disabled={meeting.minute.status !== 'not-started'} onClick={() => update({ minute: { ...meeting.minute, status: 'draft', draftedAt: now.toISOString() } })}>
                    Mark draft
                  </Button>
                  <Button variant="secondary" disabled={meeting.minute.status !== 'draft'} onClick={() => update({ minute: { ...meeting.minute, status: 'chair-approved', approvedAt: now.toISOString() } })}>
                    Chair approves
                  </Button>
                  <Button variant="primary" disabled={meeting.minute.status !== 'chair-approved' || meeting.distribution.length === 0} onClick={distribute}>
                    Distribute to {meeting.distribution.length} recipients
                  </Button>
                  <Button variant="secondary" icon={<Printer size={16} aria-hidden="true" />} onClick={() => navigate(`${route.path}?view=print`)}>
                    Print minutes
                  </Button>
                </div>
                <div className={styles.form} style={{ marginTop: 12 }}>
                  <div className="cluster" style={{ alignItems: 'flex-end' }}>
                    <DateField label="Review date" value={reviewDate} onChange={setReviewDate} />
                    <Button variant="secondary" onClick={() => { update({ reviewDate: reviewDate || undefined }); toast({ title: 'Review date set', text: reviewDate ? formatDate(reviewDate) : 'Cleared' }); }}>
                      Set review date
                    </Button>
                  </div>
                </div>
              </SheetBody>
            </Sheet>
            <Sheet className={styles.col6}>
              <SheetHead title="Clocks after this meeting" meta="Holding the meeting completes and starts clocks by configuration" />
              <SheetBody>
                <div className="stack">
                  {clocks.map((c) => (
                    <ClockNumeral key={c.triggerId} daysRemaining={c.daysRemaining} band={c.band} status={c.status} label={c.label} sub={`Due ${formatDate(c.dueAt)}. ${c.overridden ? c.overrideReason : c.sourceRef}`} size="sm" />
                  ))}
                </div>
              </SheetBody>
            </Sheet>
            <Sheet className={styles.col12}>
              <SheetHead title="Distribution list" meta="Detail level per recipient, from need-to-know. Excluded parties never appear." actions={<Button size="sm" variant="secondary" onClick={generateDistribution}>Generate from need-to-know</Button>} />
              <SheetBody>
                <div className={styles.distribution}>
                  {meeting.distribution.map((d) => (
                    <div key={d.id} className={styles.invitee}>
                      <span className={styles.inviteeName}>
                        <AgencyMark agency={d.agency} hideLabel /> {d.recipientName}, {d.role}
                      </span>
                      <label>
                        <span className="visually-hidden">Detail level for {d.recipientName}</span>
                        <select className={styles.attendanceSelect} value={d.detailLevel} disabled={meeting.minute.status === 'distributed'} onChange={(e) => update({ distribution: meeting.distribution.map((x) => (x.id === d.id ? { ...x, detailLevel: e.target.value as DetailLevel } : x)) })}>
                          {DETAIL_LEVELS.map((l) => (
                            <option key={l} value={l}>
                              {DETAIL_LEVEL_LABELS[l]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className={styles.inviteeMeta}>
                        {d.reason}
                        {d.fields ? `. Fields: ${d.fields.join('; ')}` : ''}
                        {d.sharingRecordId ? '. Sent.' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </SheetBody>
            </Sheet>
          </div>
        ) : null}
      </ScreenState>

      <Dialog open={returning !== null} onClose={() => setReturning(null)} title="Record the return" actions={<><Button variant="quiet" onClick={() => setReturning(null)}>Cancel</Button><Button variant="primary" disabled={(returning?.summary.trim().length ?? 0) < 5} onClick={recordReturn}>Record return and add to pack</Button></>}>
        <TextareaField label="Summary of the return" required value={returning?.summary ?? ''} onChange={(e) => setReturning(returning ? { ...returning, summary: e.target.value } : null)} />
      </Dialog>
    </div>
  );
}
