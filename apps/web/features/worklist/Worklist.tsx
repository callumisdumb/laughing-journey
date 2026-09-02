'use client';

import { MEETING_TYPE_LABELS, PROCESS_SHORT, formatDate, relativeDays, type Process, type User } from '@mas/domain';
import { Button, CheckboxField, ClockNumeral, ProcessMark, Table, TableWrap, useToast } from '@mas/ui';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { CalendarDays, FileText, Inbox, ListChecks, Search } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { meetingPath, processPath } from '@/lib/routes';
import { useSelection, type Selection } from '@/lib/selection';
import { actionsForUser, clocksForUser, fullName, inboxForUser, meetingsForUser, personById, preMeetingRequestsForUser, researchRequestsForUser } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useNow } from '@/lib/store';
import styles from './Worklist.module.css';

type View = 'mine' | 'team' | 'overdue' | 'process' | 'clocks';

interface Item {
  key: string;
  kind: 'inbox' | 'research' | 'report' | 'action' | 'meeting';
  href: string;
  icon: ReactNode;
  title: string;
  meta: string;
  due?: string;
  days?: number;
  owner: string;
  process?: Process;
  selection?: Selection;
}

function itemsFor(data: ReturnType<typeof useData>, user: User, now: Date): Item[] {
  const out: Item[] = [];
  const owner = `${user.givenName} ${user.familyName}`;
  for (const c of inboxForUser(data, user)) {
    const subject = personById(data, c.subjectId);
    out.push({ key: c.id, kind: 'inbox', href: `/inbox?event=${c.id}`, icon: <Inbox size={16} aria-hidden="true" />, title: c.mapped.title, meta: `${c.connectorId} event for ${subject ? fullName(subject) : c.subjectId}. Received ${formatDate(c.receivedAt)}.`, owner, selection: { kind: 'person', id: c.subjectId } });
  }
  for (const { process, request } of researchRequestsForUser(data, user)) {
    const subject = personById(data, process.subjectIds[0]);
    out.push({ key: request.id, kind: 'research', href: processPath(process.id), icon: <Search size={16} aria-hidden="true" />, title: `MARAC research return: ${subject ? fullName(subject) : process.reference}`, meta: 'Search your records for the victim, perpetrator and children.', due: request.dueAt, days: differenceInCalendarDays(parseISO(request.dueAt), now), owner, process, selection: { kind: 'process', id: process.id } });
  }
  for (const { meeting, request } of preMeetingRequestsForUser(data, user)) {
    const process = data.processes.find((p) => p.id === meeting.processId);
    out.push({ key: request.id, kind: 'report', href: meetingPath(meeting.id), icon: <FileText size={16} aria-hidden="true" />, title: `Report for ${meeting.title}`, meta: `${MEETING_TYPE_LABELS[meeting.type]} on ${formatDate(meeting.scheduledAt)}.`, due: request.dueAt, days: differenceInCalendarDays(parseISO(request.dueAt), now), owner, process, selection: process ? { kind: 'process', id: process.id } : undefined });
  }
  for (const a of actionsForUser(data, user)) {
    const process = data.processes.find((p) => p.id === a.processId);
    const subject = process ? personById(data, process.subjectIds[0]) : undefined;
    out.push({ key: a.id, kind: 'action', href: `/actions?action=${a.id}`, icon: <ListChecks size={16} aria-hidden="true" />, title: a.title, meta: `${process ? PROCESS_SHORT[process.type] : ''}${subject ? `: ${fullName(subject)}` : ''}.`, due: a.due, days: differenceInCalendarDays(parseISO(a.due), now), owner: a.ownerName, process, selection: process ? { kind: 'process', id: process.id } : undefined });
  }
  for (const m of meetingsForUser(data, user)) {
    const days = differenceInCalendarDays(parseISO(m.scheduledAt), now);
    if (m.status !== 'scheduled' || days < 0 || days > 14) continue;
    const process = data.processes.find((p) => p.id === m.processId);
    out.push({ key: m.id, kind: 'meeting', href: meetingPath(m.id), icon: <CalendarDays size={16} aria-hidden="true" />, title: `Prepare for ${m.title}`, meta: `${MEETING_TYPE_LABELS[m.type]}, ${m.location}.`, due: m.scheduledAt.slice(0, 10), days, owner, process, selection: process ? { kind: 'process', id: process.id } : undefined });
  }
  return out.sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
}

const KIND_LABEL: Record<Item['kind'], string> = { inbox: 'Inbox', research: 'Research', report: 'Report', action: 'Action', meeting: 'Meeting' };

