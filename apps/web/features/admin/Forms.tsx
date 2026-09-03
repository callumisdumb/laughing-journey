'use client';

import { formatDate, processLabel, type Config } from '@mas/domain';
import { useT, type Translator } from '@mas/messages';
import { Button, DateField, Dialog, ProcessMark, Table, TableWrap, TextField } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import styles from './Forms.module.css';
import { SectionHead } from './SectionHead';
import { sectionLabel } from './sections';
import { useAdminConfig } from './useAdminConfig';

type FormVersion = Config['forms'][number];

function versionSchema(t: Translator, current: FormVersion) {
  return z
    .object({
      version: z.string().trim().min(1, t('admin.forms.errors.version')).max(20),
      effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t('admin.forms.errors.effective')),
      source: z.string().trim().min(3, t('admin.forms.errors.source')).max(160),
    })
    .superRefine((v, ctx) => {
      if (v.version === current.version) ctx.addIssue({ code: 'custom', path: ['version'], message: t('admin.forms.errors.versionInUse', { version: current.version }) });
      if (v.effectiveFrom <= current.effectiveFrom) ctx.addIssue({ code: 'custom', path: ['effectiveFrom'], message: t('admin.forms.errors.effectiveAfter', { date: formatDate(current.effectiveFrom) }) });
    });
}
type VersionValues = z.infer<ReturnType<typeof versionSchema>>;

function VersionDialog({ form: current, canEdit, onClose, onSave }: { form: FormVersion; canEdit: boolean; onClose: () => void; onSave: (next: FormVersion) => string[] }) {
  const t = useT();
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const schema = useMemo(() => versionSchema(t, current), [t, current]);
  const rhf = useForm<VersionValues>({ resolver: zodResolver(schema), defaultValues: { version: '', effectiveFrom: '', source: current.source } });
  const errors = rhf.formState.errors;

  function submit(values: VersionValues) {
    const errs = onSave({ ...current, version: values.version, effectiveFrom: values.effectiveFrom, source: values.source });
    if (errs.length > 0) setSaveErrors(errs);
    else onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('admin.forms.dialog.title', { label: current.label })}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" disabled={!canEdit} onClick={() => void rhf.handleSubmit(submit)()}>
            {t('admin.forms.addVersion')}
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
        <p className={styles.current}>{t('admin.forms.dialog.current', { version: current.version, date: formatDate(current.effectiveFrom), source: current.source })}</p>
        <TextField label={t('admin.forms.dialog.versionField')} required disabled={!canEdit} maxLength={20} placeholder={t('admin.forms.dialog.versionPlaceholder')} {...rhf.register('version')} error={errors.version?.message} />
        <Controller control={rhf.control} name="effectiveFrom" render={({ field }) => <DateField label={t('admin.forms.dialog.effectiveField')} required disabled={!canEdit} value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} error={errors.effectiveFrom?.message} hint={t('admin.forms.dialog.effectiveHint')} />} />
        <TextField label={t('admin.forms.dialog.sourceField')} required disabled={!canEdit} maxLength={160} {...rhf.register('source')} error={errors.source?.message} />
        {saveErrors.length > 0 ? (
          <ul className={styles.errors} role="alert">
            {saveErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
      </form>
    </Dialog>
  );
}

export function Forms() {
  const t = useT();
  const { config, canEdit, save } = useAdminConfig();
  const [adding, setAdding] = useState<FormVersion | null>(null);

  function saveVersion(next: FormVersion): string[] {
    const previous = config.forms.find((f) => f.id === next.id);
    const result = save({ ...config, forms: config.forms.map((f) => (f.id === next.id ? next : f)) }, 'forms', t('admin.forms.audit', { label: next.label, previous: previous?.version ?? '?', next: next.version, date: formatDate(next.effectiveFrom) }));
    return result.errors;
  }

  return (
    <>
      <SectionHead title={sectionLabel('forms')} lede={t('admin.forms.lede')} />
      <TableWrap label={t('admin.forms.tableLabel')}>
        <Table>
          <thead>
            <tr>
              <th scope="col">{t('admin.forms.columns.form')}</th>
              <th scope="col">{t('admin.forms.columns.process')}</th>
              <th scope="col">{t('admin.forms.columns.version')}</th>
              <th scope="col">{t('admin.forms.columns.effectiveFrom')}</th>
              <th scope="col">{t('admin.forms.columns.source')}</th>
              <th scope="col">
                <span className="visually-hidden">{t('common.columns.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {config.forms.map((f) => (
              <tr key={f.id}>
                <td>
                  <span className={styles.label}>{f.label}</span>
                  <span className={styles.id}>{f.id}</span>
                </td>
                <td>
                  <ProcessMark type={f.process} />
                  <span className="visually-hidden">{processLabel(f.process)}</span>
                </td>
                <td className={styles.version}>{f.version}</td>
                <td className={styles.date}>{formatDate(f.effectiveFrom)}</td>
                <td className={styles.source}>{f.source}</td>
                <td>
                  <Button size="sm" variant="secondary" disabled={!canEdit} onClick={() => setAdding(f)}>
                    {t('admin.forms.addVersion')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
      {adding ? <VersionDialog form={adding} canEdit={canEdit} onClose={() => setAdding(null)} onSave={saveVersion} /> : null}
    </>
  );
}
