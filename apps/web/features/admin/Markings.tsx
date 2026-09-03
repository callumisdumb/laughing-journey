'use client';

import { CLASSIFICATIONS, type Classification } from '@mas/domain';
import { tKey, useT, type Translator } from '@mas/messages';
import { Button, Sheet, SheetBody, SheetHead, TextField, TextareaField } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import styles from './Markings.module.css';
import { SectionHead } from './SectionHead';
import { sectionLabel } from './sections';
import { useAdminConfig } from './useAdminConfig';

const MARKING_KEYS: Record<Classification, string> = { official: 'official', 'official-sensitive': 'officialSensitive', restricted: 'restricted' };
const markingTitle = (id: Classification) => tKey(`admin.markings.${MARKING_KEYS[id]}.title`);
const markingUse = (id: Classification) => tKey(`admin.markings.${MARKING_KEYS[id]}.use`);

function markingsSchema(t: Translator) {
  return z.object({
    markings: z.array(
      z.object({
        id: z.enum(CLASSIFICATIONS),
        label: z.string().trim().min(2, t('admin.markings.errors.textMin')).max(60, t('admin.markings.errors.textMax')),
        handling: z.string().trim().min(5, t('admin.markings.errors.handlingMin')).max(400),
      }),
    ),
  });
}
type MarkingsValues = z.infer<ReturnType<typeof markingsSchema>>;

export function Markings() {
  const t = useT();
  const { config, canEdit, save } = useAdminConfig();
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const schema = useMemo(() => markingsSchema(t), [t]);
  const form = useForm<MarkingsValues>({ resolver: zodResolver(schema), defaultValues: { markings: config.classificationMarkings } });
  const live = form.watch('markings');
  const errors = form.formState.errors;

  function submit(values: MarkingsValues) {
    const result = save({ ...config, classificationMarkings: values.markings }, 'markings', t('admin.markings.audit', { labels: values.markings.map((m) => m.label).join(', ') }));
    setSaveErrors(result.errors);
    if (result.ok) form.reset(values);
  }

  return (
    <>
      <SectionHead
        title={sectionLabel('markings')}
        lede={t('admin.markings.lede')}
        actions={
          <>
            <Button variant="quiet" disabled={!form.formState.isDirty} onClick={() => form.reset({ markings: config.classificationMarkings })}>
              {t('admin.actions.discardChanges')}
            </Button>
            <Button variant="primary" disabled={!canEdit || !form.formState.isDirty} onClick={() => void form.handleSubmit(submit)()}>
              {t('admin.markings.save')}
            </Button>
          </>
        }
      />
      <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
        {config.classificationMarkings.map((m, i) => {
          const label = live[i]?.label?.trim() || m.label;
          return (
            <Sheet key={m.id}>
              <SheetHead title={markingTitle(m.id)} meta={markingUse(m.id)} headingLevel={2} />
              <SheetBody>
                <div className={styles.banner} data-level={m.id} role="note" aria-label={t('admin.markings.bannerPreview', { label })}>
                  {label}
                </div>
                <div className={styles.fields}>
                  <TextField label={t('admin.markings.textField')} required disabled={!canEdit} maxLength={60} {...form.register(`markings.${i}.label`)} error={errors.markings?.[i]?.label?.message} />
                  <TextareaField label={t('admin.markings.handlingField')} required disabled={!canEdit} maxLength={400} {...form.register(`markings.${i}.handling`)} error={errors.markings?.[i]?.handling?.message} />
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
