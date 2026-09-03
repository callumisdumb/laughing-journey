'use client';

import { EXCLUSION_PARTY_LABELS, type ExclusionParty, type MustNotReceiveEntryInput } from '@mas/domain';
import { useT } from '@mas/messages';
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
  const t = useT();
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
      <legend className={styles.legend}>{t('forms.mustNotReceive.question')}</legend>
      <p className={styles.hint} id={hintId}>
        {t('forms.mustNotReceive.hint')}
      </p>
      <p className={styles.count} aria-live="polite">
        {t('forms.mustNotReceive.count', { count: fields.length })}
      </p>
      {fields.length > 0 ? (
        <ol className={styles.entries}>
          {fields.map((field, i) => {
            const rowErrors = errors.mustNotReceive?.[i];
            return (
              <li key={field.id} className={styles.entry} data-state={rowErrors ? 'invalid' : undefined}>
                <div className={styles.entryHead}>
                  <span className={styles.entryTitle}>{t('forms.mustNotReceive.person', { n: i + 1 })}</span>
                  <Button size="sm" variant="quiet" icon={<X size={14} aria-hidden="true" />} aria-label={t('forms.mustNotReceive.removeLabel', { n: i + 1 })} onClick={() => removeEntry(i)}>
                    {t('forms.mustNotReceive.remove')}
                  </Button>
                </div>
                <TextField label={t('forms.mustNotReceive.name.label')} required autoComplete="off" {...register(`mustNotReceive.${i}.name`)} error={rowErrors?.name?.message} />
                <TextField label={t('forms.mustNotReceive.relationship.label')} autoComplete="off" hint={relationshipHint} {...register(`mustNotReceive.${i}.relationship`)} error={rowErrors?.relationship?.message} />
                <SelectField label={t('forms.mustNotReceive.party.label')} required options={options} {...register(`mustNotReceive.${i}.party`)} error={rowErrors?.party?.message} />
                <div className={styles.full}>
                  <TextareaField label={t('forms.mustNotReceive.reason.label')} required hint={t('forms.mustNotReceive.reason.hint')} {...register(`mustNotReceive.${i}.reason`)} error={rowErrors?.reason?.message} />
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
      <div>
        <Button id={addId} size="sm" icon={<Plus size={14} aria-hidden="true" />} onClick={add}>
          {t('forms.mustNotReceive.add')}
        </Button>
      </div>
    </fieldset>
  );
}
