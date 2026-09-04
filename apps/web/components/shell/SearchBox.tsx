'use client';

import { ageLabel, agencyShort, formatDate, processLabel, stageLabel } from '@mas/domain';
import { tKey, useT } from '@mas/messages';
import { Pill, ProcessMark } from '@mas/ui';
import { Lock, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate, useRoute } from '@/lib/router';
import { flatHits, hitHref, hitTitle, searchAll, type SearchHit } from '@/lib/search';
import { useSearchInput } from '@/lib/searchIndex';
import { currentAddress } from '@/lib/selectors';
import { useCurrentUser, useData, useNow } from '@/lib/store';
import styles from './SearchBox.module.css';

/** How many suggestions the list offers before the reader is sent to the full results. */
const SUGGESTIONS = 8;

/** The process mark, or the refusal, for a case suggestion. Nothing at all for anything else. */
function Marks({ hit, readable }: { hit: SearchHit; readable: boolean }) {
  const t = useT();
  if (hit.kind !== 'cases') return null;
  return readable ? (
    <ProcessMark type={hit.process.type} stage={stageLabel(hit.process.type, hit.process.stage)} />
  ) : (
    <Pill tone="restricted" size="sm" icon={<Lock size={12} aria-hidden="true" />}>
      {t('common.labels.restricted')}
    </Pill>
  );
}

/** One line saying what this is and why it matched. A suggestion that says neither is a guess. */
function Meta({ hit, readable }: { hit: SearchHit; readable: boolean }) {
  const t = useT();
  const data = useData();
  const now = useNow();
  const what = tKey('search.matchedOn', { what: tKey(`search.matched.${hit.matched}`) });
  if (hit.kind === 'people') {
    const person = hit.person;
    const age = person.dateOfBirth ? t('common.person.ageBorn', { age: ageLabel(person.dateOfBirth, now), date: formatDate(person.dateOfBirth) }) : t('common.person.unborn');
    return <>{`${t('search.result.personMeta', { age, address: currentAddress(data, person).line })} ${what}`}</>;
  }
  if (hit.kind === 'cases') {
    const meta = readable ? t('search.result.caseMeta', { process: processLabel(hit.process.type), stage: stageLabel(hit.process.type, hit.process.stage), agency: agencyShort(hit.process.leadAgency) }) : t('search.result.caseRestricted', { process: processLabel(hit.process.type) });
    return <>{`${meta} ${what}`}</>;
  }
  return <>{what}</>;
}

/**
 * Global search with a typeahead listbox.
 *
 * The list is flat rather than grouped, and each option carries a type tag instead. Grouping the
 * suggestions would mean nesting `role="group"` inside the listbox for eight rows, which buys a
 * heading a keyboard user cannot land on and complicates the one interaction that has to be
 * perfect. The results screen is where grouping earns its place; here the tag says what a row is
 * and the arrow keys walk every row in the same order the groups would have been.
 *
 * The last option is not a footnote. "See all results" used to be a `role="presentation"` line,
 * which meant the one route out of a suggestion list that has not found the record was reachable by
 * mouse and by Enter and by nothing else. It is an option now.
 */
export function SearchBox() {
  const t = useT();
  const id = useId();
  const navigate = useNavigate();
  const route = useRoute();
  const user = useCurrentUser();
  const input = useSearchInput();
  const [q, setQ] = useState(route.query.get('q') ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = q.trim();
  const results = useMemo(() => (input && query.length >= 2 ? searchAll(input, query, 3) : null), [input, query]);
  const hits = useMemo(() => (results ? flatHits(results).slice(0, SUGGESTIONS) : []), [results]);
  const showing = open && query.length >= 2 && user !== null;
  // One past the last hit is "see all results", which is why the list can be open with no hits.
  const optionCount = showing ? hits.length + 1 : 0;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Control and K from anywhere. Search is the first thing anybody tries, and reaching for the
  // mouse to do it is the difference between a product that feels quick and one that does not.
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key.toLowerCase() !== 'k' || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
      setOpen(true);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  function go(index: number) {
    setOpen(false);
    const hit = hits[index];
    if (!hit) {
      navigate(`/search?q=${encodeURIComponent(query)}`);
      return;
    }
    navigate(hitHref(hit));
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, Math.max(optionCount - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Home' && open) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End' && open) {
      e.preventDefault();
      setActive(Math.max(optionCount - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(open ? active : -1);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const showAllIndex = hits.length;

  return (
    <div className={styles.box} ref={boxRef}>
      <span className={styles.icon}>
        <Search size={16} aria-hidden="true" />
      </span>
      <label htmlFor={`${id}-input`} className="visually-hidden">
        {t('nav.search.label')}
      </label>
      <span id={hintId} className="visually-hidden">
        {t('nav.search.shortcut')}
      </span>
      <input
        id={`${id}-input`}
        ref={inputRef}
        className={styles.input}
        type="search"
        role="combobox"
        aria-expanded={showing}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-describedby={hintId}
        aria-keyshortcuts="Control+K"
        aria-activedescendant={showing ? `${id}-opt-${active}` : undefined}
        placeholder={t('nav.search.placeholder')}
        autoComplete="off"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
      />
      {showing ? (
        <ul className={styles.list} role="listbox" id={listId} aria-label={t('nav.search.suggestions')}>
          {hits.map((hit, i) => (
            <li key={hit.id} id={`${id}-opt-${i}`} role="option" aria-selected={i === active} className={styles.option} onMouseDown={() => go(i)} onMouseEnter={() => setActive(i)}>
              <span className={styles.optionName}>{hitTitle(hit)}</span>
              <span className={styles.optionMarks}>
                <Marks hit={hit} readable={hit.kind !== 'cases' || (input?.readableCaseIds.has(hit.process.id) ?? false)} />
              </span>
              <span className={styles.optionMeta}>
                <span className={styles.tag}>{tKey(`search.groups.${hit.kind}`)}</span>
                <Meta hit={hit} readable={hit.kind !== 'cases' || (input?.readableCaseIds.has(hit.process.id) ?? false)} />
              </span>
            </li>
          ))}
          <li id={`${id}-opt-${showAllIndex}`} role="option" aria-selected={showAllIndex === active} className={styles.showAll} onMouseDown={() => go(-1)} onMouseEnter={() => setActive(showAllIndex)}>
            {t('nav.search.showAllOption', { query })}
          </li>
        </ul>
      ) : null}
    </div>
  );
}
