'use client';

import { AGENCIES, ROLE_DEFINITIONS } from '@mas/domain';
import { AgencyMark, Button, Pill, Table, TableWrap, TextField } from '@mas/ui';
import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from '@/lib/router';
import { userName } from '@/lib/selectors';
import { useAppStore, useCurrentUser, useData } from '@/lib/store';
import { SectionHead } from './SectionHead';
import styles from './Users.module.css';

export function Users() {
  const data = useData();
  const current = useCurrentUser();
  const signIn = useAppStore((s) => s.signIn);
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');
  const needle = filter.trim().toLowerCase();

  const rows = [...data.users]
    .sort((a, b) => AGENCIES.indexOf(a.agency) - AGENCIES.indexOf(b.agency) || a.familyName.localeCompare(b.familyName))
    .map((u) => ({ user: u, role: ROLE_DEFINITIONS[u.roleId], team: data.teams.find((t) => t.id === u.teamId), org: data.organisations.find((o) => o.id === u.organisationId) }))
    .filter((r) => !needle || [userName(r.user), r.user.jobTitle, r.role.label, r.user.agency, r.team?.name ?? '', r.org?.name ?? '', r.user.base].join(' ').toLowerCase().includes(needle));

  function signInAs(id: string) {
    signIn(id, true);
    navigate('/');
  }

  return (
    <>
      <SectionHead title="Users" lede="Every demo persona, their role, agency, team and case memberships. Signing in as a persona is recorded in the audit log as a persona switch." />
      <div className={styles.toolbar}>
        <TextField label="Filter personas" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Name, role, agency, team or base" className={styles.filter} />
        <span className={styles.count} aria-live="polite">
          {rows.length} of {data.users.length} personas
        </span>
      </div>
      <TableWrap label="Personas">
        <Table>
          <thead>
            <tr>
              <th scope="col">Persona</th>
              <th scope="col">Role</th>
              <th scope="col">Agency</th>
              <th scope="col">Team</th>
              <th scope="col">Base</th>
              <th scope="col" data-align="num">
                Cases
              </th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
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
                    {role.label}
                    {role.oversight ? <span className={styles.meta}>Oversight: {role.oversight}</span> : null}
                  </td>
                  <td>
                    <AgencyMark agency={u.agency} />
                  </td>
                  <td>
                    {team?.name ?? 'No team'}
                    <span className={styles.meta}>{org?.shortName ?? ''}</span>
                  </td>
                  <td className={styles.base}>{u.base}</td>
                  <td data-align="num">{u.caseMemberships.length}</td>
                  <td>
                    {isCurrent ? (
                      <Pill size="sm" tone="accent">
                        You
                      </Pill>
                    ) : (
                      <Button size="sm" variant="secondary" icon={<LogIn size={14} aria-hidden="true" />} onClick={() => signInAs(u.id)}>
                        Sign in as<span className="visually-hidden"> {userName(u)}</span>
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.none}>
                  No personas match. Clear the filter to see all {data.users.length}.
                </td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </TableWrap>
    </>
  );
}
