'use client';

import { VIEWS_KINDS, ageLabel, agencyShort, detailLevelLabel, evidenceKindLabel, formatDate, formatDateTime, packItemKindLabel, planTypeLabel, processShort, processStatusLabel, roleLabel, resolvePersonId, shareStatusLabel, stageLabel, standingMerges, viewsKindLabel, type Person, type Process, type ViewsRecord } from '@mas/domain';
import { useT, type RichValues } from '@mas/messages';
import { AgencyMark, Button, ClockNumeral, Dialog, EmptyState, Pill, ProcessMark, RestrictedState, SelectField, Sheet, SheetBody, SheetHead, TabPanel, Tabs, Table, TableWrap, TextField, TextareaField, VoiceBlock, useToast } from '@mas/ui';
import { AlertTriangle, ArrowUpRight, Flag, FolderPlus, HeartOff, Languages, Lock, Merge, Pencil, Plus, RotateCcw, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { RecordHistory } from '@/components/RecordHistory';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { chronologyPath, meetingPath, personPath, processPath } from '@/lib/routes';
import { useSelection } from '@/lib/selection';
import { useTrail } from '@/lib/trail';
import { accessForUser, clocksForProcess, currentAddress, fullName, membersByAgency, processesInvolving, userName } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useGrants, useNow } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import { EventList } from '@/features/chronology/EventList';
import { LanesChart } from '@/features/chronology/LanesChart';
import { useChronologyStore } from '@/features/chronology/state';
import { useChronology } from '@/features/chronology/useChronology';
import { HouseholdPanel } from './HouseholdPanel';
import { NetworkGraph } from './NetworkGraph';
import { NetworkPanel } from './NetworkPanel';
import { AddAlertDialog } from './AddAlertDialog';
import { EditPersonDialog } from './EditPersonDialog';
import { RecordDeathDialog } from './RecordDeathDialog';
import { MergeDialog, UnmergeDialog } from './MergeDialog';
import { StartProcessDialog } from './StartProcessDialog';
import styles from './PersonRecord.module.css';

/** Argument bag for t.rich, typed so a React node (the bold lead-in of a header fact) can fill an argument. */
const rich = (values: RichValues): RichValues => values;

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

