'use client';

import { CLASSIFICATIONS, type Classification } from '@mas/domain';
import { Button, Sheet, SheetBody, SheetHead, TextField, TextareaField } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import styles from './Markings.module.css';
import { SectionHead } from './SectionHead';
import { useAdminConfig } from './useAdminConfig';

const MARKING_TITLES: Record<Classification, string> = {
  official: 'Official',
  'official-sensitive': 'Official-sensitive',
  restricted: 'Restricted',
};
const MARKING_USE: Record<Classification, string> = {
  official: 'Routine business records with no case content.',
  'official-sensitive': 'Every person and process record by default.',
  restricted: 'MAPPA and other records on a distribution list. Shown as a banner on the process screen; every read is audited.',
};

const markingsSchema = z.object({
  markings: z.array(
    z.object({
      id: z.enum(CLASSIFICATIONS),
      label: z.string().trim().min(2, 'Enter the marking text').max(60, 'Keep the marking under 60 characters'),
      handling: z.string().trim().min(5, 'Say how records with this marking are handled').max(400),
    }),
  ),
});
type MarkingsValues = z.infer<typeof markingsSchema>;

export function Markings() {
  const { config, canEdit, save } = useAdminConfig();
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const form = useForm<MarkingsValues>({ resolver: zodResolver(markingsSchema), defaultValues: { markings: config.classificationMarkings } });
  const live = form.watch('markings');
  const errors = form.formState.errors;

  function submit(values: MarkingsValues) {
    const result = save({ ...config, classificationMarkings: values.markings }, 'markings', `Classification markings: ${values.markings.map((m) => m.label).join(', ')}`);
    setSaveErrors(result.errors);
    if (result.ok) form.reset(values);
  }

  return (
    <>
      <SectionHead
        title="Markings"
        lede="Classification markings and their handling instructions. The banner preview is what practitioners see across the top of a restricted record."
        actions={
          <>
            <Button variant="quiet" disabled={!form.formState.isDirty} onClick={() => form.reset({ markings: config.classificationMarkings })}>
              Discard changes
            </Button>
            <Button variant="primary" disabled={!canEdit || !form.formState.isDirty} onClick={() => void form.handleSubmit(submit)()}>
              Save markings
            </Button>
          </>
        }
      />
      <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
        {config.classificationMarkings.map((m, i) => {
          const label = live[i]?.label?.trim() || m.label;
          return (
            <Sheet key={m.id}>
              <SheetHead title={MARKING_TITLES[m.id]} meta={MARKING_USE[m.id]} headingLevel={2} />
              <SheetBody>
                <div className={styles.banner} data-level={m.id} role="note" aria-label={`Banner preview: ${label}`}>
                  {label}
                </div>
                <div className={styles.fields}>
                  <TextField label="Marking text" required disabled={!canEdit} maxLength={60} {...form.register(`markings.${i}.label`)} error={errors.markings?.[i]?.label?.message} />
                  <TextareaField label="Handling instruction" required disabled={!canEdit} maxLength={400} {...form.register(`markings.${i}.handling`)} error={errors.markings?.[i]?.handling?.message} />
                </div>
              </SheetBody>
            </Sheet>
          );
        })}
        {saveErrors.length > 0 ? (
          <ul className={styles.errors} role="alert">
            {saveErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
      </form>
    </>
  );
}
