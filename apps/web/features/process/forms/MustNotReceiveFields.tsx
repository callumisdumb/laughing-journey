'use client';

import { EXCLUSION_PARTY_LABELS, MUST_NOT_RECEIVE_QUESTION, type ExclusionParty, type MustNotReceiveEntryInput } from '@mas/domain';
import { Button, SelectField, TextField, TextareaField } from '@mas/ui';
import { Plus, X } from 'lucide-react';
import { useId } from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import styles from './MustNotReceiveFields.module.css';

/** The slice of a referral form that carries the question. The dialog supplies the rest through FormProvider. */
export interface MustNotReceiveValues {
  mustNotReceive: MustNotReceiveEntryInput[];
}

export function MustNotReceiveFields({ parties, relationshipHint }: { parties: readonly [ExclusionParty, ...ExclusionParty[]]; relationshipHint: string }) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<MustNotReceiveValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'mustNotReceive' });
  const hintId = useId();
  const addId = useId();
  const options = parties.map((p) => ({ value: p, label: EXCLUSION_PARTY_LABELS[p] }));

  function add() {
    append({ name: '', relationship: '', party: parties[0], reason: '' }, { shouldFocus: true });
  }

  function removeEntry(index: number) {
    remove(index);
    // The row's own button is gone; keep keyboard focus inside the section.
    document.getElementById(addId)?.focus();
  }

  return (
    <fieldset className={styles.group} aria-describedby={hintId}>
      <legend className={styles.legend}>{MUST_NOT_RECEIVE_QUESTION}</legend>
      <p className={styles.hint} id={hintId}>
        Anyone the record does not already link to the perpetrator, or a victim who must not hear of the process through it. Each entry goes on the case-role register with your name and the reason.
      </p>
      <p className={styles.count} aria-live="polite">
        {fields.length === 0 ? 'No one added.' : `${fields.length === 1 ? '1 person' : `${fields.length} people`} will go on the register when you save.`}
      </p>
      {fields.length > 0 ? (
        <ol className={styles.entries}>
          {fields.map((field, i) => {
            const rowErrors = errors.mustNotReceive?.[i];
            return (
              <li key={field.id} className={styles.entry} data-state={rowErrors ? 'invalid' : undefined}>
                <div className={styles.entryHead}>
                  <span className={styles.entryTitle}>Person {i + 1}</span>
                  <Button size="sm" variant="quiet" icon={<X size={14} aria-hidden="true" />} aria-label={`Remove person ${i + 1}`} onClick={() => removeEntry(i)}>
                    Remove
                  </Button>
                </div>
                <TextField label="Name" required autoComplete="off" {...register(`mustNotReceive.${i}.name`)} error={rowErrors?.name?.message} />
                <TextField label="Relationship to the case" autoComplete="off" hint={relationshipHint} {...register(`mustNotReceive.${i}.relationship`)} error={rowErrors?.relationship?.message} />
                <SelectField label="Excluded as" required options={options} {...register(`mustNotReceive.${i}.party`)} error={rowErrors?.party?.message} />
                <div className={styles.full}>
                  <TextareaField label="Reason" required hint="Recorded on the register beside your name." {...register(`mustNotReceive.${i}.reason`)} error={rowErrors?.reason?.message} />
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
      <div>
        <Button id={addId} size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={add}>
          Add a person
        </Button>
      </div>
    </fieldset>
  );
}
