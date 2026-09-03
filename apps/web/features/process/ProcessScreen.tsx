'use client';

import { AGENCY_SHORT, PROCESS_LABELS, PROCESS_SHORT, STAGES_BY_PROCESS, formatDate, formatDateTime, formatTime, relativeDays, stageLabel, type Process } from '@mas/domain';
import { AgencyMark, Button, ClassificationBanner, ClockNumeral, Dialog, EmptyState, Pill, ProcessMark, SelectField, Sheet, SheetBody, SheetHead, Stepper, Table, TableWrap, TextareaField, VoiceBlock, useToast, type Step } from '@mas/ui';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Lock, UserPlus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { meetingPath, personPath } from '@/lib/routes';
import { useSelection } from '@/lib/selection';
import { accessForUser, clocksForProcess, fullName, membersByAgency, personById, userName } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useNow } from '@/lib/store';
import { AspPanels } from './panels/AspPanels';
import { AwiPanels } from './panels/AwiPanels';
import { CpPanels } from './panels/CpPanels';
import { MappaPanels } from './panels/MappaPanels';
import { MaracPanels } from './panels/MaracPanels';
import styles from './ProcessScreen.module.css';

export function ProcessScreen({ processId }: { processId: string }) {
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const now = useNow();
  const select = useSelection((s) => s.select);
  const grants = useAppStore((s) => s.session.breakGlass);
  const audit = useAppStore((s) => s.audit);
  const grantBreakGlass = useAppStore((s) => s.grantBreakGlass);
  const { toast } = useToast();
  const dev = useDevState();
  const [breakGlassOpen, setBreakGlassOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonCategory, setReasonCategory] = useState('');

  const process = data.processes.find((p) => p.id === processId);

  useEffect(() => {
    select({ kind: 'process', id: processId });
  }, [processId, select]);

  useEffect(() => {
    if (process) audit({ act: process.classification === 'restricted' ? 'read-restricted' : 'read', targetType: 'process', targetId: process.id, targetLabel: `${process.reference}: ${process.title}`, processId: process.id, restricted: process.classification === 'restricted' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId]);

  if (!user) return null;
  if (!process) {
    return (
      <div className="page">
        <EmptyState title="Process not found" text="This process does not exist in the demo dataset." actions={<AppLink href="/processes">All processes</AppLink>} />
      </div>
    );
  }

  const access = accessForUser(data, config, user, process, grants, now);
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

  const state = dev ?? (access.level === 'none' ? 'restricted' : 'ready');

  const header = (
    <header className={styles.head}>
      <div>
        <div className={styles.ref}>
          <ProcessMark type={process.type} stage={stageLabel(process.type, process.stage)} restricted={process.classification === 'restricted'} />
          <span>{process.reference}</span>
          <span>Lead: {AGENCY_SHORT[process.leadAgency]}</span>
          <span>Opened {formatDate(process.openedAt)}</span>
          <Pill size="sm" tone={process.status === 'open' ? 'low' : 'outline'}>
            {process.status}
          </Pill>
        </div>
        <h1 className={styles.title}>{access.level === 'none' ? `${PROCESS_LABELS[process.type]} (restricted)` : process.title}</h1>
        {access.level !== 'none' ? (
          <div className={styles.subjects}>
            {subjects.map((s) => (
              <span key={s.id}>
                <AppLink href={personPath(s.id)}>{fullName(s)}</AppLink>
                {s.dateOfBirth ? `, born ${formatDate(s.dateOfBirth)}` : s.lifeStage === 'unborn' ? ', unborn' : ''}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className={styles.headActions}>
        {nextMeeting && access.level !== 'none' ? (
          <AppLink href={meetingPath(nextMeeting.id)}>
            Next: {nextMeeting.title}, {formatDate(nextMeeting.scheduledAt)}
          </AppLink>
        ) : null}
        {access.level === 'presence' ? (
          <Button variant="secondary" icon={<UserPlus size={16} aria-hidden="true" />} onClick={() => toast({ title: 'Request sent to the lead', text: `${process.leadUserId ? userName(data.users.find((u) => u.id === process.leadUserId)!) : 'The lead agency'} will see your request to be involved and the reason.` })}>
            Ask to be involved
          </Button>
        ) : null}
      </div>
    </header>
  );

  return (
    <div className="page">
      {process.classification === 'restricted' ? <ClassificationBanner level="restricted" className={styles.banner} /> : null}
      {header}
      <ScreenState
        state={state}
        restricted={{ reason: access.reason, breakGlass: access.breakGlass, onBreakGlass: () => setBreakGlassOpen(true) }}
      >
        {access.level === 'presence' ? (
          <div className={styles.summaryOnly}>
            <p>
              You can see that a {PROCESS_LABELS[process.type]} process exists at the {stageLabel(process.type, process.stage)} stage, led by {AGENCY_SHORT[process.leadAgency]}. {access.reason}
            </p>
          </div>
        ) : (
          <>
            <div className={styles.stepper}>
              <Stepper steps={steps} label="Process stages" />
            </div>
            <div className={styles.layout}>
              <div className={styles.main}>
                {access.level === 'summary' || access.level === 'fields' ? (
                  <Sheet tone="well">
                    <SheetHead title={access.level === 'summary' ? 'Summary access' : 'Named fields only'} meta={access.reason} />
                    <SheetBody>
                      {access.level === 'fields' ? (
                        <ul>
                          {access.fields.map((f) => (
                            <li key={f}>{f}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>
                          Stage {stageLabel(process.type, process.stage)}, lead {AGENCY_SHORT[process.leadAgency]}, next date {nextMeeting ? formatDate(nextMeeting.scheduledAt) : 'none scheduled'}. The full record is not shared with your role at this stage.
                        </p>
                      )}
                    </SheetBody>
                  </Sheet>
                ) : (
                  <TypePanels process={process} />
                )}
              </div>
              <div className={styles.side}>
                <Sheet>
                  <SheetHead title="Clocks" meta={clocks.length === 0 ? 'No clock running' : `${clocks.filter((c) => c.status !== 'complete').length} running`} />
                  <SheetBody>
                    <div className={styles.clockList}>
                      {clocks.map((c) => (
                        <ClockNumeral key={c.triggerId} daysRemaining={c.daysRemaining} band={c.band} status={c.status} label={c.label} sub={`Due ${formatDate(c.dueAt)}. ${c.overridden ? c.overrideReason : c.sourceRef}${c.todoVerify ? ' (local value, to verify)' : ''}`} size="sm" />
                      ))}
                    </div>
                  </SheetBody>
                </Sheet>
                <Sheet>
                  <SheetHead title="Participants and roles" meta={`${process.members.length} on the case`} />
                  <SheetBody>
                    <div className={styles.members}>
                      {membersByAgency(data, process).map((g) => (
                        <div key={g.agency}>
                          <AgencyMark agency={g.agency} />
                          {g.members.map((m) => (
                            <div key={m.membership.userId} className={styles.member} style={{ marginTop: 4, paddingLeft: 22 }}>
                              <span className={styles.memberName}>{m.user ? userName(m.user) : m.membership.userId}</span>
                              <span className={styles.memberMeta}>
                                {m.membership.caseRole}. Since {formatDate(m.membership.since)}. {m.membership.reason}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </SheetBody>
                </Sheet>
                <Sheet tone="paper">
                  <SheetHead title="Views and voice" meta={views.length === 0 ? 'Not yet recorded' : `${views.length} recorded`} />
                  <SheetBody>
                    <div className={styles.voices}>
                      {views.slice(0, 2).map((v) => {
                        const p = personById(data, v.personId);
                        return <VoiceBlock key={v.id} record={v} personName={p ? (p.preferredName ?? p.givenName) : 'Family'} size="sm" />;
                      })}
                    </div>
                  </SheetBody>
                </Sheet>
                <Sheet>
                  <SheetHead title="Meetings" meta={`${meetings.length} on this process`} />
                  <SheetBody>
                    <div className={styles.meetingList}>
                      {meetings.map((m) => (
                        <AppLink key={m.id} href={meetingPath(m.id)} className={styles.meeting}>
                          <span className={styles.meetingDate}>{formatDate(m.scheduledAt).slice(0, 6)}</span>
                          <span className={styles.meetingTitle}>{m.title}</span>
                          <span className={styles.meetingMeta}>
                            {m.status === 'held' ? `Held ${formatTime(m.scheduledAt)}. Minute ${m.minute.status.replace('-', ' ')}.` : m.status === 'scheduled' ? `${formatDateTime(m.scheduledAt)}, ${m.location}` : m.status}
                          </span>
                        </AppLink>
                      ))}
                    </div>
                  </SheetBody>
                </Sheet>
                <Sheet>
                  <SheetHead title="Sharing" meta={`${shares.length} shares recorded, each with a lawful basis`} />
                  <SheetBody>
                    <ul className={styles.members}>
                      {shares.slice(0, 6).map((s) => (
                        <li key={s.id} className={styles.member} onMouseEnter={() => select({ kind: 'share', id: s.id })}>
                          <span className={styles.memberName}>{s.recipient.name}</span>
                          <span>
                            <Pill size="sm" tone="outline">
                              {s.detailLevel}
                            </Pill>
                          </span>
                          <span className={styles.memberMeta}>
                            {s.reason} {formatDate(s.createdAt)}.
                          </span>
                        </li>
                      ))}
                    </ul>
                  </SheetBody>
                </Sheet>
              </div>
              <div className={styles.wide}>
                <Sheet>
                  <SheetHead title="Plans and actions" meta={plans.length === 0 ? 'No plan yet' : plans.map((p) => `${p.title} (${p.status})`).join('; ')} />
                  <SheetBody flush>
                    <TableWrap style={{ border: 0, borderRadius: 0 }} className={styles.actionsTable}>
                      <Table>
                        <thead>
                          <tr>
                            <th scope="col">Action</th>
                            <th scope="col">Owner</th>
                            <th scope="col">Due</th>
                            <th scope="col">Status</th>
                            <th scope="col">Evidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {actions.length === 0 ? (
                            <tr>
                              <td colSpan={5}>No actions recorded yet.</td>
                            </tr>
                          ) : null}
                          {actions.map((a) => {
                            const days = differenceInCalendarDays(parseISO(a.due), now);
                            const overdue = a.status !== 'complete' && a.status !== 'cancelled' && days < 0;
                            return (
                              <tr key={a.id}>
                                <td>{a.title}</td>
                                <td>
                                  {a.ownerName} <span style={{ color: 'var(--color-ink-3)' }}>({AGENCY_SHORT[a.ownerAgency]})</span>
                                </td>
                                <td className={overdue ? styles.overdue : undefined}>
                                  {formatDate(a.due)}
                                  {a.status !== 'complete' ? ` (${relativeDays(days)})` : ''}
                                </td>
                                <td>
                                  <Pill size="sm" tone={a.status === 'complete' ? 'low' : overdue ? 'critical' : a.status === 'in-progress' ? 'accent' : 'neutral'}>
                                    {overdue ? 'overdue' : a.status.replace('-', ' ')}
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
        title="Open a restricted record"
        actions={
          <>
            <Button variant="quiet" onClick={() => setBreakGlassOpen(false)}>
              Cancel
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
                toast({ title: 'Break-glass access granted', text: `Access lasts ${config.breakGlassHours} hours. Every read is audited and the coordinator is told.`, tone: 'info' });
              }}
            >
              Open with this reason
            </Button>
          </>
        }
      >
        <p>{access.reason} State why you need it now. Your reason, your name and every read are written to the audit log and shown to the coordinator.</p>
        <SelectField label="Why you need it" required value={reasonCategory} onChange={(e) => setReasonCategory(e.target.value)} placeholder="Choose a reason category" options={config.breakGlassReasons.map((r) => ({ value: r, label: r }))} />
        <TextareaField label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} hint="At least 15 characters. Say what is happening now and why it cannot wait." />
      </Dialog>
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

export { PROCESS_SHORT };
