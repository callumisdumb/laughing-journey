'use client';

import { MEETING_TYPES, formatDate, formatTime, meetingStatusLabel, meetingTypeLabel, minuteStatusLabel, processShort } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, Pill, ProcessMark, SelectField, Switch, Table, TableWrap } from '@mas/ui';
import { CalendarPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { meetingPath } from '@/lib/routes';
import { useSelection } from '@/lib/selection';
import { accessForUser, fullName, personById } from '@/lib/selectors';
import { useConfig, useCurrentUser, useData, useGrants, useNow } from '@/lib/store';
import { ScheduleMeetingDialog } from './ScheduleMeetingDialog';

export function MeetingList() {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const now = useNow();
  const route = useRoute();
  const navigate = useNavigate();
  const grants = useGrants();
  const select = useSelection((s) => s.select);
  const dev = useDevState();
  const typeFilter = route.query.get('type') ?? '';
  const mine = route.query.get('mine') !== '0';
  const past = route.query.get('past') === '1';
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    select(null);
  }, [select]);

  if (!user) return null;

  const rows = data.meetings
    .map((m) => ({ meeting: m, process: data.processes.find((p) => p.id === m.processId) }))
    .filter(({ meeting, process }) => {
      if (!process) return false;
      const access = accessForUser(data, config, user, process, grants, now);
      if (access.level === 'none') return false;
      if (mine && !(meeting.chairUserId === user.id || meeting.minuteTakerUserId === user.id || meeting.invitees.some((i) => i.userId === user.id))) return false;
      if (typeFilter && meeting.type !== typeFilter) return false;
      if (!past && meeting.status === 'held') return false;
      return true;
    })
    .sort((a, b) => (a.meeting.scheduledAt < b.meeting.scheduledAt ? (past ? 1 : -1) : past ? -1 : 1));

  function set(key: string, value: string | null) {
    navigate(`/meetings${setQuery(route.query, { [key]: value })}`, { replace: true });
  }

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>{t('meetings.list.title')}</h1>
          <p className="page-lede">{t('meetings.list.lede')}</p>
        </div>
        <div className="page-head-actions">
          <Button variant="primary" icon={<CalendarPlus size={16} aria-hidden="true" />} onClick={() => setScheduling(true)} data-testid="schedule-meeting">
            {t('meetings.list.schedule')}
          </Button>
        </div>
      </div>
      <div className="cluster" style={{ marginBottom: 'var(--density-gap)', alignItems: 'flex-end', gap: 16 }}>
        <SelectField label={t('meetings.list.filters.type')} value={typeFilter} onChange={(e) => set('type', e.target.value || null)} placeholder={t('meetings.list.filters.allTypes')} options={MEETING_TYPES.map((type) => ({ value: type, label: meetingTypeLabel(type) }))} />
        <Switch label={t('meetings.list.filters.mine')} checked={mine} onChange={(e) => set('mine', e.target.checked ? null : '0')} />
        <Switch label={t('meetings.list.filters.past')} checked={past} onChange={(e) => set('past', e.target.checked ? '1' : null)} />
      </div>
      <ScreenState state={dev ?? (rows.length === 0 ? 'empty' : 'ready')} empty={{ title: t('meetings.list.empty.title'), text: past ? t('meetings.list.empty.pastText') : t('meetings.list.empty.text') }}>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <th scope="col">{t('meetings.list.columns.when')}</th>
                <th scope="col">{t('meetings.list.columns.meeting')}</th>
                <th scope="col">{t('meetings.list.columns.process')}</th>
                <th scope="col">{t('meetings.list.columns.subject')}</th>
                <th scope="col">{t('meetings.list.columns.chair')}</th>
                <th scope="col">{t('meetings.list.columns.status')}</th>
                <th scope="col">{t('meetings.list.columns.minute')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ meeting: m, process }) => {
                const subject = personById(data, m.subjectIds[0]);
                return (
                  <tr key={m.id} data-interactive="true" tabIndex={0} onClick={() => navigate(meetingPath(m.id))} onKeyDown={(e) => e.key === 'Enter' && navigate(meetingPath(m.id))} onMouseEnter={() => select({ kind: 'meeting', id: m.id })} onFocus={() => select({ kind: 'meeting', id: m.id })}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {formatDate(m.scheduledAt)} <span style={{ color: 'var(--color-ink-3)' }}>{formatTime(m.scheduledAt)}</span>
                    </td>
                    <td>
                      <AppLink href={meetingPath(m.id)} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 700 }}>
                        {m.title}
                      </AppLink>
                      <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)' }}>{meetingTypeLabel(m.type)}</span>
                    </td>
                    <td>{process ? <ProcessMark type={process.type} restricted={process.accessRestriction === 'restricted'} /> : ''}</td>
                    <td>{process?.accessRestriction === 'restricted' ? processShort(process.type) : subject ? fullName(subject) : ''}</td>
                    <td>{m.chairName}</td>
                    <td>
                      <Pill size="sm" tone={m.status === 'scheduled' ? 'accent' : m.status === 'held' ? 'low' : m.status === 'cancelled' ? 'critical' : 'outline'}>
                        {meetingStatusLabel(m.status)}
                      </Pill>
                    </td>
                    <td>{minuteStatusLabel(m.minute.status)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      </ScreenState>
      {scheduling ? <ScheduleMeetingDialog open onClose={() => setScheduling(false)} /> : null}
    </div>
  );
}
