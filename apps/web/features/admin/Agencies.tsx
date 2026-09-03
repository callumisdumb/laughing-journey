'use client';

import { AGENCIES, type Agency, type Organisation, type User } from '@mas/domain';
import { AgencyMark, Sheet, SheetBody, SheetHead, Table, TableWrap } from '@mas/ui';
import { useData } from '@/lib/store';
import styles from './Agencies.module.css';
import { SectionHead } from './SectionHead';

const KIND_LABELS: Record<Organisation['kind'], string> = {
  council: 'Council',
  hscp: 'Health and Social Care Partnership',
  'health-board': 'Health board',
  police: 'Police',
  'third-sector': 'Third sector',
  sps: 'Scottish Prison Service',
  scra: "Scottish Children's Reporter Administration",
  court: 'Court and prosecution',
  regulator: 'Regulator',
  'fire-rescue': 'Fire and rescue',
};

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
  const data = useData();
  const orgs = data.organisations;

  return (
    <>
      <SectionHead title="Agencies" lede={`${orgs.length} organisations and ${data.teams.length} teams as the seed holds them. A live system would take these from each organisation's directory, so they are read-only here.`} />
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
                meta={`${KIND_LABELS[org.kind]}. ${teams.length} ${teams.length === 1 ? 'team' : 'teams'}, ${members.length} ${members.length === 1 ? 'persona' : 'personas'}. Short name: ${org.shortName}.`}
                divided
              />
              <SheetBody flush>
                <TableWrap label={`${org.shortName} teams`} className={styles.wrap}>
                  <Table>
                    <thead>
                      <tr>
                        <th scope="col">Team</th>
                        <th scope="col">Base</th>
                        <th scope="col">Agencies</th>
                        <th scope="col" data-align="num">
                          Members
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((t) => {
                        const teamMembers = members.filter((u) => u.teamId === t.id);
                        const teamAgencies = agenciesOf(teamMembers);
                        return (
                          <tr key={t.id}>
                            <td className={styles.team}>{t.name}</td>
                            <td>{t.base}</td>
                            <td>
                              <div className={styles.marks}>{teamAgencies.length > 0 ? teamAgencies.map((a) => <AgencyMark key={a} agency={a} />) : <span className={styles.muted}>No personas</span>}</div>
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
