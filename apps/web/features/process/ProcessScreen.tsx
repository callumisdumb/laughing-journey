'use client';

import { exclusionPartyLabel, partyRegister, STAGES_BY_PROCESS, actionStatusLabel, agencyShort, detailLevelLabel, formatDate, formatDateTime, formatTime, meetingStatusLabel, minuteStatusLabel, planStatusLabel, processLabel, processStatusLabel, OFFICIAL, canLower, classificationFor, classificationLabel, effectiveClassification, marking, officialSensitive, overrideDecision, overrideDirection, relativeDays, stageLabel, type Classification, type Process } from '@mas/domain';
import { useT } from '@mas/messages';
import { AgencyMark, Button, ClassificationTag, ClockNumeral, Dialog, EmptyState, Pill, ProcessMark, RestrictedState, SelectField, Sheet, SheetBody, SheetHead, Stepper, Table, TableWrap, TextareaField, VoiceBlock, useToast, type Step } from '@mas/ui';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Lock, Plus, ShieldCheck, UserPlus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { AppLink } from '@/components/AppLink';
import { PersonLink, PractitionerLink } from '@/components/EntityLink';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { meetingPath, processPath } from '@/lib/routes';
import { useSelection } from '@/lib/selection';
import { useTrail } from '@/lib/trail';
import { accessForUser, clocksForProcess, membersByAgency, personById, userName } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useNow, useVault } from '@/lib/store';
import { readProcessDetail } from '@/lib/vault';
import { AddPlanDialog } from './AddPlanDialog';
import { RegisterEntryDialog } from './forms/RegisterEntryDialog';
import { AspPanels } from './panels/AspPanels';
import { AwiPanels } from './panels/AwiPanels';
import { CpPanels } from './panels/CpPanels';
import { MappaPanels } from './panels/MappaPanels';
import { MaracPanels } from './panels/MaracPanels';
import styles from './ProcessScreen.module.css';

