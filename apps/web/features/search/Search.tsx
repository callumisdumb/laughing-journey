'use client';

import { actionStatusLabel, ageLabel, agencyShort, formatDate, formatDateTime, meetingStatusLabel, planTypeLabel, processLabel, stageLabel, type Person } from '@mas/domain';
import { tKey, useT } from '@mas/messages';
import { Pill, ProcessMark } from '@mas/ui';
import { KeyRound, Lock, UserX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScreenState, useDevState, type ScreenStateKind } from '@/components/ScreenState';
import { useRoute } from '@/lib/router';
import { chronologyPath, meetingPath, personPath, practitionerPath, processPath } from '@/lib/routes';
import { searchAll, type SearchHit } from '@/lib/search';
import { useSearchInput } from '@/lib/searchIndex';
import { useSelection, type Selection } from '@/lib/selection';
import { accessForUser, currentAddress, fullName, personById, processesInvolving, userName } from '@/lib/selectors';
import { useConfig, useCurrentUser, useData, useGrants, useNow } from '@/lib/store';
import styles from './Search.module.css';

/**
 * How long the results lag the query.
 *
 * It is a debounce rather than a delay dressed up as one: typing "Docherty" is eight queries and
 * running the index on every keystroke to throw seven of them away is work nobody asked for. The
 * side effect is a real loading state, which the recording needs. Instant results read as canned on
 * video and anything past about 400ms reads as a slow product, so this sits well inside both.
 */
const DEBOUNCE_MS = 220;

/** The reason a result is a result, in the reader's words rather than a field name. */
function matchedOn(hit: SearchHit): string {
  return tKey('search.matchedOn', { what: tKey(`search.matched.${hit.matched}`) });
}

function selectionFor(hit: SearchHit): Selection | null {
  switch (hit.kind) {
    case 'people':
      return { kind: 'person', id: hit.person.id };
    case 'cases':
      return { kind: 'process', id: hit.process.id };
    case 'chronology':
      return { kind: 'event', id: hit.event.id };
    case 'meetings':
      return { kind: 'meeting', id: hit.meeting.id };
    case 'actions':
      return { kind: 'action', id: hit.action.id };
    default:
      return null;
  }
}

/**
 * The open cases a person is on, as the reader is entitled to see them.
 *
 * Brief section 10.4 asks for process badges, restricted indicators and a "you are not on this
 * case" affordance, and the three are one decision: a mark with a stage means the reader can open
 * it, a mark with the note means the case exists and they are not on it, and the lock means they
 * hold no key at all. Showing the mark and leaving the reader to work out which is worse than
 * showing nothing, because it reads as access.
 */
function PersonBadges({ person }: { person: Person }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const grants = useGrants();
  const now = useNow();
  if (!user) return null;
  const processes = processesInvolving(data, person.id).filter((process) => process.status === 'open');
  if (processes.length === 0) return <span className={styles.noProcess}>{t('search.result.noProcess')}</span>;
  return (
    <>
      {processes.map((process) => {
        const access = accessForUser(data, config, user, process, grants, now);
        if (access.level === 'none')
          return (
            <Pill key={process.id} tone="restricted" size="sm" icon={<Lock size={12} aria-hidden="true" />}>
              {t('common.labels.restricted')}
            </Pill>
          );
        if (access.level === 'presence')
          return (
            <span key={process.id} className={styles.notOnCase}>
              <ProcessMark type={process.type} />
              <UserX size={12} aria-hidden="true" /> {t('search.result.notOnCase')}
            </span>
          );
        return <ProcessMark key={process.id} type={process.type} stage={stageLabel(process.type, process.stage)} />;
      })}
    </>
  );
}