export function PersonRecord({ personId }: { personId: string }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const now = useNow();
  const route = useRoute();
  const navigate = useNavigate();
  const select = useSelection((s) => s.select);
  const grants = useGrants();
  const audit = useAppStore((s) => s.audit);
  const grantBreakGlass = useAppStore((s) => s.grantBreakGlass);
  const write = useAppStore((s) => s.write);
  const newId = useAppStore((s) => s.newId);
  const readErrors = useWriteErrors();
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
  const [merging, setMerging] = useState(false);
  const [starting, setStarting] = useState(false);
  const [alerting, setAlerting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [recordingDeath, setRecordingDeath] = useState(false);
  const [unmerging, setUnmerging] = useState<string | null>(null);
  const standing = standingMerges(data, personId);
  const [voice, setVoice] = useState<{ kind: ViewsRecord['kind']; method: string; content: string }>(() => ({ kind: 'child-voice', method: t('person.recordViews.methodDefault'), content: '' }));

  const visit = useTrail((s) => s.visit);
  const tab = route.query.get('tab') ?? 'overview';
  const person = data.people.find((p) => p.id === personId);

  /*
   * A merged-away id does not stop existing the moment the merge happens. It is in somebody's
   * bookmarks, in a printed pack, in a connector event queued before the merge and delivered after
   * it. Following it to the surviving record is what docs/RECORDS.md means by an old reference still
   * landing; the address becomes the survivor's and carries where it came from, so the record can
   * say so rather than silently showing a different person.
   */
  const resolved = resolvePersonId(data, personId);
  const followedFrom = route.query.get('from');
  const followedMerge = followedFrom ? data.personMerges.find((m) => !m.undoneAt && m.mergedId === followedFrom) : undefined;

  useEffect(() => {
    if (resolved !== personId && data.people.some((p) => p.id === resolved)) {
      navigate(`${personPath(resolved)}?from=${personId}`, { replace: true });
    }
  }, [resolved, personId, data.people, navigate]);

  useEffect(() => {
    select({ kind: 'person', id: personId });
    chronoReset(personId);
  }, [personId, select, chronoReset]);

  useEffect(() => {
    if (person) audit({ act: 'read', targetType: 'person', targetId: personId, targetLabel: fullName(person) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);

  useEffect(() => {
    if (person) visit({ kind: 'person', id: person.id, label: fullName(person), path: personPath(person.id) });
  }, [person, visit]);

  if (!user) return null;
  if (!person) {
    return (
      <div className="page">
        <EmptyState title={t('person.notFound.title')} text={t('person.notFound.text')} actions={<AppLink href="/people">{t('person.notFound.back')}</AppLink>} />
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: t('person.tabs.overview') },
    { id: 'chronology', label: t('person.tabs.chronology') },
    { id: 'processes', label: t('person.tabs.processes') },
    { id: 'voice', label: t('person.tabs.voice') },
    { id: 'documents', label: t('person.tabs.documents') },
    { id: 'sharing', label: t('person.tabs.sharing') },
  ];

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
    // A views record is a chronology event in its own right (docs/RECORDS.md section 3): the
    // person's own words, dated, on the integrated view rather than filed under a tab.
    const result = write({
      collection: 'viewsRecords',
      record: rec,
      intent: 'create',
      act: 'create',
      targetType: 'person',
      targetLabel: t('person.recordViews.audit', { kind: viewsKindLabel(voice.kind) }),
      processId: open[0]?.id,
      event: {
        eventType: voice.kind === 'child-voice' ? 'voice.child' : voice.kind === 'family-views' ? 'voice.family' : voice.kind === 'victim-wishes' ? 'voice.victim' : 'voice.adult',
        significance: 'high',
        visibility: 'integrated',
        title: t('person.recordViews.audit', { kind: viewsKindLabel(voice.kind) }),
        detail: voice.content,
        subjectIds: [person!.id],
        linkedProcessIds: open[0] ? [open[0].id] : [],
      },
    });
    if (!result.ok) {
      toast({ title: t('person.recordViews.refused'), text: readErrors(result.errors).join(' '), tone: 'error' });
      return;
    }
    setRecording(false);
    setVoice({ kind: 'child-voice', method: t('person.recordViews.methodDefault'), content: '' });
    toast({ title: t('person.recordViews.toast.title'), text: t('person.recordViews.toast.text'), tone: 'success' });
  }

  const state = dev ?? (allRestricted ? 'restricted' : 'ready');

  return (
    <div className="page">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>{t('person.screenName')}</p>
          <div className={styles.nameRow}>
            <h1 className={styles.name}>{fullName(person)}</h1>
            {person.preferredName ? <span className={styles.known}>{t('person.header.knownAs', { name: person.preferredName })}</span> : null}
            {person.pronouns ? <span className={styles.known}>({person.pronouns})</span> : null}
          </div>
          <div className={styles.facts}>
            <span>
              {person.lifeStage === 'unborn'
                ? person.expectedDeliveryDate
                  ? t.rich('person.header.unbornDue', rich({ unborn: <strong>{t('person.header.unborn')}</strong>, date: formatDate(person.expectedDeliveryDate) }))
                  : t.rich('person.header.unbornDueUnknown', rich({ unborn: <strong>{t('person.header.unborn')}</strong> }))
                : person.dateOfBirth
                  ? t.rich('person.header.ageBorn', rich({ age: <strong>{ageLabel(person.dateOfBirth, now)}</strong>, date: formatDate(person.dateOfBirth) }))
                  : <strong>{t('person.header.ageNotRecorded')}</strong>}
            </span>
            <span>
              <strong>{address.line}</strong>
              {address.moves > 0 ? ` ${t('person.header.moves', { count: address.moves })}` : ''}
            </span>
            {person.death ? (
              <span className={styles.died} data-testid="died">
                <strong>{t('person.death.badge', { date: formatDate(person.death.at) })}</strong> {t('person.death.recordedBy', { name: person.death.byName })}
              </span>
            ) : null}
            {person.chi ? <span>{t('person.header.chi', { chi: person.chi })}</span> : null}
            {person.communicationNeeds.interpreterLanguage || person.communicationNeeds.needs.length > 0 ? (
              <span>
                <Languages size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {person.communicationNeeds.interpreterLanguage ? t('person.header.interpreter', { language: person.communicationNeeds.interpreterLanguage }) : ''}
                {person.communicationNeeds.needs.length ? ` ${person.communicationNeeds.needs.join('; ')}` : ''}
              </span>
            ) : (
              <span>{t('person.header.noCommunicationNeeds')}</span>
            )}
          </div>
          {person.alerts.length > 0 ? (
            <div className={styles.alerts}>
              {person.alerts.map((a) => (
                <Pill key={a.id} wrap tone={alertTone(a.kind)} icon={a.kind === 'staff-safety' ? <ShieldAlert size={14} aria-hidden="true" /> : a.kind === 'marac-flag' ? <Flag size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}>
                  {a.text}
                  {a.to ? ` ${t('person.header.alertUntil', { date: formatDate(a.to) })}` : ''}
                </Pill>
              ))}
            </div>
          ) : null}
        </div>
        <div className={styles.badges}>
          {open.length === 0 ? <span className={styles.badgeNext}>{t('person.header.noOpenProcess')}</span> : null}
          {open.map((p) => {
            const access = accessOf(p);
            const next = nextMeetingFor(p);
            if (access.level === 'none')
              return (
                <Pill key={p.id} tone="restricted" icon={<Lock size={14} aria-hidden="true" />}>
                  {t('person.header.restrictedProcess')}
                </Pill>
              );
            return (
              <span key={p.id} style={{ textAlign: 'right' }}>
                <AppLink href={processPath(p.id)} style={{ textDecoration: 'none' }}>
                  <ProcessMark type={p.type} stage={stageLabel(p.type, p.stage)} restricted={p.accessRestriction === 'restricted'} />
                </AppLink>
                <div className={styles.badgeNext}>{next ? t('person.header.nextMeeting', { title: next.title.split(':')[0] ?? '', date: formatDate(next.scheduledAt) }) : access.level === 'presence' ? t('person.header.notOnCase') : t('person.header.noMeeting')}</div>
              </span>
            );
          })}
        </div>
        {followedMerge ? (
          <p className={styles.followed} role="status" data-testid="followed-merge">
            {t('person.merge.followed', { name: `${followedMerge.mergedPerson.givenName} ${followedMerge.mergedPerson.familyName}`, date: formatDate(followedMerge.at.slice(0, 10)) })}
          </p>
        ) : null}
        <div className={styles.recordActions}>
          <Button size="sm" variant="primary" icon={<FolderPlus size={14} aria-hidden="true" />} onClick={() => setStarting(true)} data-testid="start-process">
            {t('processes.open.open')}
          </Button>
          <Button size="sm" variant="secondary" icon={<Pencil size={14} aria-hidden="true" />} onClick={() => setEditing(true)} data-testid="edit-person">
            {t('person.edit.action')}
          </Button>
          <Button size="sm" variant="secondary" icon={<ShieldAlert size={14} aria-hidden="true" />} onClick={() => setAlerting(true)} data-testid="add-alert">
            {t('person.alerts.add')}
          </Button>
          {person.death ? null : (
            <Button size="sm" variant="quiet" icon={<HeartOff size={14} aria-hidden="true" />} onClick={() => setRecordingDeath(true)} data-testid="record-death">
              {t('person.death.action')}
            </Button>
          )}
          <Button size="sm" variant="secondary" icon={<Merge size={14} aria-hidden="true" />} onClick={() => setMerging(true)} data-testid="merge-open">
            {t('person.merge.open')}
          </Button>
          {standing.map((m) => (
            <Button key={m.id} size="sm" variant="quiet" icon={<RotateCcw size={14} aria-hidden="true" />} onClick={() => setUnmerging(m.id)} data-testid="unmerge-open">
              {t('person.merge.undo', { name: `${m.mergedPerson.givenName} ${m.mergedPerson.familyName}` })}
            </Button>
          ))}
        </div>
      </header>

      <ScreenState
        state={state}
        restricted={{ reason: t('person.restricted.reason'), breakGlass: open.some((p) => accessOf(p).breakGlass === 'available') ? 'available' : 'unavailable', onBreakGlass: () => setBreakGlassFor(open.find((p) => accessOf(p).breakGlass === 'available') ?? null) }}
      >
        <div className={styles.tabBar}>
          <Tabs items={tabs.map((item) => ({ ...item, count: item.id === 'processes' ? open.length : item.id === 'voice' ? views.length : undefined }))} value={tab} onChange={setTab} label={t('person.tabs.label')} idPrefix="p360" />
        </div>

        <TabPanel id="overview" active={tab === 'overview'} idPrefix="p360">
          <div className={styles.overview}>
            <Sheet>
              <SheetHead title={t('person.overview.clocks.title')} meta={clocks.length === 0 ? t('person.overview.clocks.none') : t('person.overview.clocks.running', { count: clocks.length })} />
              <SheetBody>
                <div className={styles.clockList}>
                  {clocks.map((c) => (
                    <AppLink key={c.triggerId} href={processPath(c.process.id)} className={styles.clockLink}>
                      <ClockNumeral daysRemaining={c.daysRemaining} band={c.band} status={c.status} label={c.label} sub={t('person.overview.clocks.sub', { date: formatDate(c.dueAt), detail: (c.overridden ? c.overrideReason : c.sourceRef) ?? '' })} size="sm" />
                    </AppLink>
                  ))}
                  {clocks.length === 0 ? <span className={styles.contactMeta}>{t('person.overview.clocks.hint')}</span> : null}
                </div>
              </SheetBody>
            </Sheet>
            <div className={styles.homeAndNetwork}>
              <HouseholdPanel person={person} />
              <NetworkPanel person={person} />
            </div>
            <Sheet>
              <SheetHead title={t('person.overview.network.title')} meta={t('person.overview.network.meta')} />
              <SheetBody>
                <NetworkGraph person={person} concernIds={concernIds} on={now.toISOString().slice(0, 10)} />
              </SheetBody>
            </Sheet>
            <div className={styles.overviewWide}>
              <RecordHistory record={person} retire={{ collection: 'people', id: person.id, label: fullName(person) }} />
            </div>
            <Sheet tone="paper">
              <SheetHead title={t('person.overview.voice.title')} meta={latestVoice ? t('person.overview.voice.latestOf', { count: views.length }) : t('person.overview.voice.none')} actions={<Button size="sm" variant="quiet" onClick={() => setTab('voice')}>{t('person.overview.voice.all')}</Button>} />
              <SheetBody>
                {latestVoice ? <VoiceBlock record={latestVoice} personName={person.preferredName ?? person.givenName} size="sm" /> : <span className={styles.contactMeta}>{t('person.overview.voice.placeholder')}</span>}
              </SheetBody>
            </Sheet>
            <Sheet className={styles.overviewWide}>
              <SheetHead title={t('person.overview.contacts.title')} meta={t('person.overview.contacts.meta')} />
              <SheetBody>
                <div className={styles.contacts}>
                  {seeable.flatMap((p) => membersByAgency(data, p).flatMap((g) => g.members.map((m) => ({ p, g, m })))).map(({ p, g, m }) => {
                    const last = data.audit.find((a) => a.userId === m.membership.userId && a.processId === p.id);
                    return (
                      <div key={`${p.id}-${m.membership.userId}`} className={styles.contact}>
                        <AgencyMark agency={g.agency} />
                        <span className={styles.contactName}>{m.user ? userName(m.user) : m.membership.userId}</span>
                        <span className={styles.contactMeta}>{t('person.overview.contacts.role', { caseRole: m.membership.caseRole, process: processShort(p.type), role: m.user ? roleLabel(m.user.roleId) : '' })}</span>
                        <span className={styles.contactMeta}>{t('person.overview.contacts.lastContact', { phone: m.user?.phone ?? '', date: last ? formatDate(last.at) : t('common.values.notRecorded') })}</span>
                      </div>
                    );
                  })}
                  {seeable.length === 0 ? <span className={styles.contactMeta}>{t('person.overview.contacts.none')}</span> : null}
                </div>
              </SheetBody>
            </Sheet>
            <Sheet className={styles.overviewWide}>
              <SheetHead title={t('person.overview.plans.title')} meta={plans.length === 0 ? t('person.overview.plans.none') : t('person.overview.plans.active', { count: plans.length })} />
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
                          {t('person.overview.plans.progress', { done, total: actions.length, overdue })}
                        </Pill>
                        <span className={styles.planMeta}>
                          {t('person.overview.plans.meta', { type: planTypeLabel(pl.type), coordinator: pl.coordinatorName, agreed: formatDate(pl.agreedAt), hasReview: pl.reviewDate ? 'yes' : 'no', review: pl.reviewDate ? formatDate(pl.reviewDate) : '', outcomes: pl.outcomes.length })}
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
              {t('person.chronology.openWide')}
            </Button>
          </div>
          <LanesChart events={model.events} analyses={model.analyses} agencies={model.agencies} domain={model.domain} lensResults={model.lensResults} highlighted={model.highlighted} selectedEventId={selectedEventId} selectedAnalysisId={selectedAnalysisId} onSelectEvent={(id) => { chronoSelect(id); if (id) select({ kind: 'event', id, personId: person.id }); }} onSelectAnalysis={(id) => { chronoSelectAnalysis(id); if (id) select({ kind: 'analysis', id, personId: person.id }); }} onBrush={chronoSetWindow} compact settle />
          <div style={{ marginTop: 12 }}>
            <EventList events={model.events} selectedEventId={selectedEventId} highlighted={model.highlighted} onSelect={(id) => { chronoSelect(id); select({ kind: 'event', id, personId: person.id }); }} height={360} />
          </div>
        </TabPanel>

        <TabPanel id="processes" active={tab === 'processes'} idPrefix="p360">
          <div className={styles.processList}>
            {processes.length === 0 ? <EmptyState title={t('person.processes.empty.title')} text={t('person.processes.empty.text')} /> : null}
            {processes.map((p) => {
              const access = accessOf(p);
              if (access.level === 'none')
                return (
                  <RestrictedState key={p.id} title={t('person.processes.restrictedTitle', { process: processShort(p.type), reference: p.reference })} reason={access.reason} breakGlass={access.breakGlass} breakGlassAction={<Button variant="primary" onClick={() => setBreakGlassFor(p)}>{t('person.processes.openWithReason')}</Button>} />
                );
              const next = nextMeetingFor(p);
              const role = p.subjectIds.includes(person.id) ? t('person.processes.role.subject') : p.type === 'marac' && p.detail.referral.perpetratorPersonId === person.id ? t('person.processes.role.perpetrator') : p.type === 'marac' ? t('person.processes.role.child') : t('person.processes.role.parent');
              return (
                <Sheet key={p.id} onMouseEnter={() => select({ kind: 'process', id: p.id })} onFocus={() => select({ kind: 'process', id: p.id })}>
                  <SheetHead
                    title={<AppLink href={processPath(p.id)}>{p.title}</AppLink>}
                    meta={t('person.processes.meta', { reference: p.reference, role, agency: agencyShort(p.leadAgency), date: formatDate(p.openedAt), status: p.status === 'open' ? t('person.processes.statusOpen') : processStatusLabel(p.status) })}
                    actions={<ProcessMark type={p.type} stage={stageLabel(p.type, p.stage)} restricted={p.accessRestriction === 'restricted'} />}
                  />
                  <SheetBody>
                    <div className={styles.processRow}>
                      <span className={styles.processMeta}>
                        {access.level === 'presence' ? t('person.processes.access.presence') : access.level === 'summary' ? t('person.processes.access.summary') : access.level === 'fields' ? t('person.processes.access.fields', { fields: access.fields.join('; ') }) : access.reason}
                      </span>
                      <span className={styles.processMeta}>{next ? <AppLink href={meetingPath(next.id)}>{t('person.processes.nextMeeting', { title: next.title, date: formatDate(next.scheduledAt) })}</AppLink> : t('person.header.noMeeting')}</span>
                    </div>
                  </SheetBody>
                </Sheet>
              );
            })}
          </div>
        </TabPanel>

        <TabPanel id="voice" active={tab === 'voice'} idPrefix="p360">
          <div className="page-head">
            <p className="page-lede">{t('person.voice.lede')}</p>
            <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setRecording(true)}>
              {t('person.voice.record')}
            </Button>
          </div>
          <div className={styles.voices}>
            {views.length === 0 ? <EmptyState title={t('person.voice.empty.title')} text={t('person.voice.empty.text')} /> : null}
            {views.map((v) => (
              <VoiceBlock key={v.id} record={v} personName={v.personId === person.id ? (person.preferredName ?? person.givenName) : (fullName(data.people.find((x) => x.id === v.personId) ?? person))} />
            ))}
          </div>
        </TabPanel>

        <TabPanel id="documents" active={tab === 'documents'} idPrefix="p360">
          {(() => {
            const docs = [
              ...model.visible.flatMap((e) => e.evidenceRefs.map((r) => ({ id: `${e.id}-${r.ref}`, label: r.label ?? r.ref, kind: evidenceKindLabel(r.kind), source: t('person.documents.source', { agency: agencyShort(e.agency), title: e.title }), date: e.occurredAt }))),
              ...data.meetings.filter((m) => seeable.some((p) => p.id === m.processId)).flatMap((m) => m.pack.filter((pk) => pk.included).map((pk) => ({ id: `${m.id}-${pk.id}`, label: pk.label, kind: packItemKindLabel(pk.kind), source: m.title, date: m.scheduledAt }))),
            ];
            if (docs.length === 0) return <EmptyState title={t('person.documents.empty.title')} text={t('person.documents.empty.text')} />;
            return (
              <TableWrap className={styles.docs}>
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">{t('person.documents.columns.document')}</th>
                      <th scope="col">{t('person.documents.columns.kind')}</th>
                      <th scope="col">{t('person.documents.columns.source')}</th>
                      <th scope="col">{t('person.documents.columns.date')}</th>
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
                  <SheetHead title={t('person.sharing.title')} meta={t('person.sharing.meta', { count: shares.length })} />
                  <SheetBody flush>
                    <TableWrap style={{ border: 0, borderRadius: 0 }}>
                      <Table>
                        <thead>
                          <tr>
                            <th scope="col">{t('person.sharing.columns.when')}</th>
                            <th scope="col">{t('person.sharing.columns.to')}</th>
                            <th scope="col">{t('person.sharing.columns.level')}</th>
                            <th scope="col">{t('person.sharing.columns.why')}</th>
                            <th scope="col">{t('person.sharing.columns.status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shares.map((s) => (
                            <tr key={s.id} onMouseEnter={() => select({ kind: 'share', id: s.id })}>
                              <td>{formatDate(s.createdAt)}</td>
                              <td>
                                {s.recipient.name} <span className={styles.contactMeta}>({s.recipient.role}, {agencyShort(s.recipient.agency)})</span>
                              </td>
                              <td>{detailLevelLabel(s.detailLevel)}{s.fields ? `: ${s.fields.join('; ')}` : ''}</td>
                              <td>{s.reason}</td>
                              <td>{shareStatusLabel(s.status)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </TableWrap>
                  </SheetBody>
                </Sheet>
                <Sheet>
                  <SheetHead title={t('person.audit.title')} meta={t('person.audit.meta')} />
                  <SheetBody flush>
                    <TableWrap style={{ border: 0, borderRadius: 0 }}>
                      <Table>
                        <thead>
                          <tr>
                            <th scope="col">{t('person.audit.columns.when')}</th>
                            <th scope="col">{t('person.audit.columns.who')}</th>
                            <th scope="col">{t('person.audit.columns.act')}</th>
                            <th scope="col">{t('person.audit.columns.target')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trail.map((a) => (
                            <tr key={a.id}>
                              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{formatDateTime(a.at)}</td>
                              <td>
                                {a.userName} <span className={styles.contactMeta}>({agencyShort(a.agency)})</span>
                              </td>
                              <td>
                                {a.act.replace(/-/g, ' ')}
                                {a.restricted ? ` ${t('person.audit.restricted')}` : ''}
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
        title={t('person.breakGlass.title')}
        actions={
          <>
            <Button variant="quiet" onClick={() => setBreakGlassFor(null)}>
              {t('common.actions.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={!reasonCategory || reason.trim().length < 15}
              onClick={() => {
                if (breakGlassFor) grantBreakGlass(breakGlassFor.id, reasonCategory, reason);
                setBreakGlassFor(null);
                setReason('');
                toast({ title: t('person.breakGlass.toast.title'), text: t('person.breakGlass.toast.text', { hours: config.breakGlassHours }), tone: 'info' });
              }}
            >
              {t('person.breakGlass.submit')}
            </Button>
          </>
        }
      >
        <p>{t('person.breakGlass.intro', { reference: breakGlassFor?.reference ?? '' })}</p>
        <SelectField label={t('person.breakGlass.category')} required value={reasonCategory} onChange={(e) => setReasonCategory(e.target.value)} placeholder={t('person.breakGlass.categoryPlaceholder')} options={config.breakGlassReasons.map((r) => ({ value: r, label: r }))} />
        <TextareaField label={t('person.breakGlass.reason')} required value={reason} onChange={(e) => setReason(e.target.value)} hint={t('person.breakGlass.reasonHint')} />
      </Dialog>

      <Dialog
        open={recording}
        onClose={() => setRecording(false)}
        title={t('person.recordViews.title', { name: person.preferredName ?? person.givenName })}
        actions={
          <>
            <Button variant="quiet" onClick={() => setRecording(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button variant="primary" disabled={voice.content.trim().length < 5} onClick={recordViews}>
              {t('person.voice.record')}
            </Button>
          </>
        }
      >
        <div className="stack">
          <SelectField label={t('person.recordViews.whose')} value={voice.kind} onChange={(e) => setVoice({ ...voice, kind: e.target.value as ViewsRecord['kind'] })} options={VIEWS_KINDS.map((k) => ({ value: k, label: viewsKindLabel(k) }))} />
          <TextField label={t('person.recordViews.method')} value={voice.method} onChange={(e) => setVoice({ ...voice, method: e.target.value })} hint={t('person.recordViews.methodHint')} />
          <TextareaField label={t('person.recordViews.content')} required value={voice.content} onChange={(e) => setVoice({ ...voice, content: e.target.value })} />
        </div>
      </Dialog>

      {starting ? <StartProcessDialog person={person} open onClose={() => setStarting(false)} /> : null}
      {alerting ? <AddAlertDialog person={person} open onClose={() => setAlerting(false)} /> : null}
      {editing ? <EditPersonDialog person={person} open onClose={() => setEditing(false)} /> : null}
      {recordingDeath ? <RecordDeathDialog person={person} open onClose={() => setRecordingDeath(false)} /> : null}
      {merging ? <MergeDialog person={person} open onClose={() => setMerging(false)} /> : null}
      {unmerging ? <UnmergeDialog mergeId={unmerging} open onClose={() => setUnmerging(null)} /> : null}
    </div>
  );
}
