'use client';

import { AGENCIES, type Agency, type Organisation, type User } from '@mas/domain';
import { tKey, useT } from '@mas/messages';
import { AgencyMark, Sheet, SheetBody, SheetHead, Table, TableWrap } from '@mas/ui';
import { useData } from '@/lib/store';
import styles from './Agencies.module.css';
import { SectionHead } from './SectionHead';
import { sectionLabel } from './sections';

const KIND_KEYS: Record<Organisation['kind'], string> = {
  council: 'council',
  hscp: 'hscp',
  'health-board': 'healthBoard',
  police: 'police',
  'third-sector': 'thirdSector',
  sps: 'sps',
  scra: 'scra',
  court: 'court',
  regulator: 'regulator',
  'fire-rescue': 'fireRescue',
};

const kindLabel = (kind: Organisation['kind']) => tKey(`admin.agencies.kind.${KIND_KEYS[kind]}`);

const KIND_AGENCY: Record<Organisation['kind'], Agency> = {
  council: 'social-work',
  hscp: 'social-work',
  'health-board': 'health',
  police: 'police',
  'third-sector': 'third-sector',
  sps: 'sps',
  scra: 'scra',
  court: 'court',
  regulator: 'regulator',
  'fire-rescue': 'fire-rescue',
};

function agenciesOf(users: User[]): Agency[] {
  return AGENCIES.filter((a) => users.some((u) => u.agency === a));
}

/** Read-only: organisations and teams come from the seed, as a directory would supply them. */
export function Agencies() {
  const t = useT();
  const data = useData();
  const orgs = data.organisations;

  return (
    <>
      <SectionHead title={sectionLabel('agencies')} lede={t('admin.agencies.lede', { organisations: orgs.length, teams: data.teams.length })} />
      <div className="stack">
        {orgs.map((org) => {
          const teams = data.teams.filter((t) => t.organisationId === org.id);
          const members = data.users.filter((u) => u.organisationId === org.id);
          const agencies = agenciesOf(members);
          return (
            <Sheet key={org.id}>
              <SheetHead
                title={
                  <span className={styles.orgTitle}>
                    <AgencyMark agency={agencies[0] ?? KIND_AGENCY[org.kind]} hideLabel glyphSize={20} />
                    {org.name}
                  </span>
                }
                meta={t('admin.agencies.orgMeta', { kind: kindLabel(org.kind), teams: teams.length, members: members.length, shortName: org.shortName })}
                divided
              />
              <SheetBody flush>
                <TableWrap label={t('admin.agencies.tableLabel', { shortName: org.shortName })} className={styles.wrap}>
                  <Table>
                    <thead>
                      <tr>
                        <th scope="col">{t('admin.agencies.columns.team')}</th>
                        <th scope="col">{t('admin.agencies.columns.base')}</th>
                        <th scope="col">{t('admin.agencies.columns.agencies')}</th>
                        <th scope="col" data-align="num">
                          {t('admin.agencies.columns.members')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((team) => {
                        const teamMembers = members.filter((u) => u.teamId === team.id);
                        const teamAgencies = agenciesOf(teamMembers);
                        return (
                          <tr key={team.id}>
                            <td className={styles.team}>{team.name}</td>
                            <td>{team.base}</td>
                            <td>
                              <div className={styles.marks}>{teamAgencies.length > 0 ? teamAgencies.map((a) => <AgencyMark key={a} agency={a} />) : <span className={styles.muted}>{t('admin.agencies.noPersonas')}</span>}</div>
                            </td>
                            <td data-align="num">{teamMembers.length}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </TableWrap>
              </SheetBody>
            </Sheet>
          );
        })}
      </div>
    </>
  );
}
