'use client';

import { AGENCIES, AUDIT_ACTS, ROLE_DEFINITIONS, agencyLabel, formatDate, formatDateTime, formatTime, localDateOf, roleLabel, type Agency, type AuditAct, type AuditEntry, type Dataset } from '@mas/domain';
import { tKey, useT } from '@mas/messages';
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

/** `read-restricted` to `readRestricted`: the catalogue key segment for an act. */
function segment(id: string): string {
  return id
    .split('-')
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

const actLabel = (act: AuditAct) => tKey(`audit.acts.${segment(act)}`);
const targetLabel = (type: AuditEntry['targetType']) => tKey(`audit.targets.${type}`);

const ACT_TONES: Record<AuditAct, PillTone> = {
  read: 'neutral',
  'read-restricted': 'restricted',
  share: 'accent',
  'break-glass': 'critical',
  'persona-switch': 'medium',
  export: 'high',
  edit: 'outline',
  promote: 'accent',
  classify: 'neutral',
  'classification-raise': 'high',
  'classification-lower': 'critical',
  'sign-in': 'low',
  create: 'low',
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
  const t = useT();
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
    const parts: string[] = [full ? t('audit.scope.all') : t('audit.scope.own')];
    if (q) parts.push(t('audit.scope.text', { text: text.trim() }));
    if (userFilter) parts.push(t('audit.scope.user', { name: userOptions.find((u) => u.value === userFilter)?.label ?? userFilter }));
    if (agencyFilter) parts.push(t('audit.scope.agency', { agency: AGENCIES.includes(agencyFilter as Agency) ? agencyLabel(agencyFilter as Agency) : agencyFilter }));
    if (actFilter) parts.push(t('audit.scope.act', { act: actFilter }));
    if (from) parts.push(t('audit.scope.from', { date: formatDate(from) }));
    if (to) parts.push(t('audit.scope.to', { date: formatDate(to) }));
    if (quick) parts.push(t('audit.scope.quick'));
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
    audit({ act: 'export', targetType: 'report', targetId: 'audit-export', targetLabel: t('audit.export.auditLabel', { count: rows.length }), reason: describeFilters() });
    toast({ title: t('audit.export.toastTitle'), text: t('audit.export.toastText', { count: rows.length, file: name }), tone: 'success' });
  }

  const state = dev ?? (rows.length === 0 ? 'empty' : 'ready');

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>{t('audit.page.title')}</h1>
          <p className="page-lede">
            {full ? t('audit.page.ledeFull', { role: roleLabel(user.roleId) }) : t('audit.page.ledeOwn')} {t('audit.page.ledeTail')}
          </p>
        </div>
        <Button variant="secondary" icon={<Download size={16} aria-hidden="true" />} onClick={exportCsv} disabled={rows.length === 0}>
          {t('audit.export.button')}
        </Button>
      </div>

      <div className={styles.filters}>
        <div className={styles.filtersText}>
          <TextField label={t('audit.filters.text')} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('audit.filters.textPlaceholder')} />
        </div>
        <SelectField label={t('audit.filters.user')} value={userFilter} onChange={(e) => set('user', e.target.value || null)} placeholder={t('audit.filters.anyone')} options={userOptions} />
        <SelectField label={t('audit.filters.agency')} value={agencyFilter} onChange={(e) => set('agency', e.target.value || null)} placeholder={t('audit.filters.allAgencies')} options={AGENCIES.map((a) => ({ value: a, label: agencyLabel(a) }))} />
        <SelectField label={t('audit.filters.act')} value={actFilter} onChange={(e) => set('act', e.target.value || null)} placeholder={t('audit.filters.allActs')} options={AUDIT_ACTS.map((a) => ({ value: a, label: actLabel(a) }))} />
        <DateField label={t('audit.filters.from')} hint={null} value={from} onChange={(v) => set('from', /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)} />
        <DateField label={t('audit.filters.to')} hint={null} value={to} onChange={(v) => set('to', /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)} />
      </div>
      <div className={styles.quick}>
        <Switch label={t('audit.quick.label')} checked={quick} onChange={(e) => set('quick', e.target.checked ? '1' : null)} />
        <span>{t('audit.quick.shown', { shown: rows.length, total: scoped.length })}</span>
      </div>

      <div className={styles.summary} role="group" aria-label={t('audit.summary.label')}>
        <dl className={styles.stat} data-tone={counts.restrictedReads > 0 ? 'critical' : undefined}>
          <dt>{t('audit.summary.restrictedReads')}</dt>
          <dd>{counts.restrictedReads}</dd>
        </dl>
        <dl className={styles.stat}>
          <dt>{t('audit.summary.shares')}</dt>
          <dd>{counts.shares}</dd>
        </dl>
        <dl className={styles.stat} data-tone={counts.breakGlass > 0 ? 'critical' : undefined}>
          <dt>{t('audit.summary.breakGlass')}</dt>
          <dd>{counts.breakGlass}</dd>
        </dl>
        <dl className={styles.stat}>
          <dt>{t('audit.summary.personaSwitches')}</dt>
          <dd>{counts.personaSwitches}</dd>
        </dl>
      </div>

      <ScreenState state={state} empty={{ title: t('audit.empty.title'), text: quick ? t('audit.empty.quick') : t('audit.empty.text') }}>
        <div className={styles.ledger}>
          <TableWrap label={t('audit.table.label')}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t('audit.columns.when')}</th>
                  <th scope="col">{t('audit.columns.who')}</th>
                  <th scope="col">{t('audit.columns.act')}</th>
                  <th scope="col">{t('audit.columns.target')}</th>
                  <th scope="col">{t('audit.columns.reason')}</th>
                  <th scope="col">{t('audit.columns.restricted')}</th>
                  <th scope="col">{t('audit.columns.expires')}</th>
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
                          {actLabel(a.act)}
                        </Pill>
                      </td>
                      <td>
                        {href ? <AppLink href={href}>{a.targetLabel}</AppLink> : a.targetLabel}
                        <span className={styles.targetType}>{targetLabel(a.targetType)}</span>
                      </td>
                      <td className={styles.reason}>{a.reason ?? ''}</td>
                      <td>
                        {a.restricted ? (
                          <span className={styles.restricted}>
                            <Lock size={12} aria-hidden="true" />
                            {t('common.labels.restricted')}
                          </span>
                        ) : (
                          <span className={styles.muted}>{t('common.answers.no')}</span>
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
