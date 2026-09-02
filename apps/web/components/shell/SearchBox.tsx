'use client';

import { PROCESS_SHORT, ageLabel, formatDate, stageLabel } from '@mas/domain';
import { Pill, ProcessMark } from '@mas/ui';
import { Lock, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate, useRoute } from '@/lib/router';
import { personPath, processPath } from '@/lib/routes';
import { searchDataset, type SearchHit } from '@/lib/search';
import { accessForUser, currentAddress, fullName, processesInvolving } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useNow } from '@/lib/store';
import styles from './SearchBox.module.css';

/** Global search with a typeahead listbox: name, alias, date of birth, CHI, address, reference. */
export function SearchBox() {
  const id = useId();
  const navigate = useNavigate();
  const route = useRoute();
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const now = useNow();
  const grants = useAppStore((s) => s.session.breakGlass);
  const [q, setQ] = useState(route.query.get('q') ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const hits = open && q.trim().length >= 2 ? searchDataset(data, q, 8) : [];

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function go(hit: SearchHit | undefined) {
    setOpen(false);
    if (!hit) {
      navigate(`/search?q=${encodeURIComponent(q.trim())}`);
      return;
    }
    navigate(hit.kind === 'person' ? personPath(hit.person.id) : processPath(hit.process.id));
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, Math.max(hits.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(open ? hits[active] : undefined);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const listId = `${id}-list`;

  return (
    <div className={styles.box} ref={boxRef}>
      <span className={styles.icon}>
        <Search size={16} aria-hidden="true" />
      </span>
      <label htmlFor={`${id}-input`} className="visually-hidden">
        Search people, cases and reference numbers
      </label>
      <input
        id={`${id}-input`}
        className={styles.input}
        type="search"
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && hits[active] ? `${id}-opt-${active}` : undefined}
        placeholder="Search people, cases, reference numbers"
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
      {open && hits.length > 0 && user ? (
        <ul className={styles.list} role="listbox" id={listId} aria-label="Search suggestions">
          {hits.map((h, i) => {
            if (h.kind === 'process') {
              const access = accessForUser(data, config, user, h.process, grants, now);
              return (
                <li key={h.process.id} id={`${id}-opt-${i}`} role="option" aria-selected={i === active} className={styles.option} onMouseDown={() => go(h)} onMouseEnter={() => setActive(i)}>
                  <span className={styles.optionName}>{h.process.reference}</span>
                  <span className={styles.optionMarks}>{access.level === 'none' ? <Pill tone="restricted" size="sm" icon={<Lock size={12} aria-hidden="true" />}>Restricted</Pill> : <ProcessMark type={h.process.type} stage={stageLabel(h.process.type, h.process.stage)} />}</span>
                  <span className={styles.optionMeta}>
                    {PROCESS_SHORT[h.process.type]} process. Matched on {h.matched}.
                  </span>
                </li>
              );
            }
            const p = h.person;
            const processes = processesInvolving(data, p.id).filter((x) => x.status === 'open');
            return (
              <li key={p.id} id={`${id}-opt-${i}`} role="option" aria-selected={i === active} className={styles.option} onMouseDown={() => go(h)} onMouseEnter={() => setActive(i)}>
                <span className={styles.optionName}>{fullName(p)}</span>
                <span className={styles.optionMarks}>
                  {processes.slice(0, 3).map((pr) => {
                    const access = accessForUser(data, config, user, pr, grants, now);
                    return access.level === 'none' ? <Pill key={pr.id} tone="restricted" size="sm" icon={<Lock size={12} aria-hidden="true" />}>Restricted</Pill> : <ProcessMark key={pr.id} type={pr.type} />;
                  })}
                </span>
                <span className={styles.optionMeta}>
                  {p.dateOfBirth ? `${ageLabel(p.dateOfBirth, now)}, born ${formatDate(p.dateOfBirth)}` : 'Unborn'}. {currentAddress(data, p).line}. Matched on {h.matched}.
                </span>
              </li>
            );
          })}
          <li className={styles.footer} role="presentation">
            Press Enter to see all results
          </li>
        </ul>
      ) : null}
    </div>
  );
}
