'use client';

import { AGENCY_SHORT, PLAN_TYPE_LABELS, PROCESS_SHORT, ROLE_DEFINITIONS, VIEWS_KINDS, VIEWS_KIND_LABELS, ageLabel, formatDate, formatDateTime, stageLabel, type Person, type Process, type ViewsRecord } from '@mas/domain';
import { AgencyMark, Button, ClockNumeral, Dialog, EmptyState, Pill, ProcessMark, RestrictedState, SelectField, Sheet, SheetBody, SheetHead, TabPanel, Tabs, Table, TableWrap, TextField, TextareaField, VoiceBlock, useToast } from '@mas/ui';
import { AlertTriangle, ArrowUpRight, Flag, Languages, Lock, Plus, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { chronologyPath, meetingPath, processPath } from '@/lib/routes';
import { useSelection } from '@/lib/selection';
import { accessForUser, clocksForProcess, currentAddress, fullName, membersByAgency, processesInvolving, userName } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useNow } from '@/lib/store';
import { EventList } from '@/features/chronology/EventList';
import { LanesChart } from '@/features/chronology/LanesChart';
import { useChronologyStore } from '@/features/chronology/state';
import { useChronology } from '@/features/chronology/useChronology';
import { NetworkGraph } from './NetworkGraph';
import styles from './Person360.module.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'chronology', label: 'Chronology' },
  { id: 'processes', label: 'Processes' },
  { id: 'voice', label: 'Views and voice' },
  { id: 'documents', label: 'Documents' },
  { id: 'sharing', label: 'Sharing and audit' },
];

function alertTone(kind: Person['alerts'][number]['kind']) {
  switch (kind) {
    case 'staff-safety':
      return 'critical' as const;
    case 'marac-flag':
      return 'high' as const;
    case 'cp-register':
      return 'accent' as const;
    case 'mappa':
      return 'restricted' as const;
    default:
      return 'medium' as const;
  }
}

