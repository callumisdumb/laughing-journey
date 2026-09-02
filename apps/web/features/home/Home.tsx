'use client';

import { MEETING_TYPE_LABELS, PROCESS_SHORT, ROLE_DEFINITIONS, formatDate, formatTime, localDateOf, relativeDays } from '@mas/domain';
import { ClockNumeral } from '@mas/ui';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { CalendarDays, FileText, Inbox, ListChecks, Search } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { meetingPath, personPath, processPath } from '@/lib/routes';
import { useSelection } from '@/lib/selection';
import { actionsForUser, clocksForUser, fullName, inboxForUser, meetingsForUser, personById, preMeetingRequestsForUser, researchRequestsForUser } from '@/lib/selectors';
import { useConfig, useCurrentUser, useData, useNow } from '@/lib/store';
import styles from './Home.module.css';

interface WorkItem {
  key: string;
  href: string;
  icon: ReactNode;
  title: string;
  meta: string;
  when: string;
  tone?: 'critical';
  sort: number;
}

function greetingFor(now: Date): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function Home() {
  const user = useCurrentUser();
  const data = useData();
  const config = useConfig();
  const now = useNow();
  const select = useSelection((s) => s.select);
  const dev = useDevState();

  useEffect(() => {
    select(null);
  }, [select]);

  if (!user) return null;

  const clocks = clocksForUser(data, config, user, now);
  const today = localDateOf(now);
  const items: WorkItem[] = [];

  for (const c of inboxForUser(data, user)) {
    const subject = personById(data, c.subjectId);
    items.push({ key: c.id, href: `/inbox?event=${c.id}`, icon: <Inbox size={18} aria-hidden="true" />, title: `Review ${c.connectorId} event: ${c.mapped.title}`, meta: subject ? `${fullName(subject)}. Received ${formatDate(c.receivedAt)}.` : formatDate(c.receivedAt), when: 'inbox', sort: 1 });
  }
  for (const { process, request } of researchRequestsForUser(data, user)) {
    const subject = personById(data, process.subjectIds[0]);
    const days = differenceInCalendarDays(parseISO(request.dueAt), now);
    items.push({ key: request.id, href: processPath(process.id), icon: <Search size={18} aria-hidden="true" />, title: `MARAC research return: ${subject ? fullName(subject) : process.reference}`, meta: `Search your records for the victim, perpetrator and children. Due ${formatDate(request.dueAt)}.`, when: relativeDays(days), tone: days < 0 ? 'critical' : undefined, sort: days < 0 ? 0 : 2 });
  }
  for (const { meeting, request } of preMeetingRequestsForUser(data, user)) {
    const days = differenceInCalendarDays(parseISO(request.dueAt), now);
    items.push({ key: request.id, href: meetingPath(meeting.id), icon: <FileText size={18} aria-hidden="true" />, title: `Report for ${meeting.title}`, meta: `Requested ${formatDate(request.sentAt)}. Due ${formatDate(request.dueAt)}.`, when: relativeDays(days), tone: days < 0 ? 'critical' : undefined, sort: days < 0 ? 0 : 3 });
  }
  for (const a of actionsForUser(data, user)) {
    const days = differenceInCalendarDays(parseISO(a.due), now);
    if (days > 14) continue;
    const process = data.processes.find((p) => p.id === a.processId);
    const subject = process ? personById(data, process.subjectIds[0]) : undefined;
    items.push({ key: a.id, href: `/actions?action=${a.id}`, icon: <ListChecks size={18} aria-hidden="true" />, title: a.title, meta: `${process ? PROCESS_SHORT[process.type] : ''}${subject ? `: ${fullName(subject)}` : ''}. Due ${formatDate(a.due)}.`, when: relativeDays(days), tone: days < 0 ? 'critical' : undefined, sort: days < 0 ? 0 : 4 });
  }
  const upcoming = meetingsForUser(data, user).filter((m) => m.status === 'scheduled' && differenceInCalendarDays(parseISO(m.scheduledAt), now) >= 0);
  for (const m of upcoming) {
    const days = differenceInCalendarDays(parseISO(m.scheduledAt), now);
    if (days > 7 || days === 0) continue;
    items.push({ key: m.id, href: meetingPath(m.id), icon: <CalendarDays size={18} aria-hidden="true" />, title: `Prepare for ${m.title}`, meta: `${MEETING_TYPE_LABELS[m.type]}. ${formatDate(m.scheduledAt)} at ${formatTime(m.scheduledAt)}, ${m.location}.`, when: relativeDays(days), sort: 5 });
  }
  items.sort((a, b) => a.sort - b.sort);

  const todays = upcoming.filter((m) => localDateOf(m.scheduledAt) === today);
  const visitsToday = actionsForUser(data, user).filter((a) => a.due === today && /visit/i.test(a.title));

  const state = dev ?? (clocks.length === 0 && items.length === 0 && todays.length === 0 ? 'empty' : 'ready');

  return (
    <div className="page">
      <div className={styles.layout}>
        <div className={styles.greeting}>
          <h1>
            {greetingFor(now)}, {user.givenName}
          </h1>
          <span className={styles.greetingRole}>
            {ROLE_DEFINITIONS[user.roleId].label}. {formatDate(now)}.
          </span>
        </div>
        <ScreenState state={state} empty={{ title: 'Nothing waiting on you', text: 'No statutory clocks, inbox events or actions are assigned to you. Search for a person to start.' }}>
          <section className={styles.region} aria-labelledby="home-clocks">
            <h2 className={styles.regionTitle} id="home-clocks">
              Clocks <span className={styles.regionCount}>{clocks.length} running</span>
            </h2>
            <div className={styles.clockList}>
              {clocks.length === 0 ? <p className={styles.quiet}>No statutory clocks are running on your cases.</p> : null}
              {clocks.map((c) => (
                <AppLink key={c.triggerId} href={processPath(c.process.id)} className={styles.clockItem}>
                  <ClockNumeral daysRemaining={c.daysRemaining} band={c.band} status={c.status} label={<span><span className={styles.clockSubject}>{c.subjectName}</span>: {c.label}</span>} sub={`Due ${formatDate(c.dueAt)}. ${c.overridden ? c.overrideReason : `From ${c.ruleId.split('.')[0]?.toUpperCase()} trigger on ${formatDate(c.triggeredAt)}.`}`} />
                </AppLink>
              ))}
            </div>
          </section>
          <section className={styles.region} aria-labelledby="home-worklist">
            <h2 className={styles.regionTitle} id="home-worklist">
              Waiting on you <span className={styles.regionCount}>{items.length} items</span>
            </h2>
            <div className={styles.workList}>
              {items.length === 0 ? <p className={styles.quiet}>Nothing is waiting on you.</p> : null}
              {items.map((it) => (
                <AppLink key={it.key} href={it.href} className={styles.workItem}>
                  <span className={styles.workIcon} data-tone={it.tone}>
                    {it.icon}
                  </span>
                  <span className={styles.workTitle}>{it.title}</span>
                  <span className={styles.workWhen} data-tone={it.tone}>
                    {it.when}
                  </span>
                  <span className={styles.workMeta}>{it.meta}</span>
                </AppLink>
              ))}
            </div>
          </section>
          <section className={`${styles.region} ${styles.today}`} aria-labelledby="home-today">
            <h2 className={styles.regionTitle} id="home-today">
              Today <span className={styles.regionCount}>{todays.length + visitsToday.length} scheduled</span>
            </h2>
            {todays.length === 0 && visitsToday.length === 0 ? <p className={styles.quiet}>No meetings or visits today. The next meeting is {upcoming[0] ? `${upcoming[0].title} on ${formatDate(upcoming[0].scheduledAt)}` : 'not yet scheduled'}.</p> : null}
            <div className={styles.todayList}>
              {todays.map((m) => (
                <AppLink key={m.id} href={meetingPath(m.id)} className={styles.todayItem}>
                  <span className={styles.todayTime}>{formatTime(m.scheduledAt)}</span>
                  <span className={styles.todayTitle}>{m.title}</span>
                  <span className={styles.todayMeta}>{m.location}</span>
                </AppLink>
              ))}
              {visitsToday.map((a) => {
                const process = data.processes.find((p) => p.id === a.processId);
                const subject = process ? personById(data, process.subjectIds[0]) : undefined;
                return (
                  <AppLink key={a.id} href={subject ? personPath(subject.id) : '/actions'} className={styles.todayItem}>
                    <span className={styles.todayTime}>Visit</span>
                    <span className={styles.todayTitle}>{subject ? fullName(subject) : a.title}</span>
                    <span className={styles.todayMeta}>{a.title}</span>
                  </AppLink>
                );
              })}
            </div>
          </section>
        </ScreenState>
      </div>
    </div>
  );
}
