'use client';

import { AGENCY_SHORT, PROCESS_SHORT, formatDate, formatDateTime, relativeDays, type Action } from '@mas/domain';
import { AgencyMark, Button, Dialog, Pill, ProcessMark, SelectField, Table, TableWrap, TextField, TextareaField, useToast } from '@mas/ui';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useEffect, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { meetingPath, processPath } from '@/lib/routes';
import { useSelection } from '@/lib/selection';
import { accessForUser, fullName, personById } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useNow } from '@/lib/store';
import styles from './Actions.module.css';

type View = 'mine' | 'team' | 'all';
type GroupBy = 'process' | 'agency' | 'none';

export function Actions() {
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const now = useNow();
  const route = useRoute();
  const navigate = useNavigate();
  const grants = useAppStore((s) => s.session.breakGlass);
  const upsert = useAppStore((s) => s.upsert);
  const audit = useAppStore((s) => s.audit);
  const select = useSelection((s) => s.select);
  const { toast } = useToast();
  const dev = useDevState();
  const view = (route.query.get('view') as View | null) ?? 'mine';
  const groupBy = (route.query.get('group') as GroupBy | null) ?? 'process';
  const status = route.query.get('status') ?? 'open';
  const focus = route.query.get('action');
  const [completing, setCompleting] = useState<Action | null>(null);
  const [evidence, setEvidence] = useState('');
  const [escalating, setEscalating] = useState<Action | null>(null);
  const [escalateTo, setEscalateTo] = useState('');

  useEffect(() => {
    select(null);
  }, [select]);

  useEffect(() => {
    if (focus) document.getElementById(`action-${focus}`)?.scrollIntoView({ block: 'center' });
  }, [focus]);

  if (!user) return null;
  const today = now.toISOString().slice(0, 10);
  const team = data.users.filter((u) => u.teamId === user.teamId).map((u) => u.id);

  const rows = data.actions
    .map((a) => ({ action: a, process: data.processes.find((p) => p.id === a.processId) }))
    .filter(({ action: a, process }) => {
      if (!process) return false;
      const access = accessForUser(data, config, user, process, grants, now);
      const own = a.ownerUserId === user.id;
      if (!own && access.level !== 'full') return false;
      if (view === 'mine' && !own) return false;
      if (view === 'team' && !(a.ownerUserId && team.includes(a.ownerUserId))) return false;
      const overdue = a.status !== 'complete' && a.status !== 'cancelled' && a.due < today;
      if (status === 'open' && (a.status === 'complete' || a.status === 'cancelled')) return false;
      if (status === 'overdue' && !overdue) return false;
      if (status === 'complete' && a.status !== 'complete') return false;
      return true;
    })
    .sort((a, b) => (a.action.due < b.action.due ? -1 : 1));

  const groups = groupBy === 'none' ? [['all', rows] as const] : groupBy === 'process' ? [...new Map(rows.map((r) => [r.process!.id, r.process!])).entries()].map(([id, p]) => [`${p.reference}: ${p.title}`, rows.filter((r) => r.process!.id === id)] as const) : [...new Set(rows.map((r) => r.action.ownerAgency))].map((ag) => [AGENCY_SHORT[ag], rows.filter((r) => r.action.ownerAgency === ag)] as const);

  function set(key: string, value: string | null) {
    navigate(`/actions${setQuery(route.query, { [key]: value })}`, { replace: true });
  }

  function complete() {
    if (!completing) return;
    upsert('actions', { ...completing, status: 'complete', completedAt: now.toISOString(), evidence });
    audit({ act: 'edit', targetType: 'process', targetId: completing.processId, targetLabel: `Action complete: ${completing.title}`, processId: completing.processId });
    toast({ title: 'Action complete', text: 'Evidence of completion is recorded against the plan.', tone: 'success' });
    setCompleting(null);
    setEvidence('');
  }

  function escalate() {
    if (!escalating) return;
    upsert('actions', { ...escalating, escalatedAt: now.toISOString(), escalatedToName: escalateTo });
    audit({ act: 'edit', targetType: 'process', targetId: escalating.processId, targetLabel: `Action escalated to ${escalateTo}: ${escalating.title}`, processId: escalating.processId });
    toast({ title: `Escalated to ${escalateTo}`, text: 'The escalation is visible on the process and the audit log.', tone: 'info' });
    setEscalating(null);
    setEscalateTo('');
  }

  const overdueCount = rows.filter((r) => r.action.status !== 'complete' && r.action.status !== 'cancelled' && r.action.due < today).length;

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>Actions</h1>
          <p className="page-lede">Every owned, dated action across every process you can see. {overdueCount > 0 ? `${overdueCount} overdue.` : 'Nothing overdue.'}</p>
        </div>
      </div>
      <div className={styles.toolbar}>
        <div className={styles.views} role="group" aria-label="Whose actions">
          {(
            [
              ['mine', 'Mine'],
              ['team', 'My team'],
              ['all', 'All I can see'],
            ] as Array<[View, string]>
          ).map(([v, label]) => (
            <button key={v} type="button" className={styles.view} aria-pressed={view === v} onClick={() => set('view', v === 'mine' ? null : v)}>
              {label}
            </button>
          ))}
        </div>
        <SelectField label="Status" value={status} onChange={(e) => set('status', e.target.value === 'open' ? null : e.target.value)} options={[{ value: 'open', label: 'Open' }, { value: 'overdue', label: 'Overdue' }, { value: 'complete', label: 'Complete' }, { value: 'any', label: 'Any' }]} />
        <SelectField label="Group by" value={groupBy} onChange={(e) => set('group', e.target.value === 'process' ? null : e.target.value)} options={[{ value: 'process', label: 'Process' }, { value: 'agency', label: 'Agency' }, { value: 'none', label: 'No grouping' }]} />
      </div>
      <ScreenState state={dev ?? (rows.length === 0 ? 'empty' : 'ready')} empty={{ title: 'No actions', text: view === 'mine' ? 'Nothing is assigned to you with this status.' : 'No actions match.' }}>
        {groups.map(([label, list]) => (
          <div key={label}>
            {groupBy !== 'none' ? <h2 className={styles.group}>{label}</h2> : null}
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <th scope="col">Action</th>
                    <th scope="col">Owner</th>
                    <th scope="col">Due</th>
                    <th scope="col">Status</th>
                    <th scope="col">Evidence</th>
                    <th scope="col">
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(({ action: a, process }) => {
                    const days = differenceInCalendarDays(parseISO(a.due), now);
                    const overdue = a.status !== 'complete' && a.status !== 'cancelled' && days < 0;
                    const subject = process ? personById(data, process.subjectIds[0]) : undefined;
                    return (
                      <tr key={a.id} id={`action-${a.id}`} data-state={focus === a.id ? 'selected' : undefined} onMouseEnter={() => select({ kind: 'action', id: a.id })}>
                        <td>
                          <span className={styles.title}>{a.title}</span>
                          <span className={styles.meta}>
                            {process ? <AppLink href={processPath(process.id)}><ProcessMark type={process.type} /></AppLink> : null} {subject ? fullName(subject) : ''}
                            {a.meetingId ? <> from <AppLink href={meetingPath(a.meetingId)}>{data.meetings.find((m) => m.id === a.meetingId)?.title ?? 'meeting'}</AppLink></> : ''}
                            {a.escalatedAt ? ` Escalated to ${a.escalatedToName} on ${formatDate(a.escalatedAt)}.` : ''}
                          </span>
                        </td>
                        <td>
                          <AgencyMark agency={a.ownerAgency} hideLabel /> {a.ownerName}
                        </td>
                        <td className={overdue ? styles.overdue : undefined} style={{ whiteSpace: 'nowrap' }}>
                          {formatDate(a.due)}
                          <span className={styles.meta}>{a.status === 'complete' ? `done ${a.completedAt ? formatDateTime(a.completedAt) : ''}` : relativeDays(days)}</span>
                        </td>
                        <td>
                          <Pill size="sm" tone={a.status === 'complete' ? 'low' : overdue ? 'critical' : a.status === 'in-progress' ? 'accent' : 'neutral'}>
                            {overdue ? 'overdue' : a.status.replace('-', ' ')}
                          </Pill>
                        </td>
                        <td>{a.evidence ?? ''}</td>
                        <td>
                          {a.status !== 'complete' && a.status !== 'cancelled' ? (
                            <span className={styles.rowActions}>
                              <Button size="sm" variant="secondary" onClick={() => setCompleting(a)}>
                                Complete
                              </Button>
                              {overdue && !a.escalatedAt ? (
                                <Button size="sm" variant="quiet" onClick={() => setEscalating(a)}>
                                  Escalate
                                </Button>
                              ) : null}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          </div>
        ))}
      </ScreenState>

      <Dialog open={completing !== null} onClose={() => setCompleting(null)} title="Record completion" actions={<><Button variant="quiet" onClick={() => setCompleting(null)}>Cancel</Button><Button variant="primary" disabled={evidence.trim().length < 5} onClick={complete}>Mark complete</Button></>}>
        <p style={{ marginBottom: 10 }}>{completing?.title}</p>
        <TextareaField label="Evidence of completion" required value={evidence} onChange={(e) => setEvidence(e.target.value)} hint="What was done, when, and how you know. Inspectors read this." />
      </Dialog>
      <Dialog open={escalating !== null} onClose={() => setEscalating(null)} title="Escalate an overdue action" actions={<><Button variant="quiet" onClick={() => setEscalating(null)}>Cancel</Button><Button variant="danger" disabled={escalateTo.trim().length < 3} onClick={escalate}>Escalate</Button></>}>
        <p style={{ marginBottom: 10 }}>{escalating?.title}</p>
        <TextField label="Escalate to" required value={escalateTo} onChange={(e) => setEscalateTo(e.target.value)} placeholder="Team leader or chair by name" hint={escalating ? `${PROCESS_SHORT[data.processes.find((p) => p.id === escalating.processId)?.type ?? 'cp']} action owned by ${escalating.ownerName}.` : undefined} />
      </Dialog>
    </div>
  );
}
