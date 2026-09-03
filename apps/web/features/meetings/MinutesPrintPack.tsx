'use client';

import { AGENCIES, AGENCY_LABELS, AGENCY_SHORT, CLASSIFICATION_LABELS, DETAIL_LEVEL_LABELS, MEETING_TYPE_LABELS, PROCESS_LABELS, VIEWS_KIND_LABELS, formatDate, formatDateTime, formatTime, type Action, type Dataset, type LawfulBasisRecord, type Meeting, dueDateFor, findClockRule, localDateOf } from '@mas/domain';
import { Button, ClassificationBanner, RestrictedState } from '@mas/ui';
import { ArrowLeft, Printer } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { AppLink } from '@/components/AppLink';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { meetingPath } from '@/lib/routes';
import { accessForUser, fullName, personById } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useNow } from '@/lib/store';
import styles from './MinutesPrintPack.module.css';

type Attendance = Meeting['invitees'][number]['attendance'];

/** Attendance is a word in print, never a colour. */
const ATTENDANCE_WORDS: Record<Attendance, string> = {
  invited: 'Invited, not yet confirmed',
  accepted: 'Accepted',
  declined: 'Declined',
  present: 'Present',
  remote: 'Present by video link',
  apologies: 'Apologies',
  absent: 'Absent',
};

const ACTION_WORDS: Record<Action['status'], string> = {
  open: 'Open',
  'in-progress': 'In progress',
  complete: 'Complete',
  cancelled: 'Cancelled',
};

/** Rough lines a section takes on an A4 page, used to start a new page where a section is long. */
const PAGE_BUDGET = 44;
const COVER_COST = 16;

interface PackSection {
  id: string;
  weight: number;
  node: ReactNode;
}

/** The lawful basis records carry no process id; the process reaches them through its shares and integrated events. */
function lawfulBasisForProcess(data: Dataset, processId: string): LawfulBasisRecord | undefined {
  const ids = new Set<string>();
  for (const s of data.sharingRecords) if (s.processId === processId) ids.add(s.lawfulBasisId);
  for (const e of data.events) if (e.lawfulBasisId && e.linkedProcessIds.includes(processId)) ids.add(e.lawfulBasisId);
  return data.lawfulBases.find((b) => ids.has(b.id));
}

function minuteStatusLine(minute: Meeting['minute'], recipients: number): string {
  switch (minute.status) {
    case 'not-started':
      return 'Not yet drafted. This pack is a working copy of the meeting record.';
    case 'draft':
      return `Draft, not yet approved${minute.draftedAt ? ` (drafted ${formatDate(minute.draftedAt)})` : ''}.`;
    case 'chair-approved':
      return `Approved by the chair on ${minute.approvedAt ? formatDate(minute.approvedAt) : 'a date not recorded'}.`;
    case 'distributed':
      return `Distributed on ${minute.distributedAt ? formatDate(minute.distributedAt) : 'a date not recorded'} to ${recipients} ${recipients === 1 ? 'recipient' : 'recipients'}.`;
  }
}

function paginate(sections: PackSection[]): PackSection[][] {
  const pages: PackSection[][] = [[]];
  let used = COVER_COST;
  for (const s of sections) {
    const current = pages[pages.length - 1]!;
    if (current.length > 0 && used + s.weight > PAGE_BUDGET) {
      pages.push([s]);
      used = s.weight;
    } else {
      current.push(s);
      used += s.weight;
    }
  }
  return pages;
}

