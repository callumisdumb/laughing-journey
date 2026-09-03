'use client';

import { PROCESS_TYPES, agencyShort, detailLevelLabel, formatDate, processLabel, stageLabel } from '@mas/domain';
import { useT } from '@mas/messages';
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
  const t = useT();
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
          <h1>{t('processes.list.title')}</h1>
          <p className="page-lede">{t('processes.list.lede')}</p>
        </div>
      </div>
      <div className="cluster" style={{ marginBottom: 'var(--density-gap)', alignItems: 'flex-end', gap: 16 }}>
        <SelectField label={t('processes.list.filters.type')} value={typeFilter} onChange={(e) => set('type', e.target.value || null)} placeholder={t('processes.list.filters.allTypes')} options={PROCESS_TYPES.map((type) => ({ value: type, label: processLabel(type) }))} />
        <Switch label={t('processes.list.filters.mine')} checked={mine} onChange={(e) => set('mine', e.target.checked ? '1' : null)} />
        <Switch label={t('processes.list.filters.includeClosed')} checked={showClosed} onChange={(e) => set('closed', e.target.checked ? '1' : null)} />
      </div>
      <ScreenState state={dev ?? (rows.length === 0 ? 'empty' : 'ready')} empty={{ title: t('processes.list.empty.title'), text: t('processes.list.empty.text') }}>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <th scope="col">{t('processes.list.columns.reference')}</th>
                <th scope="col">{t('processes.list.columns.typeAndStage')}</th>
                <th scope="col">{t('processes.list.columns.subject')}</th>
                <th scope="col">{t('processes.list.columns.lead')}</th>
                <th scope="col">{t('processes.list.columns.clock')}</th>
                <th scope="col">{t('processes.list.columns.nextMeeting')}</th>
                <th scope="col">{t('processes.list.columns.access')}</th>
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
                    <ProcessMark type={p.type} stage={stageLabel(p.type, p.stage)} restricted={p.accessRestriction === 'restricted'} />
                  </td>
                  <td>
                    {access.level === 'none' ? (
                      <Pill tone="restricted" size="sm" icon={<Lock size={12} aria-hidden="true" />}>
                        {t('common.labels.restricted')}
                      </Pill>
                    ) : subject ? (
                      t('processes.list.subjectWithMore', { name: fullName(subject), count: p.subjectIds.length - 1 })
                    ) : (
                      p.title
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{agencyShort(p.leadAgency)}</td>
                  <td>{access.level === 'none' || access.level === 'presence' ? '' : clocks[0] ? <RiskBand band={clocks[0].band} label={t('processes.list.clockRemaining', { label: clocks[0].label, overdue: clocks[0].daysRemaining < 0 ? 'yes' : 'no', days: Math.abs(clocks[0].daysRemaining) })} /> : <span style={{ color: 'var(--color-ink-3)' }}>{t('processes.list.noClock')}</span>}</td>
                  <td>{access.level === 'none' ? '' : next ? t('processes.list.nextMeetingCell', { date: formatDate(next.scheduledAt), title: next.title.split(':')[0] ?? next.title }) : ''}</td>
                  <td>
                    <Pill size="sm" tone={access.level === 'full' ? 'accent' : access.level === 'none' ? 'restricted' : 'outline'}>
                      {access.level === 'none' ? t('processes.list.noAccess') : detailLevelLabel(access.level)}
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
