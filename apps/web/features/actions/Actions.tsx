'use client';

import { actionStatusLabel, agencyShort, formatDate, formatDateTime, processShort, relativeDays, type Action } from '@mas/domain';
import { useT, type RichValues } from '@mas/messages';
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

/** Renders the <link> tag of a catalogue message as a link to the given path. */
const linkTo = (href: string): RichValues => ({ link: (chunks) => <AppLink href={href}>{chunks}</AppLink> });

export function Actions() {
  const t = useT();
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

  const groups = groupBy === 'none' ? [['all', rows] as const] : groupBy === 'process' ? [...new Map(rows.map((r) => [r.process!.id, r.process!])).entries()].map(([id, p]) => [`${p.reference}: ${p.title}`, rows.filter((r) => r.process!.id === id)] as const) : [...new Set(rows.map((r) => r.action.ownerAgency))].map((ag) => [agencyShort(ag), rows.filter((r) => r.action.ownerAgency === ag)] as const);

  function set(key: string, value: string | null) {
    navigate(`/actions${setQuery(route.query, { [key]: value })}`, { replace: true });
  }

  function complete() {
    if (!completing) return;
    upsert('actions', { ...completing, status: 'complete', completedAt: now.toISOString(), evidence });
    audit({ act: 'edit', targetType: 'process', targetId: completing.processId, targetLabel: t('actions.audit.complete', { title: completing.title }), processId: completing.processId });
    toast({ title: t('actions.completeDialog.toastTitle'), text: t('actions.completeDialog.toastText'), tone: 'success' });
    setCompleting(null);
    setEvidence('');
  }

  function escalate() {
    if (!escalating) return;
    upsert('actions', { ...escalating, escalatedAt: now.toISOString(), escalatedToName: escalateTo });
    audit({ act: 'edit', targetType: 'process', targetId: escalating.processId, targetLabel: t('actions.audit.escalated', { name: escalateTo, title: escalating.title }), processId: escalating.processId });
    toast({ title: t('actions.escalateDialog.toastTitle', { name: escalateTo }), text: t('actions.escalateDialog.toastText'), tone: 'info' });
    setEscalating(null);
    setEscalateTo('');
  }

  const overdueCount = rows.filter((r) => r.action.status !== 'complete' && r.action.status !== 'cancelled' && r.action.due < today).length;

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>{t('actions.list.title')}</h1>
          <p className="page-lede">{t('actions.list.lede', { count: overdueCount })}</p>
        </div>
      </div>
      <div className={styles.toolbar}>
        <div className={styles.views} role="group" aria-label={t('actions.list.viewsLabel')}>
          {(
            [
              ['mine', t('actions.views.mine')],
              ['team', t('actions.views.team')],
              ['all', t('actions.views.all')],
            ] as Array<[View, string]>
          ).map(([v, label]) => (
            <button key={v} type="button" className={styles.view} aria-pressed={view === v} onClick={() => set('view', v === 'mine' ? null : v)}>
              {label}
            </button>
          ))}
        </div>
        <SelectField label={t('actions.list.filters.status')} value={status} onChange={(e) => set('status', e.target.value === 'open' ? null : e.target.value)} options={[{ value: 'open', label: t('actions.list.statusOptions.open') }, { value: 'overdue', label: t('actions.list.statusOptions.overdue') }, { value: 'complete', label: t('actions.list.statusOptions.complete') }, { value: 'any', label: t('actions.list.statusOptions.any') }]} />
        <SelectField label={t('actions.list.filters.groupBy')} value={groupBy} onChange={(e) => set('group', e.target.value === 'process' ? null : e.target.value)} options={[{ value: 'process', label: t('actions.list.groupOptions.process') }, { value: 'agency', label: t('actions.list.groupOptions.agency') }, { value: 'none', label: t('actions.list.groupOptions.none') }]} />
      </div>
      <ScreenState state={dev ?? (rows.length === 0 ? 'empty' : 'ready')} empty={{ title: t('actions.list.empty.title'), text: view === 'mine' ? t('actions.list.empty.mineText') : t('actions.list.empty.text') }}>
        {groups.map(([label, list]) => (
          <div key={label}>
            {groupBy !== 'none' ? <h2 className={styles.group}>{label}</h2> : null}
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <th scope="col">{t('actions.list.columns.action')}</th>
                    <th scope="col">{t('actions.list.columns.owner')}</th>
                    <th scope="col">{t('actions.list.columns.due')}</th>
                    <th scope="col">{t('actions.list.columns.status')}</th>
                    <th scope="col">{t('actions.list.columns.evidence')}</th>
                    <th scope="col">
                      <span className="visually-hidden">{t('common.columns.actions')}</span>
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
                            {a.meetingId ? <> {t.rich('actions.list.fromMeeting', { ...linkTo(meetingPath(a.meetingId)), title: data.meetings.find((m) => m.id === a.meetingId)?.title ?? t('actions.list.meetingFallback') })}</> : ''}
                            {a.escalatedAt ? <> {t('actions.list.escalatedNote', { name: a.escalatedToName ?? '', date: formatDate(a.escalatedAt) })}</> : ''}
                          </span>
                        </td>
                        <td>
                          <AgencyMark agency={a.ownerAgency} hideLabel /> {a.ownerName}
                        </td>
                        <td className={overdue ? styles.overdue : undefined} style={{ whiteSpace: 'nowrap' }}>
                          {formatDate(a.due)}
                          <span className={styles.meta}>{a.status === 'complete' ? t('actions.list.done', { when: a.completedAt ? formatDateTime(a.completedAt) : '' }) : relativeDays(days)}</span>
                        </td>
                        <td>
                          <Pill size="sm" tone={a.status === 'complete' ? 'low' : overdue ? 'critical' : a.status === 'in-progress' ? 'accent' : 'neutral'}>
                            {overdue ? t('actions.list.overdue') : actionStatusLabel(a.status)}
                          </Pill>
                        </td>
                        <td>{a.evidence ?? ''}</td>
                        <td>
                          {a.status !== 'complete' && a.status !== 'cancelled' ? (
                            <span className={styles.rowActions}>
                              <Button size="sm" variant="secondary" onClick={() => setCompleting(a)}>
                                {t('actions.list.complete')}
                              </Button>
                              {overdue && !a.escalatedAt ? (
                                <Button size="sm" variant="quiet" onClick={() => setEscalating(a)}>
                                  {t('actions.list.escalate')}
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

      <Dialog
        open={completing !== null}
        onClose={() => setCompleting(null)}
        title={t('actions.completeDialog.title')}
        actions={
          <>
            <Button variant="quiet" onClick={() => setCompleting(null)}>
              {t('common.actions.cancel')}
            </Button>
            <Button variant="primary" disabled={evidence.trim().length < 5} onClick={complete}>
              {t('actions.completeDialog.confirm')}
            </Button>
          </>
        }
      >
        <p style={{ marginBottom: 10 }}>{completing?.title}</p>
        <TextareaField label={t('actions.completeDialog.evidence')} required value={evidence} onChange={(e) => setEvidence(e.target.value)} hint={t('actions.completeDialog.evidenceHint')} />
      </Dialog>
      <Dialog
        open={escalating !== null}
        onClose={() => setEscalating(null)}
        title={t('actions.escalateDialog.title')}
        actions={
          <>
            <Button variant="quiet" onClick={() => setEscalating(null)}>
              {t('common.actions.cancel')}
            </Button>
            <Button variant="danger" disabled={escalateTo.trim().length < 3} onClick={escalate}>
              {t('actions.escalateDialog.confirm')}
            </Button>
          </>
        }
      >
        <p style={{ marginBottom: 10 }}>{escalating?.title}</p>
        <TextField label={t('actions.escalateDialog.to')} required value={escalateTo} onChange={(e) => setEscalateTo(e.target.value)} placeholder={t('actions.escalateDialog.toPlaceholder')} hint={escalating ? t('actions.escalateDialog.toHint', { process: processShort(data.processes.find((p) => p.id === escalating.processId)?.type ?? 'cp'), owner: escalating.ownerName }) : undefined} />
      </Dialog>
    </div>
  );
}
