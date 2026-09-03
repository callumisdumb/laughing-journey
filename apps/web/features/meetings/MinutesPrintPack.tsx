'use client';

import { AGENCIES, AGENCY_LABELS, AGENCY_SHORT, CLASSIFICATION_LABELS, DETAIL_LEVEL_LABELS, MEETING_TYPE_LABELS, PROCESS_LABELS, VIEWS_KIND_LABELS, formatDate, formatDateTime, formatTime, type Action, type Dataset, type LawfulBasisRecord, type Meeting, dueDateFor, findClockRule, localDateOf } from '@mas/domain';
import { useT, type MessageKey, type RichValues, type Translator } from '@mas/messages';
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
const ATTENDANCE_KEYS = {
  invited: 'print.minutes.attendanceLabels.invited',
  accepted: 'print.minutes.attendanceLabels.accepted',
  declined: 'print.minutes.attendanceLabels.declined',
  present: 'print.minutes.attendanceLabels.present',
  remote: 'print.minutes.attendanceLabels.remote',
  apologies: 'print.minutes.attendanceLabels.apologies',
  absent: 'print.minutes.attendanceLabels.absent',
} as const satisfies Record<Attendance, MessageKey>;

const ACTION_STATUS_KEYS = {
  open: 'print.minutes.actionStatusLabels.open',
  'in-progress': 'print.minutes.actionStatusLabels.inProgress',
  complete: 'print.minutes.actionStatusLabels.complete',
  cancelled: 'print.minutes.actionStatusLabels.cancelled',
} as const satisfies Record<Action['status'], MessageKey>;

/** Renders the <b> tag of a catalogue message as <strong>, for the bold lead-ins in the pack. */
const STRONG: RichValues = { b: (chunks) => <strong>{chunks}</strong> };

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