function Row({ hit, readable }: { hit: SearchHit; readable: boolean }) {
  const t = useT();
  const data = useData();
  const now = useNow();

  switch (hit.kind) {
    case 'people': {
      const person = hit.person;
      const age = person.dateOfBirth ? t('common.person.ageBorn', { age: ageLabel(person.dateOfBirth, now), date: formatDate(person.dateOfBirth) }) : person.lifeStage === 'unborn' ? t('common.person.unborn') : t('common.person.ageNotRecorded');
      return (
        <>
          <span className={styles.rowTitle}>
            <AppLink href={personPath(person.id)}>{fullName(person)}</AppLink>
          </span>
          <span className={styles.rowMarks}>
            <PersonBadges person={person} />
          </span>
          <span className={styles.rowMeta}>
            {t('search.result.personMeta', { age, address: currentAddress(data, person).line })} {matchedOn(hit)}
          </span>
        </>
      );
    }
    case 'practitioners': {
      const other = hit.user;
      return (
        <>
          <span className={styles.rowTitle}>
            <AppLink href={practitionerPath(other.id)}>{userName(other)}</AppLink>
          </span>
          <span className={styles.rowMeta}>
            {t('search.result.practitionerMeta', { role: other.jobTitle, agency: agencyShort(other.agency), base: other.base })} {matchedOn(hit)}
          </span>
        </>
      );
    }
    case 'cases': {
      const process = hit.process;
      return (
        <>
          <span className={styles.rowTitle}>
            <AppLink href={processPath(process.id)}>{process.reference}</AppLink>
          </span>
          <span className={styles.rowMarks}>
            {readable ? (
              <ProcessMark type={process.type} stage={stageLabel(process.type, process.stage)} />
            ) : (
              <Pill tone="restricted" size="sm" icon={<Lock size={12} aria-hidden="true" />}>
                {t('common.labels.restricted')}
              </Pill>
            )}
          </span>
          <span className={styles.rowMeta}>
            {readable ? t('search.result.caseMeta', { process: processLabel(process.type), stage: stageLabel(process.type, process.stage), agency: agencyShort(process.leadAgency) }) : t('search.result.caseRestricted', { process: processLabel(process.type) })} {matchedOn(hit)}
          </span>
        </>
      );
    }
    case 'chronology': {
      const event = hit.event;
      const subject = personById(data, event.subjectIds[0]);
      return (
        <>
          <span className={styles.rowTitle}>{subject ? <AppLink href={chronologyPath(subject.id)}>{event.title}</AppLink> : event.title}</span>
          <span className={styles.rowMeta}>
            {t('search.result.eventMeta', { date: formatDateTime(event.occurredAt), agency: agencyShort(event.agency), name: event.recordedByName })} {matchedOn(hit)}
          </span>
        </>
      );
    }
    case 'meetings': {
      const meeting = hit.meeting;
      return (
        <>
          <span className={styles.rowTitle}>
            <AppLink href={meetingPath(meeting.id)}>{meeting.title}</AppLink>
          </span>
          <span className={styles.rowMeta}>
            {t('search.result.meetingMeta', { date: formatDateTime(meeting.scheduledAt), location: meeting.location, status: meetingStatusLabel(meeting.status) })} {matchedOn(hit)}
          </span>
        </>
      );
    }
    case 'actions': {
      const action = hit.action;
      return (
        <>
          <span className={styles.rowTitle}>
            <AppLink href={processPath(action.processId)}>{action.title}</AppLink>
          </span>
          <span className={styles.rowMeta}>
            {t('search.result.actionMeta', { owner: action.ownerName, agency: agencyShort(action.ownerAgency), due: formatDate(action.due), status: actionStatusLabel(action.status) })} {matchedOn(hit)}
          </span>
        </>
      );
    }
    case 'plans': {
      const plan = hit.plan;
      return (
        <>
          <span className={styles.rowTitle}>
            <AppLink href={processPath(plan.processId)}>{plan.title}</AppLink>
          </span>
          <span className={styles.rowMeta}>
            {t('search.result.planMeta', { type: planTypeLabel(plan.type), date: formatDate(plan.agreedAt), count: plan.outcomes.length })} {matchedOn(hit)}
          </span>
        </>
      );
    }
  }
}

export function Search() {
  const t = useT();
  const route = useRoute();
  const q = route.query.get('q') ?? '';
  const user = useCurrentUser();
  const select = useSelection((s) => s.select);
  const input = useSearchInput();
  const [settled, setSettled] = useState('');

  useEffect(() => {
    select(null);
  }, [select]);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(q), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  const results = useMemo(() => (input ? searchAll(input, settled, 10) : null), [input, settled]);
  const dev = useDevState();
  // The loading state is the debounce showing through rather than a spinner somebody added: the
  // results lag the query by DEBOUNCE_MS and this is what the screen looks like in between.
  const searching = q.trim().length >= 2 && settled !== q;
  const state: ScreenStateKind = dev ?? (searching || !results ? 'loading' : results.total === 0 && q.trim().length >= 2 ? 'empty' : 'ready');

  if (!user) return null;

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>{t('search.head.title')}</h1>
          <p className="page-lede">{q.length < 2 ? t('search.head.prompt') : searching || !results ? t('search.loading') : t('search.head.results', { count: results.total, query: q })}</p>
        </div>
      </div>
      {results && results.unsearchableCases > 0 ? (
        <p className={styles.note}>
          <KeyRound size={16} aria-hidden="true" />
          {t('search.unsearchable', { count: results.unsearchableCases })}
        </p>
      ) : null}
      <ScreenState state={state} empty={{ title: t('search.empty.title'), text: t('search.empty.text') }}>
        <div className={styles.groups} data-testid="search-groups">
          {(results?.groups ?? []).map((group) => (
            <section key={group.kind} className={styles.group} aria-label={tKey(`search.groups.${group.kind}`)}>
              <div className={styles.groupHead}>
                <h2 className={styles.groupName}>{tKey(`search.groups.${group.kind}`)}</h2>
                <span className={styles.groupCount}>{group.total}</span>
              </div>
              <ul className={styles.rows}>
                {group.hits.map((hit) => (
                  <li key={hit.id} className={styles.row} onMouseEnter={() => select(selectionFor(hit))}>
                    <Row hit={hit} readable={hit.kind !== 'cases' || (input?.readableCaseIds.has(hit.process.id) ?? false)} />
                  </li>
                ))}
              </ul>
              {group.total > group.hits.length ? <p className={styles.more}>{t('search.groups.more', { count: group.total - group.hits.length })}</p> : null}
            </section>
          ))}
        </div>
      </ScreenState>
    </div>
  );
}
