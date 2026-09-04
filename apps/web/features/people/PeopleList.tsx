'use client';

import { AGENCIES, PROCESS_TYPES, ageLabel, agencyShort, formatDate, processLabel, stageLabel, type Agency, type Person } from '@mas/domain';
import { useT } from '@mas/messages';
import { AgencyMark, Button, Pill, ProcessMark, SelectField, Table, TableWrap, TextField, tableStyles } from '@mas/ui';
import { Lock, UserPlus, UserX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { AddPersonDialog } from '@/features/person/AddPersonDialog';
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
  const [text, setText] = useState(route.query.get('q') ?? '');
  const [adding, setAdding] = useState(false);

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

  const ageBands: Array<{ value: AgeBand; label: string }> = [
    { value: 'unborn', label: t('person.list.ageBands.unborn') },
    { value: '0-4', label: t('person.list.ageBands.under5') },
    { value: '5-11', label: t('person.list.ageBands.primary') },
    { value: '12-17', label: t('person.list.ageBands.secondary') },
    { value: '18-64', label: t('person.list.ageBands.adult') },
    { value: '65+', label: t('person.list.ageBands.older') },
  ];

  const state = dev ?? (rows.length === 0 ? 'empty' : 'ready');

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>{t('person.list.title')}</h1>
          <p className="page-lede">{t('person.list.lede')}</p>
        </div>
        <div className={styles.headActions}>
          <span className={styles.count}>{t('person.list.count', { shown: rows.length, total: data.people.length })}</span>
          <Button variant="primary" icon={<UserPlus size={16} aria-hidden="true" />} onClick={() => setAdding(true)} data-testid="add-person">
            {t('person.create.open')}
          </Button>
        </div>
      </div>
      <div className={styles.filters}>
        <div className={styles.filterSearch}>
          <TextField label={t('person.list.filters.search')} type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('person.list.filters.searchPlaceholder')} />
        </div>
        <SelectField label={t('person.list.filters.process')} value={processFilter} onChange={(e) => setFilter('process', e.target.value)} placeholder={t('person.list.filters.anyProcess')} options={PROCESS_TYPES.map((pt) => ({ value: pt, label: processLabel(pt) }))} />
        <SelectField label={t('person.list.filters.agency')} value={agencyFilter} onChange={(e) => setFilter('agency', e.target.value)} placeholder={t('person.list.filters.anyAgency')} options={AGENCIES.map((a) => ({ value: a, label: agencyShort(a) }))} />
        <SelectField label={t('person.list.filters.locality')} value={townFilter} onChange={(e) => setFilter('town', e.target.value)} placeholder={t('person.list.filters.anyTown')} options={TOWNS.map((town) => ({ value: town.name, label: town.name }))} />
        <SelectField label={t('person.list.filters.ageBand')} value={ageFilter} onChange={(e) => setFilter('age', e.target.value)} placeholder={t('person.list.filters.anyAge')} options={ageBands} />
      </div>
      <ScreenState state={state} empty={{ title: t('person.list.empty.title'), text: t('person.list.empty.text') }}>
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <th scope="col">{t('person.list.columns.name')}</th>
                <th scope="col">{t('person.list.columns.age')}</th>
                <th scope="col">{t('person.list.columns.address')}</th>
                <th scope="col">{t('person.list.columns.processes')}</th>
                <th scope="col">{t('person.list.columns.agencies')}</th>
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
                      {r.person.preferredName ? <span className={styles.sub}>{t('person.list.knownAs', { name: r.person.preferredName })}</span> : null}
                    </td>
                    <td className={tableStyles.table ? undefined : undefined}>
                      {r.person.lifeStage === 'unborn'
                        ? r.person.expectedDeliveryDate
                          ? t('person.list.unbornDue', { date: formatDate(r.person.expectedDeliveryDate) })
                          : t('person.list.unbornDueUnknown')
                        : r.person.dateOfBirth
                          ? ageLabel(r.person.dateOfBirth, now)
                          : t('person.list.ageNotRecorded')}
                      {r.person.dateOfBirth ? <span className={styles.sub}>{formatDate(r.person.dateOfBirth)}</span> : null}
                    </td>
                    <td>{r.address.line}</td>
                    <td>
                      <span className={styles.badges}>
                        {r.processes.length === 0 ? <span className={styles.sub}>{t('person.list.noneOpen')}</span> : null}
                        {r.processes.map(({ process, access }) =>
                          access.level === 'none' ? (
                            <Pill key={process.id} tone="restricted" size="sm" icon={<Lock size={12} aria-hidden="true" />}>
                              {t('person.list.restricted')}
                            </Pill>
                          ) : access.level === 'presence' ? (
                            <span key={process.id} className={styles.notOnCase}>
                              <ProcessMark type={process.type} />
                              <UserX size={12} aria-hidden="true" /> {t('person.list.notOnCase')}
                            </span>
                          ) : (
                            <ProcessMark key={process.id} type={process.type} stage={stageLabel(process.type, process.stage)} />
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
      {adding ? <AddPersonDialog open onClose={() => setAdding(false)} onCreated={(person) => navigate(personPath(person.id))} /> : null}
    </div>
  );
}
