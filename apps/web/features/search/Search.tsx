'use client';

import { PROCESS_SHORT, ageLabel, formatDate, stageLabel } from '@mas/domain';
import { EmptyState, Pill, ProcessMark, Sheet, SheetBody, SheetHead } from '@mas/ui';
import { Lock, UserX } from 'lucide-react';
import { useEffect } from 'react';
import { AppLink } from '@/components/AppLink';
import { useRoute } from '@/lib/router';
import { personPath, processPath } from '@/lib/routes';
import { searchDataset } from '@/lib/search';
import { useSelection } from '@/lib/selection';
import { accessForUser, currentAddress, fullName, personById, processesInvolving } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useNow } from '@/lib/store';
import styles from '../people/PeopleList.module.css';

export function Search() {
  const route = useRoute();
  const q = route.query.get('q') ?? '';
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const now = useNow();
  const grants = useAppStore((s) => s.session.breakGlass);
  const select = useSelection((s) => s.select);
  const hits = searchDataset(data, q);

  useEffect(() => {
    select(null);
  }, [select]);

  if (!user) return null;

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>Search</h1>
          <p className="page-lede">{q.length < 2 ? 'Type at least two characters in the search box: a name, alias, date of birth, CHI number, address or reference.' : `${hits.length} ${hits.length === 1 ? 'result' : 'results'} for "${q}"`}</p>
        </div>
      </div>
      {q.length >= 2 && hits.length === 0 ? <EmptyState title="No matches" text="Check the spelling, or try a date of birth as dd/mm/yyyy, a postcode, or a reference like CP-2026-0412. People you cannot see at all are not listed." /> : null}
      <div className="stack">
        {hits.map((h) => {
          if (h.kind === 'process') {
            const access = accessForUser(data, config, user, h.process, grants, now);
            const subject = personById(data, h.process.subjectIds[0]);
            return (
              <Sheet key={h.process.id} onMouseEnter={() => select({ kind: 'process', id: h.process.id })}>
                <SheetHead
                  title={<AppLink href={processPath(h.process.id)}>{h.process.reference}</AppLink>}
                  meta={`${PROCESS_SHORT[h.process.type]}: ${access.level === 'none' ? 'restricted' : subject ? fullName(subject) : h.process.title}. Matched on ${h.matched}.`}
                  actions={access.level === 'none' ? <Pill tone="restricted" icon={<Lock size={12} aria-hidden="true" />}>Restricted</Pill> : <ProcessMark type={h.process.type} stage={stageLabel(h.process.type, h.process.stage)} />}
                />
              </Sheet>
            );
          }
          const p = h.person;
          const processes = processesInvolving(data, p.id).filter((x) => x.status === 'open');
          const address = currentAddress(data, p);
          return (
            <Sheet key={p.id} onMouseEnter={() => select({ kind: 'person', id: p.id })}>
              <SheetHead
                title={<AppLink href={personPath(p.id)}>{fullName(p)}</AppLink>}
                meta={`${p.dateOfBirth ? `${ageLabel(p.dateOfBirth, now)}, born ${formatDate(p.dateOfBirth)}` : p.lifeStage === 'unborn' ? 'Unborn' : 'Age not recorded'}. ${address.line}. Matched on ${h.matched}.`}
              />
              <SheetBody>
                <span className={styles.badges}>
                  {processes.length === 0 ? <span className={styles.sub}>No open process</span> : null}
                  {processes.map((pr) => {
                    const access = accessForUser(data, config, user, pr, grants, now);
                    if (access.level === 'none')
                      return (
                        <Pill key={pr.id} tone="restricted" size="sm" icon={<Lock size={12} aria-hidden="true" />}>
                          Restricted
                        </Pill>
                      );
                    if (access.level === 'presence')
                      return (
                        <span key={pr.id} className={styles.notOnCase}>
                          <ProcessMark type={pr.type} />
                          <UserX size={12} aria-hidden="true" /> you are not on this case
                        </span>
                      );
                    return <ProcessMark key={pr.id} type={pr.type} stage={stageLabel(pr.type, pr.stage)} />;
                  })}
                </span>
              </SheetBody>
            </Sheet>
          );
        })}
      </div>
    </div>
  );
}
