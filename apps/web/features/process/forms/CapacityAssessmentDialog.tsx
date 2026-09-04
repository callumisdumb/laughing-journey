'use client';

import { capacityAssessmentFormSchema, capacityOutcomeLabel, type AwiProcess, type CapacityAssessmentForm } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, DateField, Dialog, RadioGroup, TextField, TextareaField, useToast } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useAppStore, useCurrentUser, useNow } from '@/lib/store';
import { formErrorSummary } from '@/lib/formErrors';
import { useWriteErrors } from '@/lib/writeErrors';

/** The functional test items, in order; each has a legend under forms.capacity.functional. */
const FUNCTIONAL = ['understands', 'retains', 'weighs', 'communicates', 'acts'] as const;

export function CapacityAssessmentDialog({ open, onClose, process }: { open: boolean; onClose: () => void; process: AwiProcess }) {
  const t = useT();
  const user = useCurrentUser();
  const now = useNow();
  const write = useAppStore((s) => s.write);
  const newId = useAppStore((s) => s.newId);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const [refusals, setRefusals] = useState<string[]>([]);
  const form = useForm<CapacityAssessmentForm>({
    resolver: zodResolver(capacityAssessmentFormSchema),
    defaultValues: { decision: process.detail.concern.decisionInQuestion, assessedAt: now.toISOString().slice(0, 10), assessorName: user ? `${user.givenName} ${user.familyName}` : '', assessorRole: user?.jobTitle ?? '', understands: 'partly', retains: 'partly', weighs: 'partly', communicates: 'yes', acts: 'partly', evidence: '', outcome: 'fluctuating', wishesConsidered: process.detail.willAndPreferences?.presentWishes ?? '' },
  });
  const errors = form.formState.errors;

  function submit(values: CapacityAssessmentForm) {
    if (!user) return;
    const v = capacityAssessmentFormSchema.parse(values);
    const assessedAt = `${v.assessedAt}T${now.toISOString().slice(11, 19)}+01:00`;
    const outcome = capacityOutcomeLabel(v.outcome);
    // A capacity assessment is a risk assessment in the records matrix, so the pipeline writes the
    // chronology milestone beside the case (docs/RECORDS.md section 3).
    const result = write({
      collection: 'processes',
      record: {
        ...process,
        detail: {
          ...process.detail,
          capacityAssessments: [
            ...process.detail.capacityAssessments,
            {
              id: newId('cap'),
              decision: v.decision,
              assessedAt,
              assessorName: v.assessorName,
              assessorRole: v.assessorRole,
              outcome: v.outcome,
              evidence: t('forms.capacity.evidenceRecord', { evidence: v.evidence, understands: v.understands, retains: v.retains, weighs: v.weighs, communicates: v.communicates, acts: v.acts, wishes: v.wishesConsidered }),
              communicationSupport: v.communicationSupport || undefined,
            },
          ],
        },
      },
      intent: 'update',
      act: 'edit',
      targetType: 'process',
      targetLabel: t('forms.capacity.audit', { outcome }),
      processId: process.id,
      versionChange: t('forms.capacity.audit', { outcome }),
      event: {
        eventType: 'health.assessment',
        significance: 'high',
        visibility: 'integrated',
        title: t('forms.capacity.event.title'),
        detail: t('forms.capacity.event.detail', { decision: v.decision, outcome, assessor: v.assessorName }),
        subjectIds: process.subjectIds,
        occurredAt: assessedAt,
        linkedProcessIds: [process.id],
      },
    });
    if (!result.ok) {
      setRefusals(result.errors);
      return;
    }
    setRefusals([]);
    toast({ title: t('forms.capacity.recorded.title'), text: t('forms.capacity.recorded.text', { decision: v.decision, outcome }), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('forms.capacity.title')}
      size="lg"
      errors={[...readErrors(refusals), ...formErrorSummary(errors)]}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void form.handleSubmit(submit)()}>
            {t('forms.capacity.submit')}
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
        <p>{t('forms.capacity.intro')}</p>
        <TextField label={t('forms.capacity.decision.label')} required {...form.register('decision')} error={errors.decision?.message} />
        <div className="cluster" style={{ alignItems: 'flex-start' }}>
          <Controller control={form.control} name="assessedAt" render={({ field }) => <DateField label={t('forms.capacity.date.label')} required value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} error={errors.assessedAt?.message} />} />
          <TextField label={t('forms.capacity.assessor.label')} required {...form.register('assessorName')} error={errors.assessorName?.message} />
          <TextField label={t('forms.capacity.role.label')} required {...form.register('assessorRole')} error={errors.assessorRole?.message} />
        </div>
        <TextField label={t('forms.capacity.communication.label')} {...form.register('communicationSupport')} hint={t('forms.capacity.communication.hint')} />
        {FUNCTIONAL.map((item) => (
          <Controller key={item} control={form.control} name={item} render={({ field }) => <RadioGroup legend={t(`forms.capacity.functional.${item}` as const)} name={item} value={field.value} onChange={field.onChange} orientation="horizontal" options={[{ value: 'yes', label: t('common.answers.yes') }, { value: 'partly', label: t('forms.capacity.answers.partly') }, { value: 'no', label: t('common.answers.no') }]} />} />
        ))}
        <TextareaField label={t('forms.capacity.evidence.label')} required {...form.register('evidence')} error={errors.evidence?.message} />
        <Controller control={form.control} name="outcome" render={({ field }) => <RadioGroup legend={t('forms.capacity.outcome.legend')} name="outcome" value={field.value} onChange={field.onChange} orientation="horizontal" options={[{ value: 'has-capacity', label: t('forms.capacity.outcome.hasCapacity') }, { value: 'lacks-capacity', label: t('forms.capacity.outcome.lacksCapacity') }, { value: 'fluctuating', label: t('forms.capacity.outcome.fluctuating') }]} error={errors.outcome?.message} />} />
        <TextareaField label={t('forms.capacity.wishes.label')} required {...form.register('wishesConsidered')} error={errors.wishesConsidered?.message} />
      </form>
    </Dialog>
  );
}