export function Worklist() {
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const now = useNow();
  const route = useRoute();
  const navigate = useNavigate();
  const select = useSelection((s) => s.select);
  const upsert = useAppStore((s) => s.upsert);
  const { toast } = useToast();
  const dev = useDevState();
  const view = (route.query.get('view') as View | null) ?? 'mine';
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    select(null);
  }, [select]);

  const items = useMemo(() => {
    if (!user) return [];
    if (view === 'team') {
      const team = data.users.filter((u) => u.teamId === user.teamId);
      const seen = new Set<string>();
      return team.flatMap((u) => itemsFor(data, u, now)).filter((i) => (seen.has(i.key) ? false : (seen.add(i.key), true)));
    }
    const mine = itemsFor(data, user, now);
    if (view === 'overdue') return mine.filter((i) => (i.days ?? 1) < 0);
    return mine;
  }, [data, user, now, view]);

  const clocks = user ? clocksForUser(data, config, user, now) : [];

  if (!user) return null;

  function setView(v: View) {
    navigate(`/worklist${setQuery(route.query, { view: v === 'mine' ? null : v })}`, { replace: true });
  }

  function completeChecked() {
    let n = 0;
    for (const key of checked) {
      const a = data.actions.find((x) => x.id === key);
      if (a) {
        upsert('actions', { ...a, status: 'complete', completedAt: now.toISOString(), evidence: a.evidence ?? 'Marked complete from the worklist' });
        n += 1;
      }
    }
    setChecked(new Set());
    toast({ title: n === 0 ? 'Nothing to complete' : `${n} ${n === 1 ? 'action' : 'actions'} marked complete`, text: n === 0 ? 'Only actions can be completed in bulk. Inbox events and reports are handled on their own screens.' : 'Evidence of completion can be added from the Actions register.', tone: n === 0 ? 'info' : 'success' });
  }

  const state = dev ?? (view === 'clocks' ? (clocks.length === 0 ? 'empty' : 'ready') : items.length === 0 ? 'empty' : 'ready');

  const groups = view === 'process' ? [...new Map(items.map((i) => [i.process?.id ?? 'none', i.process])).entries()] : null;

  const renderRows = (list: Item[]) =>
    list.map((it) => (
      <tr key={it.key} data-interactive="true" data-state={checked.has(it.key) ? 'selected' : undefined} onMouseEnter={() => it.selection && select(it.selection)} onFocus={() => it.selection && select(it.selection)} onClick={() => navigate(it.href)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigate(it.href)}>
        <td onClick={(e) => e.stopPropagation()}>
          {it.kind === 'action' ? (
            <CheckboxField
              label={<span className="visually-hidden">Select {it.title}</span>}
              checked={checked.has(it.key)}
              onChange={(e) => {
                const next = new Set(checked);
                if (e.target.checked) next.add(it.key);
                else next.delete(it.key);
                setChecked(next);
              }}
            />
          ) : null}
        </td>
        <td>
          <span className={styles.kind}>
            {it.icon} {KIND_LABEL[it.kind]}
          </span>
        </td>
        <td>
          <AppLink href={it.href} className={styles.title} onClick={(e) => e.stopPropagation()}>
            {it.title}
          </AppLink>
          <span className={styles.meta}>{it.meta}</span>
        </td>
        <td>{it.process ? <ProcessMark type={it.process.type} /> : null}</td>
        <td>{it.owner}</td>
        <td data-align="num" className={styles.due}>
          {it.due ? formatDate(it.due) : ''}
          {it.days !== undefined ? (
            <span className={`${styles.meta} ${styles.when}`} data-tone={it.days < 0 ? 'critical' : undefined}>
              {relativeDays(it.days)}
            </span>
          ) : null}
        </td>
      </tr>
    ));

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>Worklist</h1>
          <p className="page-lede">Everything waiting on you, your team, or a clock. Hover or focus a row to see who is involved in the panel.</p>
        </div>
      </div>
      <div className={styles.views} role="group" aria-label="Saved views">
        {(
          [
            ['mine', 'Mine'],
            ['team', 'Team'],
            ['overdue', 'Overdue'],
            ['process', 'By process'],
            ['clocks', 'Clocks'],
          ] as Array<[View, string]>
        ).map(([v, label]) => (
          <button key={v} type="button" className={styles.view} aria-pressed={view === v} onClick={() => setView(v)}>
            {label}
          </button>
        ))}
      </div>
      <ScreenState state={state} empty={{ title: view === 'overdue' ? 'Nothing overdue' : view === 'clocks' ? 'No clocks running' : 'Nothing waiting', text: view === 'overdue' ? 'Every action, return and report on your cases is on time.' : 'When a connector event, research request, report or action needs you, it appears here.' }}>
        {view === 'clocks' ? (
          <div className="stack">
            {clocks.map((c) => (
              <AppLink key={c.triggerId} href={processPath(c.process.id)} style={{ textDecoration: 'none', color: 'inherit' }}>
                <ClockNumeral daysRemaining={c.daysRemaining} band={c.band} status={c.status} label={`${c.subjectName}: ${c.label}`} sub={`Due ${formatDate(c.dueAt)}. ${c.sourceRef}`} size="sm" />
              </AppLink>
            ))}
          </div>
        ) : (
          <>
            <div className={styles.bulk}>
              <span>{checked.size} selected</span>
              <Button size="sm" variant="secondary" disabled={checked.size === 0} onClick={completeChecked}>
                Mark complete
              </Button>
              <Button size="sm" variant="quiet" disabled={checked.size === 0} onClick={() => setChecked(new Set())}>
                Clear
              </Button>
            </div>
            {groups ? (
              groups.map(([pid, process]) => (
                <div key={pid}>
                  <h2 className={styles.group}>{process ? `${process.reference}: ${process.title}` : 'Not linked to a process'}</h2>
                  <TableWrap>
                    <Table>
                      <thead>
                        <tr>
                          <th scope="col">
                            <span className="visually-hidden">Select</span>
                          </th>
                          <th scope="col">Kind</th>
                          <th scope="col">Item</th>
                          <th scope="col">Process</th>
                          <th scope="col">Owner</th>
                          <th scope="col" data-align="num">
                            Due
                          </th>
                        </tr>
                      </thead>
                      <tbody>{renderRows(items.filter((i) => (i.process?.id ?? 'none') === pid))}</tbody>
                    </Table>
                  </TableWrap>
                </div>
              ))
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">
                        <span className="visually-hidden">Select</span>
                      </th>
                      <th scope="col">Kind</th>
                      <th scope="col">Item</th>
                      <th scope="col">Process</th>
                      <th scope="col">Owner</th>
                      <th scope="col" data-align="num">
                        Due
                      </th>
                    </tr>
                  </thead>
                  <tbody>{renderRows(items)}</tbody>
                </Table>
              </TableWrap>
            )}
          </>
        )}
      </ScreenState>
    </div>
  );
}
