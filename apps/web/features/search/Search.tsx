'use client';

import { PROCESS_SHORT, ageLabel, formatDate, stageLabel } from '@mas/domain';
import { useT } from '@mas/messages';
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
  const t = useT();
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
          <h1>{t('search.head.title')}</h1>
          <p className="page-lede">{q.length < 2 ? t('search.head.prompt') : t('search.head.results', { count: hits.length, query: q })}</p>
        </div>
      </div>
      {q.length >= 2 && hits.length === 0 ? <EmptyState title={t('search.empty.title')} text={t('search.empty.text')} /> : null}
      <div className="stack">
        {hits.map((h) => {
          if (h.kind === 'process') {
            const access = accessForUser(data, config, user, h.process, grants, now);
            const subject = personById(data, h.process.subjectIds[0]);
            const subjectText = access.level === 'none' ? t('search.result.restrictedSubject') : subject ? fullName(subject) : h.process.title;
            return (
              <Sheet key={h.process.id} onMouseEnter={() => select({ kind: 'process', id: h.process.id })}>
                <SheetHead
                  title={<AppLink href={processPath(h.process.id)}>{h.process.reference}</AppLink>}
                  meta={t('search.result.processMeta', { process: PROCESS_SHORT[h.process.type], subject: subjectText, matched: h.matched })}
                  actions={access.level === 'none' ? <Pill tone="restricted" icon={<Lock size={12} aria-hidden="true" />}>{t('common.labels.restricted')}</Pill> : <ProcessMark type={h.process.type} stage={stageLabel(h.process.type, h.process.stage)} />}
                />
              </Sheet>
            );
          }
          const p = h.person;
          const processes = processesInvolving(data, p.id).filter((x) => x.status === 'open');
          const address = currentAddress(data, p);
          const age = p.dateOfBirth ? t('common.person.ageBorn', { age: ageLabel(p.dateOfBirth, now), date: formatDate(p.dateOfBirth) }) : p.lifeStage === 'unborn' ? t('common.person.unborn') : t('common.person.ageNotRecorded');
          return (
            <Sheet key={p.id} onMouseEnter={() => select({ kind: 'person', id: p.id })}>
              <SheetHead
                title={<AppLink href={personPath(p.id)}>{fullName(p)}</AppLink>}
                meta={t('search.result.personMeta', { age, address: address.line, matched: h.matched })}
              />
              <SheetBody>
                <span className={styles.badges}>
                  {processes.length === 0 ? <span className={styles.sub}>{t('search.result.noProcess')}</span> : null}
                  {processes.map((pr) => {
                    const access = accessForUser(data, config, user, pr, grants, now);
                    if (access.level === 'none')
                      return (
                        <Pill key={pr.id} tone="restricted" size="sm" icon={<Lock size={12} aria-hidden="true" />}>
                          {t('common.labels.restricted')}
                        </Pill>
                      );
                    if (access.level === 'presence')
                      return (
                        <span key={pr.id} className={styles.notOnCase}>
                          <ProcessMark type={pr.type} />
                          <UserX size={12} aria-hidden="true" /> {t('search.result.notOnCase')}
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
