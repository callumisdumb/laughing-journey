'use client';

import { MEETING_TYPE_LABELS, PROCESS_SHORT, ROLE_DEFINITIONS, formatDate, formatTime, localDateOf, relativeDays } from '@mas/domain';
import { useT, type Translator } from '@mas/messages';
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

function greetingFor(t: Translator, now: Date, name: string): string {
  const h = now.getHours();
  if (h < 12) return t('home.greeting.morning', { name });
  if (h < 18) return t('home.greeting.afternoon', { name });
  return t('home.greeting.evening', { name });
}

export function Home() {
  const t = useT();
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
    items.push({ key: c.id, href: `/inbox?event=${c.id}`, icon: <Inbox size={18} aria-hidden="true" />, title: t('home.items.reviewEvent', { connector: c.connectorId, title: c.mapped.title }), meta: subject ? t('home.items.received', { name: fullName(subject), date: formatDate(c.receivedAt) }) : formatDate(c.receivedAt), when: t('home.items.inbox'), sort: 1 });
  }
  for (const { process, request } of researchRequestsForUser(data, user)) {
    const subject = personById(data, process.subjectIds[0]);
    const days = differenceInCalendarDays(parseISO(request.dueAt), now);
    items.push({ key: request.id, href: processPath(process.id), icon: <Search size={18} aria-hidden="true" />, title: t('home.items.researchReturn', { subject: subject ? fullName(subject) : process.reference }), meta: t('home.items.researchMeta', { date: formatDate(request.dueAt) }), when: relativeDays(days), tone: days < 0 ? 'critical' : undefined, sort: days < 0 ? 0 : 2 });
  }
  for (const { meeting, request } of preMeetingRequestsForUser(data, user)) {
    const days = differenceInCalendarDays(parseISO(request.dueAt), now);
    items.push({ key: request.id, href: meetingPath(meeting.id), icon: <FileText size={18} aria-hidden="true" />, title: t('home.items.reportFor', { meeting: meeting.title }), meta: t('home.items.reportMeta', { sent: formatDate(request.sentAt), due: formatDate(request.dueAt) }), when: relativeDays(days), tone: days < 0 ? 'critical' : undefined, sort: days < 0 ? 0 : 3 });
  }
  for (const a of actionsForUser(data, user)) {
    const days = differenceInCalendarDays(parseISO(a.due), now);
    if (days > 14) continue;
    const process = data.processes.find((p) => p.id === a.processId);
    const subject = process ? personById(data, process.subjectIds[0]) : undefined;
    const context = process ? (subject ? t('home.items.processSubject', { process: PROCESS_SHORT[process.type], subject: fullName(subject) }) : PROCESS_SHORT[process.type]) : '';
    items.push({ key: a.id, href: `/actions?action=${a.id}`, icon: <ListChecks size={18} aria-hidden="true" />, title: a.title, meta: t('home.items.actionMeta', { context, date: formatDate(a.due) }), when: relativeDays(days), tone: days < 0 ? 'critical' : undefined, sort: days < 0 ? 0 : 4 });
  }
  const upcoming = meetingsForUser(data, user).filter((m) => m.status === 'scheduled' && differenceInCalendarDays(parseISO(m.scheduledAt), now) >= 0);
  for (const m of upcoming) {
    const days = differenceInCalendarDays(parseISO(m.scheduledAt), now);
    if (days > 7 || days === 0) continue;
    items.push({ key: m.id, href: meetingPath(m.id), icon: <CalendarDays size={18} aria-hidden="true" />, title: t('home.items.prepareFor', { meeting: m.title }), meta: t('home.items.meetingMeta', { type: MEETING_TYPE_LABELS[m.type], date: formatDate(m.scheduledAt), time: formatTime(m.scheduledAt), location: m.location }), when: relativeDays(days), sort: 5 });
  }
  items.sort((a, b) => a.sort - b.sort);

  const todays = upcoming.filter((m) => localDateOf(m.scheduledAt) === today);
  const visitsToday = actionsForUser(data, user).filter((a) => a.due === today && /visit/i.test(a.title));

  const state = dev ?? (clocks.length === 0 && items.length === 0 && todays.length === 0 ? 'empty' : 'ready');
  const nextMeeting = upcoming[0] ? t('home.today.nextMeeting', { title: upcoming[0].title, date: formatDate(upcoming[0].scheduledAt) }) : t('home.today.noNext');

  return (
    <div className="page">
      <div className={styles.layout}>
        <div className={styles.greeting}>
          <h1>{greetingFor(t, now, user.givenName)}</h1>
          <span className={styles.greetingRole}>{t('home.greeting.role', { role: ROLE_DEFINITIONS[user.roleId].label, date: formatDate(now) })}</span>
        </div>
        <ScreenState state={state} empty={{ title: t('home.empty.title'), text: t('home.empty.text') }}>
          <section className={styles.region} aria-labelledby="home-clocks">
            <h2 className={styles.regionTitle} id="home-clocks">
              {t('home.clocks.title')} <span className={styles.regionCount}>{t('home.clocks.count', { count: clocks.length })}</span>
            </h2>
            <div className={styles.clockList}>
              {clocks.length === 0 ? <p className={styles.quiet}>{t('home.clocks.empty')}</p> : null}
              {clocks.map((c) => (
                <AppLink key={c.triggerId} href={processPath(c.process.id)} className={styles.clockItem}>
                  <ClockNumeral daysRemaining={c.daysRemaining} band={c.band} status={c.status} label={<span><span className={styles.clockSubject}>{c.subjectName}</span>: {c.label}</span>} sub={t('home.clocks.due', { date: formatDate(c.dueAt), detail: c.overridden ? (c.overrideReason ?? '') : t('home.clocks.trigger', { process: c.ruleId.split('.')[0]?.toUpperCase() ?? '', date: formatDate(c.triggeredAt) }) })} />
                </AppLink>
              ))}
            </div>
          </section>
          <section className={styles.region} aria-labelledby="home-worklist">
            <h2 className={styles.regionTitle} id="home-worklist">
              {t('home.waiting.title')} <span className={styles.regionCount}>{t('home.waiting.count', { count: items.length })}</span>
            </h2>
            <div className={styles.workList}>
              {items.length === 0 ? <p className={styles.quiet}>{t('home.waiting.empty')}</p> : null}
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
              {t('home.today.title')} <span className={styles.regionCount}>{t('home.today.count', { count: todays.length + visitsToday.length })}</span>
            </h2>
            {todays.length === 0 && visitsToday.length === 0 ? <p className={styles.quiet}>{t('home.today.empty', { next: nextMeeting })}</p> : null}
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
                    <span className={styles.todayTime}>{t('home.today.visit')}</span>
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
