'use client';

import { AGENCIES, ROLE_DEFINITIONS, roleLabel } from '@mas/domain';
import { useT } from '@mas/messages';
import { AgencyMark, Button, Pill, Table, TableWrap, TextField } from '@mas/ui';
import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from '@/lib/router';
import { userName } from '@/lib/selectors';
import { useAppStore, useCurrentUser, useData } from '@/lib/store';
import { SectionHead } from './SectionHead';
import styles from './Users.module.css';
import { sectionLabel } from './sections';

export function Users() {
  const t = useT();
  const data = useData();
  const current = useCurrentUser();
  const signIn = useAppStore((s) => s.signIn);
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');
  const needle = filter.trim().toLowerCase();

  const rows = [...data.users]
    .sort((a, b) => AGENCIES.indexOf(a.agency) - AGENCIES.indexOf(b.agency) || a.familyName.localeCompare(b.familyName))
    .map((u) => ({ user: u, role: ROLE_DEFINITIONS[u.roleId], team: data.teams.find((t) => t.id === u.teamId), org: data.organisations.find((o) => o.id === u.organisationId) }))
    .filter((r) => !needle || [userName(r.user), r.user.jobTitle, roleLabel(r.user.roleId), r.user.agency, r.team?.name ?? '', r.org?.name ?? '', r.user.base].join(' ').toLowerCase().includes(needle));

  function signInAs(id: string) {
    signIn(id, true);
    navigate('/');
  }

  return (
    <>
      <SectionHead title={sectionLabel('users')} lede={t('admin.users.lede')} />
      <div className={styles.toolbar}>
        <TextField label={t('admin.users.filter')} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t('admin.users.filterPlaceholder')} className={styles.filter} />
        <span className={styles.count} aria-live="polite">
          {t('admin.users.count', { shown: rows.length, total: data.users.length })}
        </span>
      </div>
      <TableWrap label={t('admin.users.tableLabel')}>
        <Table>
          <thead>
            <tr>
              <th scope="col">{t('admin.users.columns.persona')}</th>
              <th scope="col">{t('admin.users.columns.role')}</th>
              <th scope="col">{t('admin.users.columns.agency')}</th>
              <th scope="col">{t('admin.users.columns.team')}</th>
              <th scope="col">{t('admin.users.columns.base')}</th>
              <th scope="col" data-align="num">
                {t('admin.users.columns.cases')}
              </th>
              <th scope="col">
                <span className="visually-hidden">{t('common.columns.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ user: u, role, team, org }) => {
              const isCurrent = current?.id === u.id;
              return (
                <tr key={u.id} data-state={isCurrent ? 'selected' : undefined}>
                  <td>
                    <span className={styles.name}>{userName(u)}</span>
                    <span className={styles.meta}>{u.jobTitle}</span>
                  </td>
                  <td>
                    {roleLabel(u.roleId)}
                    {role.oversight ? <span className={styles.meta}>{t('admin.users.oversight', { oversight: role.oversight })}</span> : null}
                  </td>
                  <td>
                    <AgencyMark agency={u.agency} />
                  </td>
                  <td>
                    {team?.name ?? t('admin.users.noTeam')}
                    <span className={styles.meta}>{org?.shortName ?? ''}</span>
                  </td>
                  <td className={styles.base}>{u.base}</td>
                  <td data-align="num">{u.caseMemberships.length}</td>
                  <td>
                    {isCurrent ? (
                      <Pill size="sm" tone="accent">
                        {t('admin.users.you')}
                      </Pill>
                    ) : (
                      <Button size="sm" variant="secondary" icon={<LogIn size={14} aria-hidden="true" />} onClick={() => signInAs(u.id)}>
                        {t('admin.users.signInAs')}
                        <span className="visually-hidden"> {userName(u)}</span>
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.none}>
                  {t('admin.users.empty', { total: data.users.length })}
                </td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </TableWrap>
    </>
  );
}
