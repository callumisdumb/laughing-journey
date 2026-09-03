'use client';

import { AGENCIES, AGENCY_LABELS, AUDIT_ACTS, ROLE_DEFINITIONS, formatDateTime, formatTime, localDateOf, type AuditAct, type AuditEntry, type Dataset } from '@mas/domain';
import { AgencyMark, Button, DateField, Pill, SelectField, Switch, Table, TableWrap, TextField, useToast, type PillTone } from '@mas/ui';
import { Download, Lock, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { chronologyPath, meetingPath, personPath, processPath } from '@/lib/routes';
import { useSelection, type Selection } from '@/lib/selection';
import { useAppStore, useCurrentUser, useData, useNow } from '@/lib/store';
import styles from './Audit.module.css';

const ACT_LABELS: Record<AuditAct, string> = {
  read: 'Read',
  'read-restricted': 'Restricted read',
  share: 'Share',
  'break-glass': 'Break-glass',
  'persona-switch': 'Persona switch',
  export: 'Export',
  edit: 'Edit',
  promote: 'Promote',
  'sign-in': 'Sign in',
};

const ACT_TONES: Record<AuditAct, PillTone> = {
  read: 'neutral',
  'read-restricted': 'restricted',
  share: 'accent',
  'break-glass': 'critical',
  'persona-switch': 'medium',
  export: 'high',
  edit: 'outline',
  promote: 'accent',
  'sign-in': 'low',
};

const TARGET_LABELS: Record<AuditEntry['targetType'], string> = {
  person: 'Person',
  process: 'Process',
  event: 'Chronology event',
  meeting: 'Meeting',
  sharing: 'Share',
  report: 'Report',
  config: 'Configuration',
  session: 'Session',
  inbox: 'Connector inbox',
};

function targetHref(data: Dataset, a: AuditEntry): string | undefined {
  switch (a.targetType) {
    case 'person':
      return personPath(a.targetId);
    case 'process':
      return processPath(a.targetId);
    case 'meeting':
      return meetingPath(a.targetId);
    case 'event': {
      const ev = data.events.find((e) => e.id === a.targetId);
      const subject = ev?.subjectIds[0];
      return subject ? chronologyPath(subject) : a.processId ? processPath(a.processId) : undefined;
    }
    case 'sharing':
      return '/sharing';
    case 'inbox':
      return a.targetId.startsWith('cev') ? `/inbox?event=${a.targetId}` : '/inbox';
    case 'report':
      return '/reports';
    case 'config':
      return '/admin';
    default:
      return undefined;
  }
}

function selectionFor(a: AuditEntry): Selection | undefined {
  if (a.targetType === 'person') return { kind: 'person', id: a.targetId };
  if (a.targetType === 'process') return { kind: 'process', id: a.targetId };
  if (a.targetType === 'meeting') return { kind: 'meeting', id: a.targetId };
  if (a.targetType === 'event') return { kind: 'event', id: a.targetId };
  if (a.processId) return { kind: 'process', id: a.processId };
  return undefined;
}

function csvCell(value: string | undefined): string {
  const s = value ?? '';
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function Audit() {
  const data = useData();
  const user = useCurrentUser();
  const now = useNow();
  const route = useRoute();
  const navigate = useNavigate();
  const audit = useAppStore((s) => s.audit);
  const select = useSelection((s) => s.select);
  const { toast } = useToast();
  const dev = useDevState();
  const [text, setText] = useState('');

  useEffect(() => {
    select(null);
  }, [select]);

  if (!user) return null;

  const role = ROLE_DEFINITIONS[user.roleId];
  const full = Boolean(role.oversight);
  const scoped = full ? data.audit : data.audit.filter((a) => a.userId === user.id);

  const userFilter = route.query.get('user') ?? '';
  const agencyFilter = route.query.get('agency') ?? '';
  const actFilter = route.query.get('act') ?? '';
  const from = route.query.get('from') ?? '';
  const to = route.query.get('to') ?? '';
  const quick = route.query.get('quick') === '1';

  function set(key: string, value: string | null) {
    navigate(`/audit${setQuery(route.query, { [key]: value })}`, { replace: true });
  }

  const q = text.trim().toLowerCase();
  const rows = scoped
    .filter((a) => !q || a.targetLabel.toLowerCase().includes(q) || a.targetId.toLowerCase().includes(q) || (a.processId ?? '').toLowerCase().includes(q))
    .filter((a) => !userFilter || a.userId === userFilter)
    .filter((a) => !agencyFilter || a.agency === agencyFilter)
    .filter((a) => !actFilter || a.act === actFilter)
    .filter((a) => !from || localDateOf(a.at) >= from)
    .filter((a) => !to || localDateOf(a.at) <= to)
    .filter((a) => !quick || a.act === 'break-glass' || a.act === 'read-restricted' || a.restricted)
    .sort((a, b) => (a.at < b.at ? 1 : -1));

  const counts = {
    restrictedReads: rows.filter((a) => a.act === 'read-restricted').length,
    shares: rows.filter((a) => a.act === 'share').length,
    breakGlass: rows.filter((a) => a.act === 'break-glass').length,
    personaSwitches: rows.filter((a) => a.act === 'persona-switch').length,
  };

  const userOptions = [...new Map(scoped.map((a) => [a.userId, a.userName] as const)).entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }));

  function describeFilters(): string {
    const parts: string[] = [full ? 'Scope: every entry' : 'Scope: own entries'];
    if (q) parts.push(`text "${text.trim()}"`);
    if (userFilter) parts.push(`user ${userOptions.find((u) => u.value === userFilter)?.label ?? userFilter}`);
    if (agencyFilter) parts.push(`agency ${agencyFilter}`);
    if (actFilter) parts.push(`act ${actFilter}`);
    if (from) parts.push(`from ${from}`);
    if (to) parts.push(`to ${to}`);
    if (quick) parts.push('break-glass and restricted reads only');
    return parts.join('; ');
  }

  function exportCsv() {
    const header = ['at', 'user', 'agency', 'act', 'targetType', 'targetId', 'targetLabel', 'processId', 'reason', 'restricted', 'expiresAt'];
    const lines = rows.map((a) => [a.at, a.userName, a.agency, a.act, a.targetType, a.targetId, a.targetLabel, a.processId, a.reason, a.restricted ? 'yes' : 'no', a.expiresAt].map(csvCell).join(','));
    const csv = `${[header.join(','), ...lines].join('\r\n')}\r\n`;
    const name = `audit-export-${localDateOf(now)}-${formatTime(now).replace(':', '')}.csv`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    audit({ act: 'export', targetType: 'report', targetId: 'audit-export', targetLabel: `Audit log export: ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`, reason: describeFilters() });
    toast({ title: 'Audit log exported', text: `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} written to ${name}. The export is itself now in the log.`, tone: 'success' });
  }

  const state = dev ?? (rows.length === 0 ? 'empty' : 'ready');

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>Audit</h1>
          <p className="page-lede">
            {full ? `Showing every entry: ${role.label} has oversight. ` : 'Showing your own entries. Oversight roles, system administrators and Caldicott guardians see everyone’s. '}
            Every read of a restricted record, every share, every break-glass and every persona switch is here, newest first.
          </p>
        </div>
        <Button variant="secondary" icon={<Download size={16} aria-hidden="true" />} onClick={exportCsv} disabled={rows.length === 0}>
          Export audit log as CSV
        </Button>
      </div>

      <div className={styles.filters}>
        <div className={styles.filtersText}>
          <TextField label="Person or process" value={text} onChange={(e) => setText(e.target.value)} placeholder="Name, reference or record id" />
        </div>
        <SelectField label="User" value={userFilter} onChange={(e) => set('user', e.target.value || null)} placeholder="Anyone" options={userOptions} />
        <SelectField label="Agency" value={agencyFilter} onChange={(e) => set('agency', e.target.value || null)} placeholder="All agencies" options={AGENCIES.map((a) => ({ value: a, label: AGENCY_LABELS[a] }))} />
        <SelectField label="Act" value={actFilter} onChange={(e) => set('act', e.target.value || null)} placeholder="All acts" options={AUDIT_ACTS.map((a) => ({ value: a, label: ACT_LABELS[a] }))} />
        <DateField label="From" value={from} onChange={(v) => set('from', /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)} />
        <DateField label="To" value={to} onChange={(v) => set('to', /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)} />
      </div>
      <div className={styles.quick}>
        <Switch label="Break-glass and restricted reads only" checked={quick} onChange={(e) => set('quick', e.target.checked ? '1' : null)} />
        <span>
          {rows.length} of {scoped.length} {scoped.length === 1 ? 'entry' : 'entries'} shown
        </span>
      </div>

      <div className={styles.summary} role="group" aria-label="Summary of the entries shown">
        <dl className={styles.stat} data-tone={counts.restrictedReads > 0 ? 'critical' : undefined}>
          <dt>Restricted reads</dt>
          <dd>{counts.restrictedReads}</dd>
        </dl>
        <dl className={styles.stat}>
          <dt>Shares</dt>
          <dd>{counts.shares}</dd>
        </dl>
        <dl className={styles.stat} data-tone={counts.breakGlass > 0 ? 'critical' : undefined}>
          <dt>Break-glass grants</dt>
          <dd>{counts.breakGlass}</dd>
        </dl>
        <dl className={styles.stat}>
          <dt>Persona switches</dt>
          <dd>{counts.personaSwitches}</dd>
        </dl>
      </div>

      <ScreenState state={state} empty={{ title: 'No entries match', text: quick ? 'No break-glass grants or restricted reads in this range. Clear the quick filter to see every act.' : 'Widen the date range or clear the filters. Entries are added as the demo runs.' }}>
        <div className={styles.ledger}>
          <TableWrap label="Audit log">
            <Table>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">Act</th>
                  <th scope="col">Target</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Restricted</th>
                  <th scope="col">Break-glass expires</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const href = targetHref(data, a);
                  const sel = selectionFor(a);
                  return (
                    <tr key={a.id} className={styles.row} data-act={a.act} data-restricted={a.restricted ? 'true' : undefined} onMouseEnter={() => sel && select(sel)} onFocus={() => sel && select(sel)}>
                      <td className={styles.time}>{formatDateTime(a.at)}</td>
                      <td>
                        <span className={styles.who}>
                          <AgencyMark agency={a.agency} hideLabel />
                          {a.userName}
                        </span>
                      </td>
                      <td>
                        <Pill size="sm" tone={ACT_TONES[a.act]} icon={a.act === 'break-glass' ? <ShieldAlert size={12} aria-hidden="true" /> : undefined}>
                          {ACT_LABELS[a.act]}
                        </Pill>
                      </td>
                      <td>
                        {href ? <AppLink href={href}>{a.targetLabel}</AppLink> : a.targetLabel}
                        <span className={styles.targetType}>{TARGET_LABELS[a.targetType]}</span>
                      </td>
                      <td className={styles.reason}>{a.reason ?? ''}</td>
                      <td>
                        {a.restricted ? (
                          <span className={styles.restricted}>
                            <Lock size={12} aria-hidden="true" />
                            Restricted
                          </span>
                        ) : (
                          <span className={styles.muted}>No</span>
                        )}
                      </td>
                      <td className={styles.time}>{a.expiresAt ? formatDateTime(a.expiresAt) : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </div>
      </ScreenState>
    </div>
  );
}