/** The minute of a meeting as a paginated print pack: classification marking, running head and foot, attendance, views, decisions, actions, distribution and signatures. */
export function MinutesPrintPack({ meetingId }: { meetingId: string }) {
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const now = useNow();
  const route = useRoute();
  const navigate = useNavigate();
  const grants = useAppStore((s) => s.session.breakGlass);
  const audit = useAppStore((s) => s.audit);

  const meeting = data.meetings.find((m) => m.id === meetingId);
  const process = meeting ? data.processes.find((p) => p.id === meeting.processId) : undefined;
  const access = user && process ? accessForUser(data, config, user, process, grants, now) : undefined;
  const invited = !!user && !!meeting && (meeting.invitees.some((i) => i.userId === user.id) || meeting.chairUserId === user.id || meeting.minuteTakerUserId === user.id);
  const allowed = !!meeting && !!process && !!access && access.level !== 'none' && (invited || access.level === 'full');

  useEffect(() => {
    if (!meeting || !process || !allowed) return;
    const restricted = process.classification === 'restricted';
    const label = `Minutes pack: ${meeting.title}`;
    if (restricted) audit({ act: 'read-restricted', targetType: 'meeting', targetId: meeting.id, targetLabel: label, processId: process.id, restricted: true });
    audit({ act: 'export', targetType: 'meeting', targetId: meeting.id, targetLabel: label, processId: process.id, restricted });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  if (!user) return null;
  if (!meeting || !process) {
  
  return (
      <div className="page">
        <RestrictedState title="Meeting not found" reason="This meeting does not exist in the demo dataset." breakGlass="unavailable" />
        <AppLink href="/meetings">All meetings</AppLink>
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="page">
        <RestrictedState title={`${MEETING_TYPE_LABELS[meeting.type]}: not on the distribution list`} reason={access?.level === 'none' ? access.reason : 'You are not invited to this meeting and are not a full member of the case. The minute goes to attendees and the distribution list only.'} breakGlass="unavailable" />
      </div>
    );
  }

  const marking = config.classificationMarkings.find((m) => m.id === process.classification) ?? { id: process.classification, label: CLASSIFICATION_LABELS[process.classification], handling: '' };
  const subjects = meeting.subjectIds.map((id) => personById(data, id)).filter((p) => p !== undefined);
  const views = data.viewsRecords.filter((v) => meeting.viewsRecordIds.includes(v.id));
  const actions = data.actions.filter((a) => a.meetingId === meeting.id || meeting.actionIds.includes(a.id));
  const shared = meeting.informationShared;
  const sharedAgencies = AGENCIES.filter((a) => shared.some((s) => s.agency === a));
  const lawfulBasis = lawfulBasisForProcess(data, process.id);
  const back = `${meetingPath(meeting.id)}${setQuery(route.query, { view: null })}`;
  const subjectNames = subjects.map((s) => fullName(s)).join(', ') || 'Subject not recorded';

  const sections: PackSection[] = [
    {
      id: 'agenda',
      weight: 3 + meeting.agenda.length,
      node: (
        <>
          <h2>Agenda</h2>
          {meeting.agenda.length === 0 ? <p className={styles.text}>No agenda recorded.</p> : null}
          <ol className={styles.agenda}>
            {[...meeting.agenda]
              .sort((a, b) => a.order - b.order)
              .map((a) => (
                <li key={a.id}>
                  {a.title}
                  {a.note ? `: ${a.note}` : ''}
                </li>
              ))}
          </ol>
        </>
      ),
    },
    {
      id: 'attendance',
      weight: 4 + meeting.invitees.length + (meeting.subjectAttendance ? 2 : 0),
      node: (
        <>
          <h2>Attendance</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Agency</th>
                <th scope="col">Role</th>
                <th scope="col">Attendance</th>
              </tr>
            </thead>
            <tbody>
              {meeting.invitees.length === 0 ? (
                <tr>
                  <td colSpan={4}>No invitees recorded.</td>
                </tr>
              ) : (
                meeting.invitees.map((i, idx) => (
                  <tr key={`${i.name}-${idx}`}>
                    <td>{i.name}</td>
                    <td>{AGENCY_LABELS[i.agency]}</td>
                    <td>
                      {i.role}
                      {i.required ? '' : ' (optional)'}
                    </td>
                    <td>{ATTENDANCE_WORDS[i.attendance]}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {meeting.subjectAttendance ? <p className={styles.text}>Subject and family: {meeting.subjectAttendance}</p> : null}
        </>
      ),
    },
    {
      id: 'purpose',
      weight: 10 + (lawfulBasis ? 4 : 0),
      node: (
        <>
          <h2>Purpose and confidentiality</h2>
          <p className={styles.text}>
            {MEETING_TYPE_LABELS[meeting.type]} for {subjectNames} under {process.reference} ({PROCESS_LABELS[process.type]}), chaired by {meeting.chairName}.
          </p>
          <p className={styles.text}>This minute is confidential to the recipients on the distribution list. It must not be copied or shared further without the chair&apos;s agreement. Each recipient receives only the detail level the need-to-know rules allow for this stage, and every copy is audited.</p>
          {lawfulBasis ? (
            <p className={styles.text}>
              <strong>Lawful basis:</strong> {lawfulBasis.purpose}. {lawfulBasis.article6}; {lawfulBasis.article9Condition}
              {lawfulBasis.article10Criminal !== 'not applicable' ? `; ${lawfulBasis.article10Criminal}` : ''}; {lawfulBasis.statutoryGateway.join('; ')}. Authorised by {lawfulBasis.authorisedByName}.
              {lawfulBasis.informationSharingAgreementRef ? ` Information sharing agreement ${lawfulBasis.informationSharingAgreementRef}.` : ''}
            </p>
          ) : (
            <p className={styles.text}>
              <strong>Lawful basis:</strong> no lawful basis record is linked to this process yet. Record one before the minute is distributed.
            </p>
          )}
          <p className={styles.text}>Handling: {marking.handling || 'As marked.'}</p>
        </>
      ),
    },
    {
      id: 'views',
      weight: 3 + (views.length === 0 ? 2 : views.length * 7),
      node: (
        <>
          <h2>Views of the person read into the record</h2>
          {views.length === 0 ? <p className={styles.text}>No views were read into the record at this meeting.</p> : null}
          {views.map((v) => {
            const p = personById(data, v.personId);
            return (
              <figure key={v.id} className={styles.voice}>
                <figcaption className={styles.voiceKind}>{VIEWS_KIND_LABELS[v.kind]}</figcaption>
                <blockquote className={styles.voiceQuote}>{v.content}</blockquote>
                <p className={styles.voiceMeta}>
                  <strong>{p ? fullName(p) : 'Family'}</strong>, {formatDate(v.recordedAt)}. Recorded by {v.recordedByName} ({AGENCY_SHORT[v.recordedByAgency]}), {v.method}.
                  {v.sharingPreference ? ` How they want it used: ${v.sharingPreference}` : ''}
                </p>
              </figure>
            );
          })}
        </>
      ),
    },
    {
      id: 'shared',
      weight: 3 + (shared.length === 0 ? 2 : sharedAgencies.length * 2 + shared.length * 4),
      node: (
        <>
          <h2>Information shared by agency</h2>
          {shared.length === 0 ? <p className={styles.text}>No information shared was recorded at this meeting.</p> : null}
          {sharedAgencies.map((a) => (
            <div key={a} className={styles.group}>
              <h3>{AGENCY_LABELS[a]}</h3>
              {shared
                .filter((s) => s.agency === a)
                .map((s) => (
                  <p key={s.id} className={styles.text}>
                    <strong>{s.byName}</strong>, {formatDateTime(s.at)}. {s.summary} <span className={styles.muted}>Relevance: {s.relevance}</span>
                  </p>
                ))}
            </div>
          ))}
        </>
      ),
    },
    {
      id: 'decisions',
      weight: 3 + (meeting.decisions.length === 0 ? 2 : meeting.decisions.reduce((n, d) => n + 5 + d.dissent.length * 2, 0)),
      node: (
        <>
          <h2>Decisions, rationale and dissent</h2>
          {meeting.decisions.length === 0 ? <p className={styles.text}>No decisions were recorded at this meeting.</p> : null}
          <ol className={styles.decisions}>
            {meeting.decisions.map((d) => (
              <li key={d.id} className={styles.decision}>
                <p className={styles.text}>
                  <strong>{d.question}</strong>
                </p>
                <p className={styles.text}>Decision: {d.decision}</p>
                <p className={styles.text}>
                  Rationale: {d.rationale} Decided by {d.decidedByName}, {formatDateTime(d.decidedAt)}.
                </p>
                {d.dissent.length === 0 ? (
                  <p className={styles.muted}>No dissent recorded.</p>
                ) : (
                  d.dissent.map((x, i) => (
                    <p key={i} className={styles.dissent}>
                      Dissent recorded by {x.byName} ({AGENCY_LABELS[x.agency]}): {x.text}
                    </p>
                  ))
                )}
              </li>
            ))}
          </ol>
        </>
      ),
    },
    {
      id: 'actions',
      weight: 4 + (actions.length === 0 ? 1 : actions.length * 2),
      node: (
        <>
          <h2>Actions</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Action</th>
                <th scope="col">Owner</th>
                <th scope="col">Due</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {actions.length === 0 ? (
                <tr>
                  <td colSpan={4}>No actions on this meeting.</td>
                </tr>
              ) : (
                actions.map((a) => (
                  <tr key={a.id}>
                    <td>{a.title}</td>
                    <td>
                      {a.ownerName} ({AGENCY_SHORT[a.ownerAgency]})
                    </td>
                    <td className={styles.nowrap}>{formatDate(a.due)}</td>
                    <td className={styles.nowrap}>
                      {ACTION_WORDS[a.status]}
                      {a.status === 'complete' && a.completedAt ? `, ${formatDate(a.completedAt)}` : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      ),
    },
    {
      id: 'distribution',
      weight: 4 + (meeting.distribution.length === 0 ? 1 : Math.ceil(meeting.distribution.length * 1.5)),
      node: (
        <>
          <h2>Distribution list</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Recipient</th>
                <th scope="col">Agency</th>
                <th scope="col">Role</th>
                <th scope="col">Detail level</th>
                <th scope="col">Reason</th>
              </tr>
            </thead>
            <tbody>
              {meeting.distribution.length === 0 ? (
                <tr>
                  <td colSpan={5}>No distribution list yet. Generate it from need-to-know in the meeting workspace before the minute is distributed.</td>
                </tr>
              ) : (
                meeting.distribution.map((d) => (
                  <tr key={d.id}>
                    <td>{d.recipientName}</td>
                    <td>{AGENCY_LABELS[d.agency]}</td>
                    <td>{d.role}</td>
                    <td>
                      {DETAIL_LEVEL_LABELS[d.detailLevel]}
                      {d.fields && d.fields.length > 0 ? `: ${d.fields.join('; ')}` : ''}
                    </td>
                    <td>{d.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      ),
    },
    {
      id: 'signatures',
      weight: 12,
      node: (
        <>
          <h2>Review and approval</h2>
          <p className={styles.text}>Review date: {meeting.reviewDate ? formatDate(meeting.reviewDate) : 'not yet set'}.</p>
          <p className={styles.text}>Minute taken by {meeting.minuteTakerName ?? 'a minute taker not recorded'}. {minuteStatusLine(meeting.minute, meeting.distribution.length)}</p>
          <div className={styles.signatures}>
            <div className={styles.signature}>
              <span className={styles.signatureLine} aria-hidden="true" />
              <span>Signed, chair: {meeting.chairName}</span>
            </div>
            <div className={styles.signature}>
              <span className={styles.signatureLine} aria-hidden="true" />
              <span>Date</span>
            </div>
          </div>
        </>
      ),
    },
  ];

  const pages = paginate(sections);
  const totalPages = pages.length;

  const recordRule = process.type === 'cp' ? findClockRule(config.clockRules, 'cp.cppm.record.distribute') : undefined;
  const recordTrigger = process.clocks.find((c) => c.ruleId === 'cp.cppm.record.distribute' && !c.completedAt);
  const recordDeadline = recordRule && recordTrigger ? `${formatDate(localDateOf(dueDateFor(recordRule, recordTrigger.triggeredAt, { bankHolidays: config.bankHolidays, councilHolidays: config.councilHolidays })))} (10 working days after the meeting, Appendix D)` : recordRule && process.clocks.some((c) => c.ruleId === 'cp.cppm.record.distribute' && c.completedAt) ? 'Distributed within the 10 working days (Appendix D)' : null;

  const head = (page: number) => (
    <div className={styles.head}>
      <span>
        {marking.label}. {process.reference}
      </span>
      <span>Minute: {meeting.title}</span>
      <span>
        Page {page} of {totalPages}
      </span>
    </div>
  );
  const foot = (
    <div className={styles.foot}>
      <span>Printed {formatDateTime(now)} from the platform. Synthetic demonstration data.</span>
      <span>{marking.label}</span>
    </div>
  );

  return (
    <div className={`${styles.pack} print-pack`} data-minute={meeting.minute.status}>
      <div className={`${styles.controls} no-print`}>
        <Button variant="secondary" icon={<ArrowLeft size={16} aria-hidden="true" />} onClick={() => navigate(back)}>
          Back to the meeting
        </Button>
        <Button variant="primary" size="lg" icon={<Printer size={16} aria-hidden="true" />} onClick={() => window.print()}>
          Print
        </Button>
      </div>
      <ClassificationBanner level={process.classification} />
      {pages.map((page, i) => (
        <section key={i} className={`${styles.page} print-page`}>
          {head(i + 1)}
          {i === 0 ? (
            <>
              <p className={styles.kicker}>Minute of the meeting</p>
              <h1 className={styles.title}>{meeting.title}</h1>
              <dl className={styles.meta}>
                <div className={styles.metaRow}>
                  <dt>Type</dt>
                  <dd>{MEETING_TYPE_LABELS[meeting.type]}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt>Date and time</dt>
                  <dd>
                    {formatDate(meeting.scheduledAt)}, {formatTime(meeting.scheduledAt)}
                    {meeting.endsAt ? ` to ${formatTime(meeting.endsAt)}` : ''}
                  </dd>
                </div>
                <div className={styles.metaRow}>
                  <dt>Location</dt>
                  <dd>{meeting.location}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt>Chair</dt>
                  <dd>{meeting.chairName}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt>Minute taker</dt>
                  <dd>{meeting.minuteTakerName ?? 'Not recorded'}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt>{subjects.length === 1 ? 'Subject' : 'Subjects'}</dt>
                  <dd>
                    {subjects.length === 0
                      ? 'Not recorded'
                      : subjects.map((s) => (
                          <span key={s.id} className={styles.subject}>
                            {fullName(s)}, born {s.dateOfBirth ? formatDate(s.dateOfBirth) : 'date not recorded'}
                          </span>
                        ))}
                  </dd>
                </div>
                <div className={styles.metaRow}>
                  <dt>Process</dt>
                  <dd>
                    {process.reference}: {process.title} ({PROCESS_LABELS[process.type]}, {process.stage} stage)
                  </dd>
                </div>
                <div className={styles.metaRow}>
                  <dt>Minute status</dt>
                  <dd>{minuteStatusLine(meeting.minute, meeting.distribution.length)}</dd>
                  {recordDeadline ? (
                    <>
                      <dt>Record due</dt>
                      <dd>{recordDeadline}</dd>
                    </>
                  ) : null}
                </div>
              </dl>
            </>
          ) : null}
          {page.map((s) => (
            <div key={s.id} className={styles.section}>
              {s.node}
            </div>
          ))}
          {foot}
        </section>
      ))}
    </div>
  );
}