export function ProcessScreen({ processId }: { processId: string }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const vault = useVault();
  const user = useCurrentUser();
  const now = useNow();
  const select = useSelection((s) => s.select);
  const visit = useTrail((s) => s.visit);
  const grants = useAppStore((s) => s.session.breakGlass);
  const audit = useAppStore((s) => s.audit);
  const grantBreakGlass = useAppStore((s) => s.grantBreakGlass);
  const { toast } = useToast();
  const dev = useDevState();
  const [breakGlassOpen, setBreakGlassOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonCategory, setReasonCategory] = useState('');
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [classifySensitive, setClassifySensitive] = useState(true);
  const [classifyReason, setClassifyReason] = useState('');
  const upsert = useAppStore((s) => s.upsert);

  const process = data.processes.find((p) => p.id === processId);

  useEffect(() => {
    select({ kind: 'process', id: processId });
  }, [processId, select]);

  useEffect(() => {
    if (process) visit({ kind: 'process', id: process.id, label: process.reference, path: processPath(process.id) });
  }, [process, visit]);

  // Who the case is about: the referral's own parties plus the ones derived from relationships.
  const parties = process ? partyRegister(process, data.relationships) : [];

  useEffect(() => {
    if (process) audit({ act: process.accessRestriction === 'restricted' ? 'read-restricted' : 'read', targetType: 'process', targetId: process.id, targetLabel: `${process.reference}: ${process.title}`, processId: process.id, restricted: process.accessRestriction === 'restricted' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId]);

  if (!user) return null;
  if (!process) {
    return (
      <div className="page">
        <EmptyState title={t('processes.notFound.title')} text={t('processes.notFound.text')} actions={<AppLink href="/processes">{t('processes.notFound.allProcesses')}</AppLink>} />
      </div>
    );
  }

  const access = accessForUser(data, config, user, process, grants, now);
  // The record's content comes from the vault, which either unwraps a key for this user or does not.
  // The access level below decides which of presence, summary or full to *draw*; it does not decide
  // whether the content may be shown. That is decided here, by whether the unwrap succeeded.
  const decrypted = readProcessDetail(vault, process, user, access.breakGlass === 'active');
  // Annex 2: the level is derived from the record and a recorded override is applied as stored.
  // One function decides the marking, so no two screens can disagree about the same record.
  const effective = effectiveClassification(config, process);
  const derived = effective.derived;
  const classification = effective.classification;
  // The inheritance rule's floor: a classification is never lower than one it links to.
  const linkedRecords = data.processes.filter((p) => process.linkedProcessIds.includes(p.id)).map((p) => ({ classification: classificationFor(config, p) }));
  const mayLower = canLower(user.roleId, config.classificationLowerableBy);
  const subjects = process.subjectIds.map((id) => personById(data, id)).filter(Boolean) as NonNullable<ReturnType<typeof personById>>[];
  const clocks = clocksForProcess(data, config, process, now);
  const meetings = data.meetings.filter((m) => m.processId === process.id).sort((a, b) => (a.scheduledAt < b.scheduledAt ? 1 : -1));
  const nextMeeting = [...meetings].reverse().find((m) => m.status === 'scheduled' && m.scheduledAt >= now.toISOString());
  const views = data.viewsRecords.filter((v) => v.processId === process.id || process.subjectIds.includes(v.personId)).sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1));
  const actions = data.actions.filter((a) => a.processId === process.id).sort((a, b) => (a.due < b.due ? -1 : 1));
  const plans = data.plans.filter((p) => p.processId === process.id);
  const shares = data.sharingRecords.filter((s) => s.processId === process.id);
  const stages = STAGES_BY_PROCESS[process.type] as readonly string[];
  const currentIndex = stages.indexOf(process.stage);
  const steps: Step[] = stages
    .filter((s) => !(process.type === 'asp' && ((s === 'support-plan' && process.stage !== 'support-plan') || (s === 'protection-plan' && process.stage === 'support-plan'))))
    .map((s) => {
      const i = stages.indexOf(s);
      const entry = [...process.stageHistory].reverse().find((h) => h.stage === s);
      return { id: s, label: stageLabel(process.type, s), state: i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming', meta: entry ? `${formatDate(entry.at)}, ${entry.byName}` : undefined };
    });
  const lead = process.leadUserId ? data.users.find((u) => u.id === process.leadUserId) : undefined;

  const state = dev ?? (access.level === 'none' ? 'restricted' : 'ready');

  const header = (
    <header className={styles.head}>
      <div>
        <div className={styles.ref}>
          <ProcessMark type={process.type} stage={stageLabel(process.type, process.stage)} restricted={process.accessRestriction === 'restricted'} />
          <span>{process.reference}</span>
          <span>{t('processes.head.lead', { agency: agencyShort(process.leadAgency) })}</span>
          <span>{t('processes.head.opened', { date: formatDate(process.openedAt) })}</span>
          <Pill size="sm" tone={process.status === 'open' ? 'low' : 'outline'}>
            {processStatusLabel(process.status)}
          </Pill>
          <ClassificationTag classification={classification} />
        </div>
        {effective.override ? (
          <p className={styles.overrideNote}>
            {t(effective.override.direction === 'raised' ? 'processes.classification.override.raised' : 'processes.classification.override.lowered', {
              derived: classificationLabel(derived),
              name: effective.override.byName,
              date: formatDate(effective.override.at),
            })}{' '}
            {t('processes.classification.override.reason', { reason: effective.override.reason })}
          </p>
        ) : null}
        <h1 className={styles.title}>{access.level === 'none' ? t('processes.head.restrictedTitle', { process: processLabel(process.type) }) : process.title}</h1>
        {access.level !== 'none' ? (
          <div className={styles.subjects}>
            {subjects.map((s) => (
              <span key={s.id}>
                <PersonLink person={s} process={process} />
                {s.dateOfBirth ? `, ${t('processes.head.born', { date: formatDate(s.dateOfBirth) })}` : s.lifeStage === 'unborn' ? `, ${t('processes.head.unborn')}` : ''}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className={styles.headActions}>
        {nextMeeting && access.level !== 'none' ? <AppLink href={meetingPath(nextMeeting.id)}>{t('processes.head.nextMeeting', { title: nextMeeting.title, date: formatDate(nextMeeting.scheduledAt) })}</AppLink> : null}
        {access.level === 'presence' ? (
          <Button variant="secondary" icon={<UserPlus size={16} aria-hidden="true" />} onClick={() => toast({ title: t('processes.head.requestSent.title'), text: t('processes.head.requestSent.text', { hasLead: lead ? 'yes' : 'no', name: lead ? userName(lead) : '' }) })}>
            {t('processes.head.askToBeInvolved')}
          </Button>
        ) : null}
        {access.level === 'full' ? (
          <Button
            variant="quiet"
            icon={<ShieldCheck size={16} aria-hidden="true" />}
            onClick={() => {
              setClassifySensitive(classification.sensitive);
              setClassifyReason(process.classificationOverride?.reason ?? '');
              setClassifyOpen(true);
            }}
          >
            {t('processes.classification.change')}
          </Button>
        ) : null}
      </div>
    </header>
  );

  return (
    <div className="page">

      {header}
      <ScreenState
        state={state}
        restricted={{ reason: access.reason, breakGlass: access.breakGlass, onBreakGlass: () => setBreakGlassOpen(true) }}
      >
        {access.level === 'presence' ? (
          <div className={styles.summaryOnly}>
            <p>{t('processes.presence.summary', { process: processLabel(process.type), stage: stageLabel(process.type, process.stage), agency: agencyShort(process.leadAgency), reason: access.reason })}</p>
          </div>
        ) : (
          <>
            <div className={styles.stepper}>
              <Stepper steps={steps} label={t('processes.stages.label')} />
            </div>
            <div className={styles.layout}>
              <div className={styles.main}>
                {access.level === 'summary' || access.level === 'fields' ? (
                  <Sheet tone="well">
                    <SheetHead title={access.level === 'summary' ? t('processes.access.summaryTitle') : t('processes.access.fieldsTitle')} meta={access.reason} />
                    <SheetBody>
                      {access.level === 'fields' ? (
                        <ul>
                          {access.fields.map((f) => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>{t('processes.access.summaryText', { stage: stageLabel(process.type, process.stage), agency: agencyShort(process.leadAgency), hasNext: nextMeeting ? 'yes' : 'no', date: nextMeeting ? formatDate(nextMeeting.scheduledAt) : '' })}</p>
                      )}
                    </SheetBody>
                  </Sheet>
                ) : decrypted.detail ? (
                  <TypePanels process={{ ...process, detail: decrypted.detail } as Process} />
                ) : (
                  <RestrictedState title={t('processes.encrypted.title')} reason={t('processes.encrypted.reason')} breakGlass={access.breakGlass === 'available' ? 'available' : 'unavailable'} />
                )}
              </div>
              <div className={styles.side}>
                <Sheet>
                  <SheetHead title={t('processes.clocks.title')} meta={clocks.length === 0 ? t('processes.clocks.none') : t('processes.clocks.running', { count: clocks.filter((c) => c.status !== 'complete').length })} />
                  <SheetBody>
                    <div className={styles.clockList}>
                      {clocks.map((c) => (
                        <AppLink key={c.triggerId} href={`/admin/timescales?rule=${c.ruleId}`} className={styles.clockLink} title={t('processes.clocks.ruleLink')}>
                          <ClockNumeral daysRemaining={c.daysRemaining} band={c.band} status={c.status} label={c.label} sub={t('processes.clocks.sub', { date: formatDate(c.dueAt), source: (c.overridden ? c.overrideReason : c.sourceRef) ?? '', verify: c.todoVerify ? 'yes' : 'no', deferral: c.deferrable && c.deferralNote ? 'yes' : 'no', note: c.deferralNote ?? '' })} size="sm" />
                        </AppLink>
                      ))}
                    </div>
                  </SheetBody>
                </Sheet>
                {/*
                  Who this case is about, as against who is working it. The two were conflated: the
                  participants panel lists practitioners, and the people the case actually concerns
                  were only ever visible in the drawer's need-to-know section, so a reader looking at
                  a MARAC record could not see the perpetrator's name without opening a panel about
                  something else.

                  Every name here is a link to that person's record, except one: a party the
                  exclusion register names for this case and stage renders marked and not clickable.
                  `PersonLink` decides that from the register rather than each screen deciding for
                  itself, which is the only version of this rule that holds when a new screen is
                  written by someone who has not read this comment.
                */}
                <Sheet>
                  <SheetHead title={t('processes.parties.title')} meta={t('processes.parties.meta', { count: parties.length })} actions={<Button size="sm" variant="secondary" icon={<UserPlus size={14} aria-hidden="true" />} onClick={() => setRegisterOpen(true)} data-testid="add-register-entry">{t('processes.parties.add')}</Button>} />
                  <SheetBody>
                    <div className={styles.members}>
                      {parties.length === 0 ? <span className={styles.memberMeta}>{t('processes.parties.empty')}</span> : null}
                      {parties.map((party) => {
                        const person = party.personId ? personById(data, party.personId) : undefined;
                        return (
                          <div key={`${party.party}:${party.personId ?? party.userId ?? party.name ?? party.label}`} className={styles.member}>
                            <span className={styles.memberName}>
                              {person ? <PersonLink person={person} process={process} /> : (party.name ?? party.label)}
                            </span>
                            <span className={styles.memberMeta}>
                              {t('processes.parties.role', { party: exclusionPartyLabel(party.party), label: party.label, source: party.source })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </SheetBody>
                </Sheet>
                <Sheet>
                  <SheetHead title={t('processes.participants.title')} meta={t('processes.participants.meta', { count: process.members.length })} />
                  <SheetBody>
                    <div className={styles.members}>
                      {membersByAgency(data, process).map((g) => (
                        <div key={g.agency}>
                          <AgencyMark agency={g.agency} />
                          {g.members.map((m) => (
                            <div key={m.membership.userId} className={styles.member} style={{ marginTop: 4, paddingLeft: 22 }}>
                              <span className={styles.memberName}>
                                <PractitionerLink userId={m.membership.userId}>{m.user ? userName(m.user) : m.membership.userId}</PractitionerLink>
                              </span>
                              <span className={styles.memberMeta}>{t('processes.participants.member', { role: m.membership.caseRole, date: formatDate(m.membership.since), reason: m.membership.reason })}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </SheetBody>
                </Sheet>
                <Sheet tone="paper">
                  <SheetHead title={t('processes.views.title')} meta={views.length === 0 ? t('processes.views.none') : t('processes.views.count', { count: views.length })} />
                  <SheetBody>
                    <div className={styles.voices}>
                      {views.slice(0, 2).map((v) => {
                        const p = personById(data, v.personId);
                        return <VoiceBlock key={v.id} record={v} personName={p ? (p.preferredName ?? p.givenName) : t('processes.views.familyFallback')} size="sm" />;
                      })}
                    </div>
                  </SheetBody>
                </Sheet>
                <Sheet>
                  <SheetHead title={t('processes.meetings.title')} meta={t('processes.meetings.meta', { count: meetings.length })} />
                  <SheetBody>
                    <div className={styles.meetingList}>
                      {meetings.map((m) => (
                        <AppLink key={m.id} href={meetingPath(m.id)} className={styles.meeting}>
                          <span className={styles.meetingDate}>{formatDate(m.scheduledAt).slice(0, 6)}</span>
                          <span className={styles.meetingTitle}>{m.title}</span>
                          <span className={styles.meetingMeta}>
                            {m.status === 'held' ? t('processes.meetings.held', { time: formatTime(m.scheduledAt), status: minuteStatusLabel(m.minute.status) }) : m.status === 'scheduled' ? t('processes.meetings.scheduled', { when: formatDateTime(m.scheduledAt), location: m.location }) : meetingStatusLabel(m.status)}
                          </span>
                        </AppLink>
                      ))}
                    </div>
                  </SheetBody>
                </Sheet>
                <Sheet>
                  <SheetHead title={t('processes.sharing.title')} meta={t('processes.sharing.meta', { count: shares.length })} />
                  <SheetBody>
                    <ul className={styles.members}>
                      {shares.slice(0, 6).map((s) => (
                        <li key={s.id} className={styles.member} onMouseEnter={() => select({ kind: 'share', id: s.id })}>
                          <span className={styles.memberName}>{s.recipient.name}</span>
                          <span>
                            <Pill size="sm" tone="outline">
                              {detailLevelLabel(s.detailLevel)}
                            </Pill>
                          </span>
                          <span className={styles.memberMeta}>{t('processes.sharing.item', { reason: s.reason, date: formatDate(s.createdAt) })}</span>
                        </li>
                      ))}
                    </ul>
                  </SheetBody>
                </Sheet>
              </div>
              <div className={styles.wide}>
                <Sheet>
                  <SheetHead title={t('processes.plans.title')} meta={plans.length === 0 ? t('processes.plans.none') : plans.map((p) => t('processes.plans.plan', { title: p.title, status: planStatusLabel(p.status) })).join('; ')} actions={<Button size="sm" variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setPlanOpen(true)} data-testid="add-plan">{t('processes.plans.add')}</Button>} />
                  <SheetBody flush>
                    <TableWrap style={{ border: 0, borderRadius: 0 }} className={styles.actionsTable}>
                      <Table>
                        <thead>
                          <tr>
                            <th scope="col">{t('processes.plans.columns.action')}</th>
                            <th scope="col">{t('processes.plans.columns.owner')}</th>
                            <th scope="col">{t('processes.plans.columns.due')}</th>
                            <th scope="col">{t('processes.plans.columns.status')}</th>
                            <th scope="col">{t('processes.plans.columns.evidence')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {actions.length === 0 ? (
                            <tr>
                              <td colSpan={5}>{t('processes.plans.empty')}</td>
                            </tr>
                          ) : null}
                          {actions.map((a) => {
                            const days = differenceInCalendarDays(parseISO(a.due), now);
                            const overdue = a.status !== 'complete' && a.status !== 'cancelled' && days < 0;
                            return (
                              <tr key={a.id}>
                                <td>{a.title}</td>
                                <td>
                                  {a.ownerName} <span style={{ color: 'var(--color-ink-3)' }}>({agencyShort(a.ownerAgency)})</span>
                                </td>
                                <td className={overdue ? styles.overdue : undefined}>{a.status !== 'complete' ? t('processes.plans.dueRelative', { date: formatDate(a.due), relative: relativeDays(days) }) : formatDate(a.due)}</td>
                                <td>
                                  <Pill size="sm" tone={a.status === 'complete' ? 'low' : overdue ? 'critical' : a.status === 'in-progress' ? 'accent' : 'neutral'}>
                                    {overdue ? t('processes.plans.overdue') : actionStatusLabel(a.status)}
                                  </Pill>
                                </td>
                                <td>{a.evidence ?? ''}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </Table>
                    </TableWrap>
                  </SheetBody>
                </Sheet>
              </div>
            </div>
          </>
        )}
      </ScreenState>

      <Dialog
        open={breakGlassOpen}
        onClose={() => setBreakGlassOpen(false)}
        title={t('processes.breakGlass.title')}
        actions={
          <>
            <Button variant="quiet" onClick={() => setBreakGlassOpen(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button
              variant="danger"
              icon={<Lock size={16} aria-hidden="true" />}
              disabled={!reasonCategory || reason.trim().length < 15}
              onClick={() => {
                grantBreakGlass(process.id, reasonCategory, reason);
                setBreakGlassOpen(false);
                setReason('');
                setReasonCategory('');
                toast({ title: t('processes.breakGlass.granted.title'), text: t('processes.breakGlass.granted.text', { hours: config.breakGlassHours }), tone: 'info' });
              }}
            >
              {t('processes.breakGlass.submit')}
            </Button>
          </>
        }
      >
        <p>{t('processes.breakGlass.intro', { reason: access.reason })}</p>
        <SelectField label={t('processes.breakGlass.category.label')} required value={reasonCategory} onChange={(e) => setReasonCategory(e.target.value)} placeholder={t('processes.breakGlass.category.placeholder')} options={config.breakGlassReasons.map((r) => ({ value: r, label: r }))} />
        <TextareaField label={t('processes.breakGlass.reason.label')} required value={reason} onChange={(e) => setReason(e.target.value)} hint={t('processes.breakGlass.reason.hint')} />
      </Dialog>

      <Dialog
        open={classifyOpen}
        onClose={() => setClassifyOpen(false)}
        title={t('processes.classification.title')}
        actions={
          <>
            <Button variant="quiet" onClick={() => setClassifyOpen(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={classifyReason.trim().length < 15 || (!classifySensitive && derived.sensitive && !mayLower)}
              onClick={() => {
                const proposed: Classification = { level: derived.level, sensitive: classifySensitive, handling: derived.handling };
                // Both refusals are enforced here rather than in the disabled state, because the
                // disabled state is not what runs when somebody scripts a change.
                const decision = overrideDecision(config, process, proposed, user.roleId, linkedRecords);
                if (decision.refusal === 'not-permitted') {
                  toast({ title: t('processes.classification.refused.title'), text: t('processes.classification.refused.text'), tone: 'error' });
                  return;
                }
                if (decision.refusal === 'below-linked') {
                  toast({
                    title: t('processes.classification.refused.belowLinkedTitle'),
                    text: t('processes.classification.refused.belowLinkedText', { floor: classificationLabel(decision.floor ?? proposed) }),
                    tone: 'error',
                  });
                  return;
                }
                const direction = overrideDirection(derived, proposed);
                // The audit entry is the record of the act and the override field is the current
                // state. The entry is written first so the record can cite its id.
                const entry = audit({
                  act: direction === 'lowered' ? 'classification-lower' : 'classification-raise',
                  targetType: 'process',
                  targetId: process.id,
                  targetLabel: t('processes.classification.audit', { reference: process.reference, level: classificationLabel(proposed) }),
                  processId: process.id,
                  reason: classifyReason.trim(),
                  restricted: process.accessRestriction === 'restricted',
                });
                upsert('processes', {
                  ...process,
                  classificationOverride: {
                    ...proposed,
                    direction,
                    reason: classifyReason.trim(),
                    byUserId: user.id,
                    byName: userName(user),
                    at: now.toISOString(),
                    auditEntryId: entry?.id ?? '',
                  },
                });
                setClassifyOpen(false);
                toast({ title: t('processes.classification.saved.title'), text: t('processes.classification.saved.text', { marking: marking(proposed) ?? t('nav.drawer.fields.noMarking') }), tone: 'success' });
              }}
            >
              {t('processes.classification.submit')}
            </Button>
          </>
        }
      >
        <p>{t('processes.classification.intro', { marking: marking(derived) ?? t('nav.drawer.fields.noMarking') })}</p>
        <p>
          {effective.override
            ? t(effective.override.direction === 'raised' ? 'processes.classification.override.raised' : 'processes.classification.override.lowered', {
                derived: classificationLabel(derived),
                name: effective.override.byName,
                date: formatDate(effective.override.at),
              })
            : t('processes.classification.override.derivedNote')}
        </p>
        <SelectField
          label={t('processes.classification.level.label')}
          required
          value={classifySensitive ? 'sensitive' : 'routine'}
          onChange={(e) => setClassifySensitive(e.target.value === 'sensitive')}
          options={[
            { value: 'routine', label: classificationLabel(OFFICIAL) },
            { value: 'sensitive', label: classificationLabel(officialSensitive()) },
          ]}
          hint={mayLower ? t('processes.classification.level.mayLower') : t('processes.classification.level.mayNotLower')}
        />
        <TextareaField label={t('processes.classification.reason.label')} required value={classifyReason} onChange={(e) => setClassifyReason(e.target.value)} hint={t('processes.classification.reason.hint')} />
      </Dialog>

      {planOpen ? <AddPlanDialog process={process} open onClose={() => setPlanOpen(false)} /> : null}
      {registerOpen ? <RegisterEntryDialog process={process} open onClose={() => setRegisterOpen(false)} /> : null}
    </div>
  );
}

function TypePanels({ process }: { process: Process }): ReactNode {
  switch (process.type) {
    case 'asp':
      return <AspPanels process={process} />;
    case 'cp':
      return <CpPanels process={process} />;
    case 'marac':
      return <MaracPanels process={process} />;
    case 'mappa':
      return <MappaPanels process={process} />;
    case 'awi':
      return <AwiPanels process={process} />;
  }
}
