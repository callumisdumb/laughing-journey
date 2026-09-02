'use client';

import { AGENCIES, AGENCY_SHORT, PROCESS_LABELS, PROCESS_TYPES, ageLabel, formatDate, stageLabel, type Agency, type Person, type ProcessType } from '@mas/domain';
import { AgencyMark, Pill, ProcessMark, SelectField, Table, TableWrap, TextField, tableStyles } from '@mas/ui';
import { Lock, UserX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { useNavigate, useRoute, setQuery } from '@/lib/router';
import { personPath } from '@/lib/routes';
import { useSelection } from '@/lib/selection';
import { accessForUser, currentAddress, fullName, processesInvolving } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useNow } from '@/lib/store';
import { TOWNS } from '@mas/mock-data';
import styles from './PeopleList.module.css';

type AgeBand = 'unborn' | '0-4' | '5-11' | '12-17' | '18-64' | '65+';

function ageBandOf(p: Person, now: Date): AgeBand {
  if (p.lifeStage === 'unborn' || !p.dateOfBirth) return 'unborn';
  const years = now.getFullYear() - Number(p.dateOfBirth.slice(0, 4)) - (now.toISOString().slice(5, 10) < p.dateOfBirth.slice(5, 10) ? 1 : 0);
  if (years <= 4) return '0-4';
  if (years <= 11) return '5-11';
  if (years <= 17) return '12-17';
  if (years <= 64) return '18-64';
  return '65+';
}

export function PeopleList() {
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const now = useNow();
  const route = useRoute();
  const navigate = useNavigate();
  const grants = useAppStore((s) => s.session.breakGlass);
  const select = useSelection((s) => s.select);
  const dev = useDevState();
  const [text, setText] = useState(route.query.get('q') ?? '');

  const processFilter = route.query.get('process') ?? '';
  const agencyFilter = route.query.get('agency') ?? '';
  const townFilter = route.query.get('town') ?? '';
  const ageFilter = route.query.get('age') ?? '';

  useEffect(() => {
    select(null);
  }, [select]);

  const rows = useMemo(() => {
    if (!user) return [];
    const q = text.trim().toLowerCase();
    return data.people
      .map((p) => {
        const processes = processesInvolving(data, p.id).filter((pr) => pr.status === 'open');
        const access = processes.map((pr) => ({ process: pr, access: accessForUser(data, config, user, pr, grants, now) }));
        const address = currentAddress(data, p);
        return { person: p, processes: access, address, band: ageBandOf(p, now) };
      })
      .filter((r) => {
        if (q && !fullName(r.person).toLowerCase().includes(q) && !r.address.line.toLowerCase().includes(q)) return false;
        if (processFilter && !r.processes.some((x) => x.process.type === processFilter)) return false;
        if (agencyFilter && !r.processes.some((x) => x.process.members.some((m) => m.agency === agencyFilter))) return false;
        if (townFilter && !r.address.line.includes(townFilter)) return false;
        if (ageFilter && r.band !== ageFilter) return false;
        return true;
      })
      .sort((a, b) => (b.processes.length - a.processes.length) || a.person.familyName.localeCompare(b.person.familyName));
  }, [data, config, user, grants, now, text, processFilter, agencyFilter, townFilter, ageFilter]);

  function setFilter(key: string, value: string) {
    navigate(`/people${setQuery(route.query, { [key]: value || null })}`, { replace: true });
  }

  const state = dev ?? (rows.length === 0 ? 'empty' : 'ready');

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>People</h1>
          <p className="page-lede">Everyone known to the platform in Clydeshore. What you can open depends on your agency, your role and whether you are on the case.</p>
        </div>
        <span className={styles.count}>
          {rows.length} of {data.people.length} people
        </span>
      </div>
      <div className={styles.filters}>
        <TextField className={styles.filterSearch} label="Name or address" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Start typing a name" />
        <SelectField label="Process" value={processFilter} onChange={(e) => setFilter('process', e.target.value)} placeholder="Any process" options={PROCESS_TYPES.map((t) => ({ value: t, label: PROCESS_LABELS[t] }))} />
        <SelectField label="Agency involved" value={agencyFilter} onChange={(e) => setFilter('agency', e.target.value)} placeholder="Any agency" options={AGENCIES.map((a) => ({ value: a, label: AGENCY_SHORT[a] }))} />
        <SelectField label="Locality" value={townFilter} onChange={(e) => setFilter('town', e.target.value)} placeholder="Any town" options={TOWNS.map((t) => ({ value: t.name, label: t.name }))} />
        <SelectField label="Age band" value={ageFilter} onChange={(e) => setFilter('age', e.target.value)} placeholder="Any age" options={[{ value: 'unborn', label: 'Unborn' }, { value: '0-4', label: '0 to 4' }, { value: '5-11', label: '5 to 11' }, { value: '12-17', label: '12 to 17' }, { value: '18-64', label: '18 to 64' }, { value: '65+', label: '65 and over' }]} />
      </div>
      <ScreenState state={state} empty={{ title: 'No people match these filters', text: 'Clear a filter or search by name, alias, date of birth, CHI, address or reference number from the top bar.' }}>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Age</th>
                <th scope="col">Address</th>
                <th scope="col">Processes</th>
                <th scope="col">Agencies involved</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const agencies = [...new Set(r.processes.flatMap((x) => x.process.members.map((m) => m.agency)))] as Agency[];
                return (
                  <tr
                    key={r.person.id}
                    data-interactive="true"
                    tabIndex={0}
                    onClick={() => navigate(personPath(r.person.id))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') navigate(personPath(r.person.id));
                    }}
                    onFocus={() => select({ kind: 'person', id: r.person.id })}
                    onMouseEnter={() => select({ kind: 'person', id: r.person.id })}
                  >
                    <td>
                      <AppLink href={personPath(r.person.id)} className={styles.name} onClick={(e) => e.stopPropagation()}>
                        {fullName(r.person)}
                      </AppLink>
                      {r.person.preferredName ? <span className={styles.sub}>Known as {r.person.preferredName}</span> : null}
                    </td>
                    <td className={tableStyles.table ? undefined : undefined}>
                      {r.person.lifeStage === 'unborn' ? `Unborn, due ${r.person.expectedDeliveryDate ? formatDate(r.person.expectedDeliveryDate) : 'date not recorded'}` : r.person.dateOfBirth ? ageLabel(r.person.dateOfBirth, now) : 'Not recorded'}
                      {r.person.dateOfBirth ? <span className={styles.sub}>{formatDate(r.person.dateOfBirth)}</span> : null}
                    </td>
                    <td>{r.address.line}</td>
                    <td>
                      <span className={styles.badges}>
                        {r.processes.length === 0 ? <span className={styles.sub}>None open</span> : null}
                        {r.processes.map(({ process, access }) =>
                          access.level === 'none' ? (
                            <Pill key={process.id} tone="restricted" size="sm" icon={<Lock size={12} aria-hidden="true" />}>
                              Restricted
                            </Pill>
                          ) : access.level === 'presence' ? (
                            <span key={process.id} className={styles.notOnCase}>
                              <ProcessMark type={process.type as ProcessType} />
                              <UserX size={12} aria-hidden="true" /> not on this case
                            </span>
                          ) : (
                            <ProcessMark key={process.id} type={process.type as ProcessType} stage={stageLabel(process.type, process.stage)} />
                          ),
                        )}
                      </span>
                    </td>
                    <td>
                      <span className={styles.agencies}>
                        {agencies.map((a) => (
                          <AgencyMark key={a} agency={a} hideLabel />
                        ))}
                      </span>
                    </td>
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