function minuteStatusLine(t: Translator, minute: Meeting['minute'], recipients: number): string {
  switch (minute.status) {
    case 'not-started':
      return t('print.minutes.status.notStarted');
    case 'draft':
      return t('print.minutes.status.draft', { hasDate: minute.draftedAt ? 'yes' : 'no', date: minute.draftedAt ? formatDate(minute.draftedAt) : '' });
    case 'chair-approved':
      return t('print.minutes.status.chairApproved', { date: minute.approvedAt ? formatDate(minute.approvedAt) : t('print.minutes.status.dateNotRecorded') });
    case 'distributed':
      return t('print.minutes.status.distributed', { date: minute.distributedAt ? formatDate(minute.distributedAt) : t('print.minutes.status.dateNotRecorded'), count: recipients });
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
  const t = useT();
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
    const label = t('meetings.audit.minutesPack', { title: meeting.title });
    if (restricted) audit({ act: 'read-restricted', targetType: 'meeting', targetId: meeting.id, targetLabel: label, processId: process.id, restricted: true });
    audit({ act: 'export', targetType: 'meeting', targetId: meeting.id, targetLabel: label, processId: process.id, restricted });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  if (!user) return null;
  if (!meeting || !process) {
    return (
      <div className="page">
        <RestrictedState title={t('meetings.notFound.title')} reason={t('meetings.notFound.text')} breakGlass="unavailable" />
        <AppLink href="/meetings">{t('meetings.notFound.back')}</AppLink>
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="page">
        <RestrictedState title={t('meetings.restricted.title', { type: MEETING_TYPE_LABELS[meeting.type] })} reason={access?.level === 'none' ? access.reason : t('print.minutes.restricted.reason')} breakGlass="unavailable" />
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
  const subjectNames = subjects.map((s) => fullName(s)).join(', ') || t('print.minutes.purpose.subjectNotRecorded');

  const sections: PackSection[] = [
    {
      id: 'agenda',
      weight: 3 + meeting.agenda.length,
      node: (
        <>
          <h2>{t('print.minutes.agenda.title')}</h2>
          {meeting.agenda.length === 0 ? <p className={styles.text}>{t('print.minutes.agenda.empty')}</p> : null}
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
          <h2>{t('print.minutes.attendance.title')}</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('print.minutes.columns.name')}</th>
                <th scope="col">{t('print.minutes.columns.agency')}</th>
                <th scope="col">{t('print.minutes.columns.role')}</th>
                <th scope="col">{t('print.minutes.columns.attendance')}</th>
              </tr>
            </thead>
            <tbody>
              {meeting.invitees.length === 0 ? (
                <tr>
                  <td colSpan={4}>{t('print.minutes.attendance.empty')}</td>
                </tr>
              ) : (
                meeting.invitees.map((i, idx) => (
                  <tr key={`${i.name}-${idx}`}>
                    <td>{i.name}</td>
                    <td>{AGENCY_LABELS[i.agency]}</td>
                    <td>{t('print.minutes.attendance.role', { required: i.required ? 'yes' : 'no', role: i.role })}</td>
                    <td>{t(ATTENDANCE_KEYS[i.attendance])}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {meeting.subjectAttendance ? <p className={styles.text}>{t('print.minutes.attendance.subjectFamily', { text: meeting.subjectAttendance })}</p> : null}
        </>
      ),
    },
    {
      id: 'purpose',
      weight: 10 + (lawfulBasis ? 4 : 0),
      node: (
        <>
          <h2>{t('print.minutes.purpose.title')}</h2>
          <p className={styles.text}>{t('print.minutes.purpose.summary', { type: MEETING_TYPE_LABELS[meeting.type], subjects: subjectNames, reference: process.reference, process: PROCESS_LABELS[process.type], chair: meeting.chairName })}</p>
          <p className={styles.text}>{t('print.minutes.purpose.confidential')}</p>
          {lawfulBasis ? (
            <p className={styles.text}>
              {t.rich('print.minutes.purpose.lawfulBasis', {
                ...STRONG,
                purpose: lawfulBasis.purpose,
                article6: lawfulBasis.article6,
                article9: lawfulBasis.article9Condition,
                hasArticle10: lawfulBasis.article10Criminal !== 'not applicable' ? 'yes' : 'no',
                article10: lawfulBasis.article10Criminal,
                gateway: lawfulBasis.statutoryGateway.join('; '),
                name: lawfulBasis.authorisedByName,
                hasIsa: lawfulBasis.informationSharingAgreementRef ? 'yes' : 'no',
                isa: lawfulBasis.informationSharingAgreementRef ?? '',
              })}
            </p>
          ) : (
            <p className={styles.text}>{t.rich('print.minutes.purpose.noLawfulBasis', { ...STRONG })}</p>
          )}
          <p className={styles.text}>{t('print.minutes.purpose.handling', { handling: marking.handling || t('print.minutes.purpose.asMarked') })}</p>
        </>
      ),
    },
    {
      id: 'views',
      weight: 3 + (views.length === 0 ? 2 : views.length * 7),
      node: (
        <>
          <h2>{t('print.minutes.views.title')}</h2>
          {views.length === 0 ? <p className={styles.text}>{t('print.minutes.views.empty')}</p> : null}
          {views.map((v) => {
            const p = personById(data, v.personId);
            return (
              <figure key={v.id} className={styles.voice}>
                <figcaption className={styles.voiceKind}>{VIEWS_KIND_LABELS[v.kind]}</figcaption>
                <blockquote className={styles.voiceQuote}>{v.content}</blockquote>
                <p className={styles.voiceMeta}>
                  {t.rich('print.minutes.views.meta', {
                    ...STRONG,
                    name: p ? fullName(p) : t('common.person.family'),
                    date: formatDate(v.recordedAt),
                    recorder: v.recordedByName,
                    agency: AGENCY_SHORT[v.recordedByAgency],
                    method: v.method,
                    hasPreference: v.sharingPreference ? 'yes' : 'no',
                    preference: v.sharingPreference ?? '',
                  })}
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
          <h2>{t('print.minutes.shared.title')}</h2>
          {shared.length === 0 ? <p className={styles.text}>{t('print.minutes.shared.empty')}</p> : null}
          {sharedAgencies.map((a) => (
            <div key={a} className={styles.group}>
              <h3>{AGENCY_LABELS[a]}</h3>
              {shared
                .filter((s) => s.agency === a)
                .map((s) => (
                  <p key={s.id} className={styles.text}>
                    {t.rich('print.minutes.shared.entry', { ...STRONG, name: s.byName, when: formatDateTime(s.at), summary: s.summary })} <span className={styles.muted}>{t('print.minutes.shared.relevance', { relevance: s.relevance })}</span>
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
          <h2>{t('print.minutes.decisions.title')}</h2>
          {meeting.decisions.length === 0 ? <p className={styles.text}>{t('print.minutes.decisions.empty')}</p> : null}
          <ol className={styles.decisions}>
            {meeting.decisions.map((d) => (
              <li key={d.id} className={styles.decision}>
                <p className={styles.text}>
                  <strong>{d.question}</strong>
                </p>
                <p className={styles.text}>{t('print.minutes.decisions.decision', { decision: d.decision })}</p>
                <p className={styles.text}>{t('print.minutes.decisions.rationale', { rationale: d.rationale, name: d.decidedByName, when: formatDateTime(d.decidedAt) })}</p>
                {d.dissent.length === 0 ? (
                  <p className={styles.muted}>{t('print.minutes.decisions.noDissent')}</p>
                ) : (
                  d.dissent.map((x, i) => (
                    <p key={i} className={styles.dissent}>
                      {t('print.minutes.decisions.dissent', { name: x.byName, agency: AGENCY_LABELS[x.agency], text: x.text })}
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
          <h2>{t('print.minutes.actions.title')}</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('print.minutes.columns.action')}</th>
                <th scope="col">{t('print.minutes.columns.owner')}</th>
                <th scope="col">{t('print.minutes.columns.due')}</th>
                <th scope="col">{t('print.minutes.columns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {actions.length === 0 ? (
                <tr>
                  <td colSpan={4}>{t('print.minutes.actions.empty')}</td>
                </tr>
              ) : (
                actions.map((a) => (
                  <tr key={a.id}>
                    <td>{a.title}</td>
                    <td>
                      {a.ownerName} ({AGENCY_SHORT[a.ownerAgency]})
                    </td>
                    <td className={styles.nowrap}>{formatDate(a.due)}</td>
                    <td className={styles.nowrap}>{t('print.minutes.actions.status', { status: t(ACTION_STATUS_KEYS[a.status]), hasCompleted: a.status === 'complete' && a.completedAt ? 'yes' : 'no', date: a.completedAt ? formatDate(a.completedAt) : '' })}</td>
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
          <h2>{t('print.minutes.distribution.title')}</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('print.minutes.columns.recipient')}</th>
                <th scope="col">{t('print.minutes.columns.agency')}</th>
                <th scope="col">{t('print.minutes.columns.role')}</th>
                <th scope="col">{t('print.minutes.columns.detailLevel')}</th>
                <th scope="col">{t('print.minutes.columns.reason')}</th>
              </tr>
            </thead>
            <tbody>
              {meeting.distribution.length === 0 ? (
                <tr>
                  <td colSpan={5}>{t('print.minutes.distribution.empty')}</td>
                </tr>
              ) : (
                meeting.distribution.map((d) => (
                  <tr key={d.id}>
                    <td>{d.recipientName}</td>
                    <td>{AGENCY_LABELS[d.agency]}</td>
                    <td>{d.role}</td>
                    <td>{t('print.minutes.distribution.level', { level: DETAIL_LEVEL_LABELS[d.detailLevel], hasFields: d.fields && d.fields.length > 0 ? 'yes' : 'no', fields: d.fields?.join('; ') ?? '' })}</td>
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
          <h2>{t('print.minutes.signatures.title')}</h2>
          <p className={styles.text}>{t('print.minutes.signatures.reviewDate', { date: meeting.reviewDate ? formatDate(meeting.reviewDate) : t('print.minutes.signatures.reviewNotSet') })}</p>
          <p className={styles.text}>{t('print.minutes.signatures.minuteTaker', { name: meeting.minuteTakerName ?? t('print.minutes.signatures.takerNotRecorded'), status: minuteStatusLine(t, meeting.minute, meeting.distribution.length) })}</p>
          <div className={styles.signatures}>
            <div className={styles.signature}>
              <span className={styles.signatureLine} aria-hidden="true" />
              <span>{t('print.minutes.signatures.chair', { name: meeting.chairName })}</span>
            </div>
            <div className={styles.signature}>
              <span className={styles.signatureLine} aria-hidden="true" />
              <span>{t('print.minutes.signatures.date')}</span>
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
  const recordDeadline =
    recordRule && recordTrigger
      ? t('print.minutes.cover.recordDueDate', { date: formatDate(localDateOf(dueDateFor(recordRule, recordTrigger.triggeredAt, { bankHolidays: config.bankHolidays, councilHolidays: config.councilHolidays }))) })
      : recordRule && process.clocks.some((c) => c.ruleId === 'cp.cppm.record.distribute' && c.completedAt)
        ? t('print.minutes.cover.recordDistributed')
        : null;

  const head = (page: number) => (
    <div className={styles.head}>
      <span>{t('print.common.runningHead', { classification: marking.label, reference: process.reference })}</span>
      <span>{t('print.minutes.head.title', { title: meeting.title })}</span>
      <span>{t('print.common.page', { page, total: totalPages })}</span>
    </div>
  );
  const foot = (
    <div className={styles.foot}>
      <span>{t('print.common.printedFooter', { when: formatDateTime(now) })}</span>
      <span>{marking.label}</span>
    </div>
  );

  return (
    <div className={`${styles.pack} print-pack`} data-minute={meeting.minute.status}>
      <div className={`${styles.controls} no-print`}>
        <Button variant="secondary" icon={<ArrowLeft size={16} aria-hidden="true" />} onClick={() => navigate(back)}>
          {t('print.minutes.controls.back')}
        </Button>
        <Button variant="primary" size="lg" icon={<Printer size={16} aria-hidden="true" />} onClick={() => window.print()}>
          {t('print.common.print')}
        </Button>
      </div>
      <ClassificationBanner level={process.classification} />
      {pages.map((page, i) => (
        <section key={i} className={`${styles.page} print-page`}>
          {head(i + 1)}
          {i === 0 ? (
            <>
              <p className={styles.kicker}>{t('print.minutes.cover.kicker')}</p>
              <h1 className={styles.title}>{meeting.title}</h1>
              <dl className={styles.meta}>
                <div className={styles.metaRow}>
                  <dt>{t('print.minutes.cover.type')}</dt>
                  <dd>{MEETING_TYPE_LABELS[meeting.type]}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt>{t('print.minutes.cover.dateTime')}</dt>
                  <dd>{t('print.minutes.cover.when', { date: formatDate(meeting.scheduledAt), start: formatTime(meeting.scheduledAt), hasEnd: meeting.endsAt ? 'yes' : 'no', end: meeting.endsAt ? formatTime(meeting.endsAt) : '' })}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt>{t('print.minutes.cover.location')}</dt>
                  <dd>{meeting.location}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt>{t('print.minutes.cover.chair')}</dt>
                  <dd>{meeting.chairName}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt>{t('print.minutes.cover.minuteTaker')}</dt>
                  <dd>{meeting.minuteTakerName ?? t('print.minutes.cover.notRecorded')}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt>{t('print.minutes.cover.subjects', { count: subjects.length })}</dt>
                  <dd>
                    {subjects.length === 0
                      ? t('print.minutes.cover.notRecorded')
                      : subjects.map((s) => (
                          <span key={s.id} className={styles.subject}>
                            {t('print.minutes.cover.subjectBorn', { name: fullName(s), date: s.dateOfBirth ? formatDate(s.dateOfBirth) : t('common.values.dateNotRecorded') })}
                          </span>
                        ))}
                  </dd>
                </div>
                <div className={styles.metaRow}>
                  <dt>{t('print.minutes.cover.process')}</dt>
                  <dd>{t('print.minutes.cover.processLine', { reference: process.reference, title: process.title, process: PROCESS_LABELS[process.type], stage: process.stage })}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt>{t('print.minutes.cover.minuteStatus')}</dt>
                  <dd>{minuteStatusLine(t, meeting.minute, meeting.distribution.length)}</dd>
                  {recordDeadline ? (
                    <>
                      <dt>{t('print.minutes.cover.recordDue')}</dt>
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
