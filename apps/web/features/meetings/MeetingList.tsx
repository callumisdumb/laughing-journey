'use client';

import { MEETING_TYPES, MEETING_TYPE_LABELS, PROCESS_SHORT, formatDate, formatTime } from '@mas/domain';
import { Pill, ProcessMark, SelectField, Switch, Table, TableWrap } from '@mas/ui';
import { useEffect } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { meetingPath } from '@/lib/routes';
import { useSelection } from '@/lib/selection';
import { accessForUser, fullName, personById } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useNow } from '@/lib/store';

export function MeetingList() {
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
  const mine = route.query.get('mine') !== '0';
  const past = route.query.get('past') === '1';

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
          <h1>Meetings</h1>
          <p className="page-lede">IRDs, planning meetings, case conferences, MARAC and MAPPA. Open one to prepare the pack, run the meeting and distribute the minute.</p>
        </div>
      </div>
      <div className="cluster" style={{ marginBottom: 'var(--density-gap)', alignItems: 'flex-end', gap: 16 }}>
        <SelectField label="Meeting type" value={typeFilter} onChange={(e) => set('type', e.target.value || null)} placeholder="All types" options={MEETING_TYPES.map((t) => ({ value: t, label: MEETING_TYPE_LABELS[t] }))} />
        <Switch label="Only meetings I am invited to" checked={mine} onChange={(e) => set('mine', e.target.checked ? null : '0')} />
        <Switch label="Show held meetings" checked={past} onChange={(e) => set('past', e.target.checked ? '1' : null)} />
      </div>
      <ScreenState state={dev ?? (rows.length === 0 ? 'empty' : 'ready')} empty={{ title: 'No meetings', text: past ? 'No held meetings match.' : 'Nothing is scheduled for you. Turn off the invitation filter to see every meeting you can access.' }}>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Meeting</th>
                <th scope="col">Process</th>
                <th scope="col">Subject</th>
                <th scope="col">Chair</th>
                <th scope="col">Status</th>
                <th scope="col">Minute</th>
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
                      <span style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)' }}>{MEETING_TYPE_LABELS[m.type]}</span>
                    </td>
                    <td>{process ? <ProcessMark type={process.type} restricted={process.classification === 'restricted'} /> : ''}</td>
                    <td>{process?.classification === 'restricted' ? PROCESS_SHORT[process.type] : subject ? fullName(subject) : ''}</td>
                    <td>{m.chairName}</td>
                    <td>
                      <Pill size="sm" tone={m.status === 'scheduled' ? 'accent' : m.status === 'held' ? 'low' : 'outline'}>
                        {m.status}
                      </Pill>
                    </td>
                    <td>{m.minute.status.replace(/-/g, ' ')}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      </ScreenState>
    </div>
  );
}
