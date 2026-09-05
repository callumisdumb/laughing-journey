'use client';

import { findDuplicateCandidates, type Person } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, Pill, TextField } from '@mas/ui';
import { Search, UserPlus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AddPersonDialog } from '@/features/person/AddPersonDialog';
import { reasonKey, reasonLabel } from '@/features/person/reasons';
import { fullName } from '@/lib/selectors';
import { useData } from '@/lib/store';
import styles from './PersonPicker.module.css';

/**
 * Choosing a person a form needs, which is the same search the create path uses.
 *
 * A picker with its own matching would be a second answer to "is this the same person", and the two
 * would drift. So this runs `findDuplicateCandidates` over the same query fields and shows the same
 * reasons: a practitioner looking for Aiden Boyle sees why each name came back, which is what tells
 * them they have the right one before they attach a case to it.
 *
 * Adding a person from here opens the create dialog nested rather than sending the user away with a
 * half-filled form behind them. There is no quick path through it: the nested dialog is the same
 * dialog, with the same mandatory search, and it returns with the new person selected.
 */
export function PersonPicker({
  label,
  value,
  onChange,
  exclude = [],
  allowCreate = true,
  hint,
  idPrefix = 'person-picker',
}: {
  label: string;
  value: Person | null;
  onChange: (person: Person | null) => void;
  /** Ids that cannot be chosen, such as the record the picker is on. */
  exclude?: string[];
  allowCreate?: boolean;
  hint?: string;
  idPrefix?: string;
}) {
  const t = useT();
  const data = useData();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);

  /*
   * One field rather than five. A picker is not the create path: the reader is looking for somebody
   * they believe exists, and a name or a date of birth is what they have in mind. The query is split
   * on whether it looks like a date so the same box serves both.
   */
  const candidates = useMemo(() => {
    const text = query.trim();
    if (text.length < 2) return [];
    const isDate = /^[\d/-]+$/.test(text);
    const parts = text.split(/\s+/);
    const found = findDuplicateCandidates(data.people, data.addresses, {
      givenName: isDate ? undefined : parts[0],
      familyName: isDate || parts.length < 2 ? (parts.length < 2 && !isDate ? parts[0] : undefined) : parts.slice(1).join(' '),
      dateOfBirth: isDate ? text : undefined,
      chi: /^\d{6,10}$/.test(text) ? text : undefined,
    });
    return found.filter((c) => !exclude.includes(c.person.id)).slice(0, 8);
  }, [query, data.people, data.addresses, exclude]);

  if (value) {
    return (
      <div className={styles.picker}>
        <span className={styles.label} id={`${idPrefix}-label`}>
          {label}
        </span>
        <div className={styles.chosen} data-testid={`${idPrefix}-chosen`}>
          <span className={styles.chosenName}>{fullName(value)}</span>
          <span className={styles.chosenMeta}>{value.dateOfBirth ?? value.expectedDeliveryDate ?? t('person.picker.noDateOfBirth')}</span>
          <Button size="sm" variant="quiet" icon={<X size={14} aria-hidden="true" />} onClick={() => onChange(null)}>
            {t('person.picker.change')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.picker}>
      <TextField
        label={label}
        hint={hint ?? t('person.picker.hint')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        type="search"
        autoComplete="off"
        data-testid={`${idPrefix}-query`}
      />

      {query.trim().length >= 2 ? (
        <>
          <ul className={styles.results} aria-label={t('person.picker.resultsLabel', { count: candidates.length })} data-testid={`${idPrefix}-results`}>
            {candidates.map((candidate) => (
              <li key={candidate.person.id}>
                <button type="button" className={styles.result} onClick={() => onChange(candidate.person)}>
                  <span className={styles.resultName}>{fullName(candidate.person)}</span>
                  <span className={styles.resultMeta}>{candidate.person.dateOfBirth ?? candidate.person.expectedDeliveryDate ?? t('person.picker.noDateOfBirth')}</span>
                  <span className={styles.resultReasons}>
                    {candidate.reasons.slice(0, 3).map((reason) => (
                      <Pill key={reasonKey(reason)} size="sm" tone="outline">
                        {reasonLabel(reason)}
                      </Pill>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {candidates.length === 0 ? (
            <p className={styles.none}>
              <Search size={14} aria-hidden="true" /> {t('person.picker.none')}
            </p>
          ) : null}
        </>
      ) : null}

      {allowCreate ? (
        <Button size="sm" variant="secondary" icon={<UserPlus size={14} aria-hidden="true" />} onClick={() => setAdding(true)} data-testid={`${idPrefix}-add`}>
          {t('person.picker.add')}
        </Button>
      ) : null}

      {/*
        Mounted only while it is open. The dialog element is hidden when closed, so leaving it in the
        markup looks free, and it is not: a person record hosts three pickers, so three copies of the
        whole create flow sat in the DOM with duplicate ids on every control in them.
      */}
      {adding ? (
        <AddPersonDialog
          open
          onClose={() => setAdding(false)}
          onCreated={(person) => {
            onChange(person);
            setAdding(false);
          }}
        />
      ) : null}
    </div>
  );
}
