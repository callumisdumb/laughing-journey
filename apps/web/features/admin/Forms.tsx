'use client';

import { PROCESS_LABELS, formatDate, type Config } from '@mas/domain';
import { Button, DateField, Dialog, ProcessMark, Table, TableWrap, TextField } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import styles from './Forms.module.css';
import { SectionHead } from './SectionHead';
import { useAdminConfig } from './useAdminConfig';

type FormVersion = Config['forms'][number];

function versionSchema(current: FormVersion) {
  return z
    .object({
      version: z.string().trim().min(1, 'Enter the new version, for example 2026.1').max(20),
      effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a date'),
      source: z.string().trim().min(3, 'Say where the version comes from').max(160),
    })
    .superRefine((v, ctx) => {
      if (v.version === current.version) ctx.addIssue({ code: 'custom', path: ['version'], message: `Version ${current.version} is already in use` });
      if (v.effectiveFrom <= current.effectiveFrom) ctx.addIssue({ code: 'custom', path: ['effectiveFrom'], message: `Must be after ${formatDate(current.effectiveFrom)}, when the current version took effect` });
    });
}
type VersionValues = z.infer<ReturnType<typeof versionSchema>>;

function VersionDialog({ form: current, canEdit, onClose, onSave }: { form: FormVersion; canEdit: boolean; onClose: () => void; onSave: (next: FormVersion) => string[] }) {
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const rhf = useForm<VersionValues>({ resolver: zodResolver(versionSchema(current)), defaultValues: { version: '', effectiveFrom: '', source: current.source } });
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
      title={`Add a version: ${current.label}`}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canEdit} onClick={() => void rhf.handleSubmit(submit)()}>
            Add version
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
        <p className={styles.current}>
          Current: version {current.version}, effective from {formatDate(current.effectiveFrom)}. Source: {current.source}.
        </p>
        <TextField label="New version" required disabled={!canEdit} maxLength={20} placeholder="e.g. 2026.1" {...rhf.register('version')} error={errors.version?.message} />
        <Controller control={rhf.control} name="effectiveFrom" render={({ field }) => <DateField label="Effective from" required disabled={!canEdit} value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} error={errors.effectiveFrom?.message} hint="Records created on or after this date use the new version. Type it as dd Mon yyyy." />} />
        <TextField label="Source" required disabled={!canEdit} maxLength={160} {...rhf.register('source')} error={errors.source?.message} />
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
  const { config, canEdit, save } = useAdminConfig();
  const [adding, setAdding] = useState<FormVersion | null>(null);

  function saveVersion(next: FormVersion): string[] {
    const previous = config.forms.find((f) => f.id === next.id);
    const result = save({ ...config, forms: config.forms.map((f) => (f.id === next.id ? next : f)) }, 'forms', `${next.label}: version ${previous?.version ?? '?'} to ${next.version}, effective ${formatDate(next.effectiveFrom)}`);
    return result.errors;
  }

  return (
    <>
      <SectionHead title="Forms" lede="The forms in use and the version that applies from a date. A new version never rewrites records made under the old one." />
      <TableWrap label="Forms and versions">
        <Table>
          <thead>
            <tr>
              <th scope="col">Form</th>
              <th scope="col">Process</th>
              <th scope="col">Version</th>
              <th scope="col">Effective from</th>
              <th scope="col">Source</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
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
                  <span className="visually-hidden">{PROCESS_LABELS[f.process]}</span>
                </td>
                <td className={styles.version}>{f.version}</td>
                <td className={styles.date}>{formatDate(f.effectiveFrom)}</td>
                <td className={styles.source}>{f.source}</td>
                <td>
                  <Button size="sm" variant="secondary" disabled={!canEdit} onClick={() => setAdding(f)}>
                    Add version
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
