'use client';

import { AGENCY_SHORT, PROCESS_LABELS, PROCESS_TYPES, formatDate, stageLabel } from '@mas/domain';
import { Pill, ProcessMark, RiskBand, SelectField, Switch, Table, TableWrap } from '@mas/ui';
import { Lock } from 'lucide-react';
import { useEffect } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { processPath } from '@/lib/routes';
import { useSelection } from '@/lib/selection';
import { accessForUser, clocksForProcess, fullName, personById } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useNow } from '@/lib/store';

export function ProcessList() {
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const now = useNow();
  const route = useRoute();
  const navigate = useNavigate();
  const grants = useAppStore((s) => s.session.breakGlass);
  const select = useSelection((s) => s.select);
  const dev = useDevState();
  const typeFilter = route.query.get('type') ?? '';
  const mine = route.query.get('mine') === '1';
  const showClosed = route.query.get('closed') === '1';

  useEffect(() => {
    select(null);
  }, [select]);

  if (!user) return null;

  const rows = data.processes
    .filter((p) => (showClosed ? true : p.status === 'open'))
    .filter((p) => (typeFilter ? p.type === typeFilter : true))
    .filter((p) => (mine ? user.caseMemberships.includes(p.id) : true))
    .map((p) => ({ process: p, access: accessForUser(data, config, user, p, grants, now), subject: personById(data, p.subjectIds[0]), clocks: clocksForProcess(data, config, p, now).filter((c) => c.status !== 'complete'), next: data.meetings.filter((m) => m.processId === p.id && m.status === 'scheduled' && m.scheduledAt >= now.toISOString()).sort((a, b) => (a.scheduledAt < b.scheduledAt ? -1 : 1))[0] }))
    .sort((a, b) => (a.clocks[0]?.daysRemaining ?? 999) - (b.clocks[0]?.daysRemaining ?? 999));

  function set(key: string, value: string | null) {
    navigate(`/processes${setQuery(route.query, { [key]: value })}`, { replace: true });
  }

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>Processes</h1>
          <p className="page-lede">Every open inquiry and protection process in Clydeshore, sorted by the most urgent clock. Restricted records show only that they exist.</p>
        </div>
      </div>
      <div className="cluster" style={{ marginBottom: 'var(--density-gap)', alignItems: 'flex-end', gap: 16 }}>
        <SelectField label="Process type" value={typeFilter} onChange={(e) => set('type', e.target.value || null)} placeholder="All types" options={PROCESS_TYPES.map((t) => ({ value: t, label: PROCESS_LABELS[t] }))} />
        <Switch label="My cases only" checked={mine} onChange={(e) => set('mine', e.target.checked ? '1' : null)} />
        <Switch label="Include closed" checked={showClosed} onChange={(e) => set('closed', e.target.checked ? '1' : null)} />
      </div>
      <ScreenState state={dev ?? (rows.length === 0 ? 'empty' : 'ready')} empty={{ title: 'No processes match', text: 'Clear the filters, or open a person record to start a process.' }}>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Type and stage</th>
                <th scope="col">Subject</th>
                <th scope="col">Lead</th>
                <th scope="col">Most urgent clock</th>
                <th scope="col">Next meeting</th>
                <th scope="col">Your access</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ process: p, access, subject, clocks, next }) => (
                <tr key={p.id} data-interactive="true" tabIndex={0} onClick={() => navigate(processPath(p.id))} onKeyDown={(e) => e.key === 'Enter' && navigate(processPath(p.id))} onMouseEnter={() => select({ kind: 'process', id: p.id })} onFocus={() => select({ kind: 'process', id: p.id })}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <AppLink href={processPath(p.id)} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 700 }}>
                      {p.reference}
                    </AppLink>
                  </td>
                  <td>
                    <ProcessMark type={p.type} stage={stageLabel(p.type, p.stage)} restricted={p.classification === 'restricted'} />
                  </td>
                  <td>{access.level === 'none' ? <Pill tone="restricted" size="sm" icon={<Lock size={12} aria-hidden="true" />}>Restricted</Pill> : subject ? `${fullName(subject)}${p.subjectIds.length > 1 ? ` and ${p.subjectIds.length - 1} more` : ''}` : p.title}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{AGENCY_SHORT[p.leadAgency]}</td>
                  <td>{access.level === 'none' || access.level === 'presence' ? '' : clocks[0] ? <RiskBand band={clocks[0].band} label={`${clocks[0].label}: ${clocks[0].daysRemaining < 0 ? `${Math.abs(clocks[0].daysRemaining)} days overdue` : `${clocks[0].daysRemaining} days`}`} /> : <span style={{ color: 'var(--color-ink-3)' }}>None running</span>}</td>
                  <td>{access.level === 'none' ? '' : next ? `${formatDate(next.scheduledAt)}: ${next.title.split(':')[0]}` : ''}</td>
                  <td>
                    <Pill size="sm" tone={access.level === 'full' ? 'accent' : access.level === 'none' ? 'restricted' : 'outline'}>
                      {access.level === 'none' ? 'no access' : access.level}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </ScreenState>
    </div>
  );
}