export function Person360({ personId }: { personId: string }) {
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const now = useNow();
  const route = useRoute();
  const navigate = useNavigate();
  const select = useSelection((s) => s.select);
  const grants = useAppStore((s) => s.session.breakGlass);
  const audit = useAppStore((s) => s.audit);
  const grantBreakGlass = useAppStore((s) => s.grantBreakGlass);
  const upsert = useAppStore((s) => s.upsert);
  const newId = useAppStore((s) => s.newId);
  const { toast } = useToast();
  const dev = useDevState();
  const chronoReset = useChronologyStore((s) => s.reset);
  const chronoSetWindow = useChronologyStore((s) => s.setWindow);
  const chronoSelect = useChronologyStore((s) => s.select);
  const chronoSelectAnalysis = useChronologyStore((s) => s.selectAnalysis);
  const selectedEventId = useChronologyStore((s) => s.selectedEventId);
  const selectedAnalysisId = useChronologyStore((s) => s.selectedAnalysisId);
  const model = useChronology(personId);
  const [breakGlassFor, setBreakGlassFor] = useState<Process | null>(null);
  const [reasonCategory, setReasonCategory] = useState('');
  const [reason, setReason] = useState('');
  const [recording, setRecording] = useState(false);
  const [voice, setVoice] = useState<{ kind: ViewsRecord['kind']; method: string; content: string }>({ kind: 'child-voice', method: 'In person', content: '' });

  const tab = route.query.get('tab') ?? 'overview';
  const person = data.people.find((p) => p.id === personId);

  useEffect(() => {
    select({ kind: 'person', id: personId });
    chronoReset(personId);
  }, [personId, select, chronoReset]);

  useEffect(() => {
    if (person) audit({ act: 'read', targetType: 'person', targetId: personId, targetLabel: fullName(person) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);

  if (!user) return null;
  if (!person) {
    return (
      <div className="page">
        <EmptyState title="Person not found" text="This record does not exist in the demo dataset." actions={<AppLink href="/people">Back to people</AppLink>} />
      </div>
    );
  }

  const processes = processesInvolving(data, person.id);
  const open = processes.filter((p) => p.status === 'open');
  const accessOf = (p: Process) => accessForUser(data, config, user, p, grants, now);
  const seeable = open.filter((p) => accessOf(p).level !== 'none');
  const allRestricted = open.length > 0 && seeable.length === 0;
  const address = currentAddress(data, person);
  const views = data.viewsRecords.filter((v) => v.personId === person.id || (v.kind === 'family-views' && open.some((p) => p.id === v.processId))).sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1));
  const latestVoice = views.find((v) => v.personId === person.id);
  const clocks = seeable.flatMap((p) => clocksForProcess(data, config, p, now).filter((c) => c.status !== 'complete').map((c) => ({ ...c, process: p })));
  const plans = data.plans.filter((pl) => seeable.some((p) => p.id === pl.processId) && pl.status === 'active');
  const nextMeetingFor = (p: Process) => data.meetings.filter((m) => m.processId === p.id && m.status === 'scheduled' && m.scheduledAt >= now.toISOString()).sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1))[0];
  const concernIds = open.flatMap((p) => (p.type === 'marac' ? [p.detail.referral.perpetratorPersonId] : p.type === 'cp' ? data.people.filter((x) => x.alerts.some((a) => a.kind === 'other' && /bail/i.test(a.text))).map((x) => x.id) : []));

  function setTab(id: string) {
    navigate(`${route.path}${setQuery(route.query, { tab: id === 'overview' ? null : id })}`, { replace: true });
  }

  function recordViews() {
    const rec: ViewsRecord = { id: newId('vw'), synthetic: true, personId: person!.id, processId: open[0]?.id, kind: voice.kind, recordedAt: now.toISOString(), recordedByUserId: user!.id, recordedByName: userName(user!), recordedByAgency: user!.agency, method: voice.method, content: voice.content };
    upsert('viewsRecords', rec);
    audit({ act: 'edit', targetType: 'person', targetId: person!.id, targetLabel: `Views recorded: ${VIEWS_KIND_LABELS[voice.kind]}`, processId: open[0]?.id });
    setRecording(false);
    setVoice({ kind: 'child-voice', method: 'In person', content: '' });
    toast({ title: 'Views recorded', text: 'They appear at the top of the person\'s record and in every process view.', tone: 'success' });
  }

  const state = dev ?? (allRestricted ? 'restricted' : 'ready');

  return (
    <div className="page">
      <header className={styles.header}>
        <div>
          <div className={styles.nameRow}>
            <h1 className={styles.name}>{fullName(person)}</h1>
            {person.preferredName ? <span className={styles.known}>known as {person.preferredName}</span> : null}
            {person.pronouns ? <span className={styles.known}>({person.pronouns})</span> : null}
          </div>
          <div className={styles.facts}>
            <span>
              {person.lifeStage === 'unborn' ? (
                <>
                  <strong>Unborn</strong>, due {person.expectedDeliveryDate ? formatDate(person.expectedDeliveryDate) : 'date not recorded'}
                </>
              ) : (
                <>
                  <strong>{person.dateOfBirth ? ageLabel(person.dateOfBirth, now) : 'Age not recorded'}</strong>
                  {person.dateOfBirth ? `, born ${formatDate(person.dateOfBirth)}` : ''}
                </>
              )}
            </span>
            <span>
              <strong>{address.line}</strong>
              {address.moves > 0 ? ` (${address.moves} ${address.moves === 1 ? 'move' : 'moves'})` : ''}
            </span>
            {person.chi ? <span>CHI (synthetic) {person.chi}</span> : null}
            {person.communicationNeeds.interpreterLanguage || person.communicationNeeds.needs.length > 0 ? (
              <span>
                <Languages size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {person.communicationNeeds.interpreterLanguage ? `${person.communicationNeeds.interpreterLanguage} interpreter` : ''}
                {person.communicationNeeds.needs.length ? ` ${person.communicationNeeds.needs.join('; ')}` : ''}
              </span>
            ) : (
              <span>No communication needs recorded</span>
            )}
          </div>
          {person.alerts.length > 0 ? (
            <div className={styles.alerts}>
              {person.alerts.map((a) => (
                <Pill key={a.id} tone={alertTone(a.kind)} icon={a.kind === 'staff-safety' ? <ShieldAlert size={14} aria-hidden="true" /> : a.kind === 'marac-flag' ? <Flag size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}>
                  {a.text}
                  {a.to ? ` until ${formatDate(a.to)}` : ''}
                </Pill>
              ))}
            </div>
          ) : null}
        </div>
        <div className={styles.badges}>
          {open.length === 0 ? <span className={styles.badgeNext}>No open process</span> : null}
          {open.map((p) => {
            const access = accessOf(p);
            const next = nextMeetingFor(p);
            if (access.level === 'none')
              return (
                <Pill key={p.id} tone="restricted" icon={<Lock size={14} aria-hidden="true" />}>
                  Restricted process
                </Pill>
              );
            return (
              <span key={p.id} style={{ textAlign: 'right' }}>
                <AppLink href={processPath(p.id)} style={{ textDecoration: 'none' }}>
                  <ProcessMark type={p.type} stage={stageLabel(p.type, p.stage)} restricted={p.classification === 'restricted'} />
                </AppLink>
                <div className={styles.badgeNext}>{next ? `Next: ${next.title.split(':')[0]} ${formatDate(next.scheduledAt)}` : access.level === 'presence' ? 'You are not on this case' : 'No meeting scheduled'}</div>
              </span>
            );
          })}
        </div>
      </header>

      <ScreenState
        state={state}
        restricted={{ reason: 'Every open process for this person is restricted and you are not on the distribution list.', breakGlass: open.some((p) => accessOf(p).breakGlass === 'available') ? 'available' : 'unavailable', onBreakGlass: () => setBreakGlassFor(open.find((p) => accessOf(p).breakGlass === 'available') ?? null) }}
      >
        <div className={styles.tabBar}>
          <Tabs items={TABS.map((t) => ({ ...t, count: t.id === 'processes' ? open.length : t.id === 'voice' ? views.length : undefined }))} value={tab} onChange={setTab} label="Person record sections" idPrefix="p360" />
        </div>

        <TabPanel id="overview" active={tab === 'overview'} idPrefix="p360">
          <div className={styles.overview}>
            <Sheet>
              <SheetHead title="Clocks" meta={clocks.length === 0 ? 'No statutory clocks running' : `${clocks.length} running`} />
              <SheetBody>
                <div className={styles.clockList}>
                  {clocks.map((c) => (
                    <AppLink key={c.triggerId} href={processPath(c.process.id)} className={styles.clockLink}>
                      <ClockNumeral daysRemaining={c.daysRemaining} band={c.band} status={c.status} label={c.label} sub={`Due ${formatDate(c.dueAt)}. ${c.overridden ? c.overrideReason : c.sourceRef}`} size="sm" />
                    </AppLink>
                  ))}
                  {clocks.length === 0 ? <span className={styles.contactMeta}>Clocks start when a process reaches a stage with a statutory or local timescale.</span> : null}
                </div>
              </SheetBody>
            </Sheet>
            <Sheet>
              <SheetHead title="Household and network" meta="Relationships are dated and typed. Dashed marks an adult of concern." />
              <SheetBody>
                <NetworkGraph person={person} concernIds={concernIds} />
              </SheetBody>
            </Sheet>
            <Sheet tone="paper">
              <SheetHead title="Views and voice" meta={latestVoice ? `Latest of ${views.length}` : 'Nothing recorded yet'} actions={<Button size="sm" variant="quiet" onClick={() => setTab('voice')}>All</Button>} />
              <SheetBody>
                {latestVoice ? <VoiceBlock record={latestVoice} personName={person.preferredName ?? person.givenName} size="sm" /> : <span className={styles.contactMeta}>The person&apos;s own words belong here, dated and attributed.</span>}
              </SheetBody>
            </Sheet>
            <Sheet className={styles.overviewWide}>
              <SheetHead title="Key contacts by agency" meta="Who is on the case, their role, and when they last touched the record" />
              <SheetBody>
                <div className={styles.contacts}>
                  {seeable.flatMap((p) => membersByAgency(data, p).flatMap((g) => g.members.map((m) => ({ p, g, m })))).map(({ p, g, m }) => {
                    const last = data.audit.find((a) => a.userId === m.membership.userId && a.processId === p.id);
                    return (
                      <div key={`${p.id}-${m.membership.userId}`} className={styles.contact}>
                        <AgencyMark agency={g.agency} />
                        <span className={styles.contactName}>{m.user ? userName(m.user) : m.membership.userId}</span>
                        <span className={styles.contactMeta}>
                          {m.membership.caseRole} ({PROCESS_SHORT[p.type]}). {m.user ? ROLE_DEFINITIONS[m.user.roleId].label : ''}
                        </span>
                        <span className={styles.contactMeta}>
                          {m.user?.phone ?? ''}. Last contact with the record {last ? formatDate(last.at) : 'not recorded'}.
                        </span>
                      </div>
                    );
                  })}
                  {seeable.length === 0 ? <span className={styles.contactMeta}>No case members visible to you.</span> : null}
                </div>
              </SheetBody>
            </Sheet>
            <Sheet className={styles.overviewWide}>
              <SheetHead title="Current plans" meta={plans.length === 0 ? 'No active plan' : `${plans.length} active`} />
              <SheetBody>
                <div className={styles.planList}>
                  {plans.map((pl) => {
                    const actions = data.actions.filter((a) => a.planId === pl.id);
                    const done = actions.filter((a) => a.status === 'complete').length;
                    const overdue = actions.filter((a) => a.status !== 'complete' && a.status !== 'cancelled' && a.due < now.toISOString().slice(0, 10)).length;
                    return (
                      <AppLink key={pl.id} href={processPath(pl.processId)} className={styles.plan} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <span className={styles.planTitle}>{pl.title}</span>
                        <Pill size="sm" tone={overdue > 0 ? 'critical' : 'neutral'}>
                          {done} of {actions.length} done{overdue > 0 ? `, ${overdue} overdue` : ''}
                        </Pill>
                        <span className={styles.planMeta}>
                          {PLAN_TYPE_LABELS[pl.type]}. Coordinated by {pl.coordinatorName}. Agreed {formatDate(pl.agreedAt)}
                          {pl.reviewDate ? `, review ${formatDate(pl.reviewDate)}` : ''}. {pl.outcomes.length} outcomes.
                        </span>
                      </AppLink>
                    );
                  })}
                </div>
              </SheetBody>
            </Sheet>
          </div>
        </TabPanel>

        <TabPanel id="chronology" active={tab === 'chronology'} idPrefix="p360">
          <div className={styles.chronoActions}>
            <Button variant="primary" icon={<ArrowUpRight size={16} aria-hidden="true" />} onClick={() => navigate(chronologyPath(person.id))}>
              Open wide
            </Button>
          </div>
          <LanesChart events={model.events} analyses={model.analyses} agencies={model.agencies} domain={model.domain} lensResults={model.lensResults} highlighted={model.highlighted} selectedEventId={selectedEventId} selectedAnalysisId={selectedAnalysisId} onSelectEvent={(id) => { chronoSelect(id); if (id) select({ kind: 'event', id, personId: person.id }); }} onSelectAnalysis={(id) => { chronoSelectAnalysis(id); if (id) select({ kind: 'analysis', id, personId: person.id }); }} onBrush={chronoSetWindow} compact settle />
          <div style={{ marginTop: 12 }}>
            <EventList events={model.events} selectedEventId={selectedEventId} highlighted={model.highlighted} onSelect={(id) => { chronoSelect(id); select({ kind: 'event', id, personId: person.id }); }} height={360} />
          </div>
        </TabPanel>

        <TabPanel id="processes" active={tab === 'processes'} idPrefix="p360">
          <div className={styles.processList}>
            {processes.length === 0 ? <EmptyState title="No process" text="Nobody has opened a process for this person. Search results show them because they are known to a connector." /> : null}
            {processes.map((p) => {
              const access = accessOf(p);
              if (access.level === 'none')
                return (
                  <RestrictedState key={p.id} title={`${PROCESS_SHORT[p.type]} ${p.reference}: restricted`} reason={access.reason} breakGlass={access.breakGlass} breakGlassAction={<Button variant="primary" onClick={() => setBreakGlassFor(p)}>Open with a reason</Button>} />
                );
              const next = nextMeetingFor(p);
              const role = p.subjectIds.includes(person.id) ? 'Subject' : p.type === 'marac' && p.detail.referral.perpetratorPersonId === person.id ? 'Perpetrator' : p.type === 'marac' ? 'Child' : 'Parent';
              return (
                <Sheet key={p.id} onMouseEnter={() => select({ kind: 'process', id: p.id })} onFocus={() => select({ kind: 'process', id: p.id })}>
                  <SheetHead
                    title={<AppLink href={processPath(p.id)}>{p.title}</AppLink>}
                    meta={`${p.reference}. ${role}. Lead ${AGENCY_SHORT[p.leadAgency]}. Opened ${formatDate(p.openedAt)}. ${p.status === 'open' ? 'Open' : p.status}.`}
                    actions={<ProcessMark type={p.type} stage={stageLabel(p.type, p.stage)} restricted={p.classification === 'restricted'} />}
                  />
                  <SheetBody>
                    <div className={styles.processRow}>
                      <span className={styles.processMeta}>
                        {access.level === 'presence' ? 'You are not on this case: presence only. Ask the lead to be involved.' : access.level === 'summary' ? 'Summary access at this stage.' : access.level === 'fields' ? `Named fields only: ${access.fields.join('; ')}.` : access.reason}
                      </span>
                      <span className={styles.processMeta}>{next ? <AppLink href={meetingPath(next.id)}>Next: {next.title}, {formatDate(next.scheduledAt)}</AppLink> : 'No meeting scheduled'}</span>
                    </div>
                  </SheetBody>
                </Sheet>
              );
            })}
          </div>
        </TabPanel>

        <TabPanel id="voice" active={tab === 'voice'} idPrefix="p360">
          <div className="page-head">
            <p className="page-lede">Structured, dated and attributed. The person&apos;s views are read into every meeting record.</p>
            <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setRecording(true)}>
              Record views
            </Button>
          </div>
          <div className={styles.voices}>
            {views.length === 0 ? <EmptyState title="No views recorded" text="Record what the person said, how it was sought, and who recorded it." /> : null}
            {views.map((v) => (
              <VoiceBlock key={v.id} record={v} personName={v.personId === person.id ? (person.preferredName ?? person.givenName) : (fullName(data.people.find((x) => x.id === v.personId) ?? person))} />
            ))}
          </div>
        </TabPanel>

        <TabPanel id="documents" active={tab === 'documents'} idPrefix="p360">
          {(() => {
            const docs = [
              ...model.visible.flatMap((e) => e.evidenceRefs.map((r) => ({ id: `${e.id}-${r.ref}`, label: r.label ?? r.ref, kind: r.kind, source: `${AGENCY_SHORT[e.agency]} event: ${e.title}`, date: e.occurredAt }))),
              ...data.meetings.filter((m) => seeable.some((p) => p.id === m.processId)).flatMap((m) => m.pack.filter((pk) => pk.included).map((pk) => ({ id: `${m.id}-${pk.id}`, label: pk.label, kind: pk.kind, source: m.title, date: m.scheduledAt }))),
            ];
            if (docs.length === 0) return <EmptyState title="No documents" text="Evidence references and meeting pack items appear here as the record grows." />;
            return (
              <TableWrap className={styles.docs}>
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">Document</th>
                      <th scope="col">Kind</th>
                      <th scope="col">Source</th>
                      <th scope="col">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d) => (
                      <tr key={d.id}>
                        <td>{d.label}</td>
                        <td>{d.kind}</td>
                        <td>{d.source}</td>
                        <td>{formatDate(d.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            );
          })()}
        </TabPanel>

        <TabPanel id="sharing" active={tab === 'sharing'} idPrefix="p360">
          {(() => {
            const shares = data.sharingRecords.filter((s) => s.subjectId === person.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
            const trail = data.audit.filter((a) => (a.targetType === 'person' && a.targetId === person.id) || (a.processId && seeable.some((p) => p.id === a.processId))).slice(0, 30);
            return (
              <div className="stack">
                <Sheet>
                  <SheetHead title="Shared about this person" meta={`${shares.length} shares, each with a lawful basis`} />
                  <SheetBody flush>
                    <TableWrap style={{ border: 0, borderRadius: 0 }}>
                      <Table>
                        <thead>
                          <tr>
                            <th scope="col">When</th>
                            <th scope="col">To</th>
                            <th scope="col">Level</th>
                            <th scope="col">Why</th>
                            <th scope="col">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shares.map((s) => (
                            <tr key={s.id} onMouseEnter={() => select({ kind: 'share', id: s.id })}>
                              <td>{formatDate(s.createdAt)}</td>
                              <td>
                                {s.recipient.name} <span className={styles.contactMeta}>({s.recipient.role}, {AGENCY_SHORT[s.recipient.agency]})</span>
                              </td>
                              <td>{s.detailLevel}{s.fields ? `: ${s.fields.join('; ')}` : ''}</td>
                              <td>{s.reason}</td>
                              <td>{s.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </TableWrap>
                  </SheetBody>
                </Sheet>
                <Sheet>
                  <SheetHead title="Audit" meta="Every read, share, export and break-glass on this record" />
                  <SheetBody flush>
                    <TableWrap style={{ border: 0, borderRadius: 0 }}>
                      <Table>
                        <thead>
                          <tr>
                            <th scope="col">When</th>
                            <th scope="col">Who</th>
                            <th scope="col">Act</th>
                            <th scope="col">Target</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trail.map((a) => (
                            <tr key={a.id}>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{formatDateTime(a.at)}</td>
                              <td>
                                {a.userName} <span className={styles.contactMeta}>({AGENCY_SHORT[a.agency]})</span>
                              </td>
                              <td>
                                {a.act.replace(/-/g, ' ')}
                                {a.restricted ? ' (restricted)' : ''}
                              </td>
                              <td>{a.targetLabel}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </TableWrap>
                  </SheetBody>
                </Sheet>
              </div>
            );
          })()}
        </TabPanel>
      </ScreenState>

      <Dialog
        open={breakGlassFor !== null}
        onClose={() => setBreakGlassFor(null)}
        title="Open a restricted record"
        actions={
          <>
            <Button variant="quiet" onClick={() => setBreakGlassFor(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!reasonCategory || reason.trim().length < 15}
              onClick={() => {
                if (breakGlassFor) grantBreakGlass(breakGlassFor.id, reasonCategory, reason);
                setBreakGlassFor(null);
                setReason('');
                toast({ title: 'Break-glass access granted', text: `Access lasts ${config.breakGlassHours} hours. Every read is audited and the MAPPA Coordinator is told.`, tone: 'info' });
              }}
            >
              Open with this reason
            </Button>
          </>
        }
      >
        <p>You are not on the distribution list for {breakGlassFor?.reference}. State why you need it now. Your reason, your name and every read are written to the audit log and shown to the coordinator.</p>
        <SelectField label="Why you need it" required value={reasonCategory} onChange={(e) => setReasonCategory(e.target.value)} placeholder="Choose a reason category" options={config.breakGlassReasons.map((r) => ({ value: r, label: r }))} />
        <TextareaField label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} hint="At least 15 characters. For example: immediate safety concern for a child in the household, reported at 09:40 today." />
      </Dialog>

      <Dialog
        open={recording}
        onClose={() => setRecording(false)}
        title={`Record the views of ${person.preferredName ?? person.givenName}`}
        actions={
          <>
            <Button variant="quiet" onClick={() => setRecording(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={voice.content.trim().length < 5} onClick={recordViews}>
              Record views
            </Button>
          </>
        }
      >
        <div className="stack">
          <SelectField label="Whose views" value={voice.kind} onChange={(e) => setVoice({ ...voice, kind: e.target.value as ViewsRecord['kind'] })} options={VIEWS_KINDS.map((k) => ({ value: k, label: VIEWS_KIND_LABELS[k] }))} />
          <TextField label="How the views were sought" value={voice.method} onChange={(e) => setVoice({ ...voice, method: e.target.value })} hint="For example: in person after school with drawing; via the IDAA; with a Polish interpreter." />
          <TextareaField label="In their words" required value={voice.content} onChange={(e) => setVoice({ ...voice, content: e.target.value })} />
        </div>
      </Dialog>
    </div>
  );
}
