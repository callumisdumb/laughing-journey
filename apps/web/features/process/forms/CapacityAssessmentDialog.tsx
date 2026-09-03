'use client';

import { capacityAssessmentFormSchema, type AwiProcess, type CapacityAssessmentForm } from '@mas/domain';
import { Button, Dialog, RadioGroup, TextField, TextareaField, useToast } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useAppStore, useCurrentUser, useNow } from '@/lib/store';

const FUNCTIONAL = [
  { key: 'understands', label: 'Understands the information relevant to the decision' },
  { key: 'retains', label: 'Retains that information long enough to decide' },
  { key: 'weighs', label: 'Weighs it up to reach a decision' },
  { key: 'communicates', label: 'Communicates the decision by any means' },
  { key: 'acts', label: 'Can act on the decision' },
] as const;

export function CapacityAssessmentDialog({ open, onClose, process }: { open: boolean; onClose: () => void; process: AwiProcess }) {
  const user = useCurrentUser();
  const now = useNow();
  const upsert = useAppStore((s) => s.upsert);
  const audit = useAppStore((s) => s.audit);
  const newId = useAppStore((s) => s.newId);
  const { toast } = useToast();
  const form = useForm<CapacityAssessmentForm>({
    resolver: zodResolver(capacityAssessmentFormSchema),
    defaultValues: { decision: process.detail.concern.decisionInQuestion, assessedAt: now.toISOString().slice(0, 10), assessorName: user ? `${user.givenName} ${user.familyName}` : '', assessorRole: user?.jobTitle ?? '', understands: 'partly', retains: 'partly', weighs: 'partly', communicates: 'yes', acts: 'partly', evidence: '', outcome: 'fluctuating', wishesConsidered: process.detail.willAndPreferences?.presentWishes ?? '' },
  });
  const errors = form.formState.errors;

  function submit(values: CapacityAssessmentForm) {
    if (!user) return;
    const v = capacityAssessmentFormSchema.parse(values);
    upsert('processes', {
      ...process,
      detail: {
        ...process.detail,
        capacityAssessments: [
          ...process.detail.capacityAssessments,
          { id: newId('cap'), decision: v.decision, assessedAt: `${v.assessedAt}T${now.toISOString().slice(11, 19)}+01:00`, assessorName: v.assessorName, assessorRole: v.assessorRole, outcome: v.outcome, evidence: `${v.evidence} Functional test: understands ${v.understands}, retains ${v.retains}, weighs ${v.weighs}, communicates ${v.communicates}, acts ${v.acts}. Wishes: ${v.wishesConsidered}`, communicationSupport: v.communicationSupport || undefined },
        ],
      },
    });
    audit({ act: 'edit', targetType: 'process', targetId: process.id, targetLabel: `Capacity assessment recorded: ${v.outcome}`, processId: process.id });
    toast({ title: 'Capacity assessment recorded', text: `${v.decision}: ${v.outcome.replace('-', ' ')}.`, tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Capacity assessment (AWI 2000)"
      size="lg"
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void form.handleSubmit(submit)()}>
            Record assessment
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
        <p>Capacity is decision-specific and time-specific. Record the decision, the functional test item by item, the evidence, and the adult&apos;s past and present wishes.</p>
        <TextField label="The specific decision" required {...form.register('decision')} error={errors.decision?.message} />
        <div className="cluster" style={{ alignItems: 'flex-start' }}>
          <TextField label="Date" type="date" required {...form.register('assessedAt')} error={errors.assessedAt?.message} />
          <TextField label="Assessor" required {...form.register('assessorName')} error={errors.assessorName?.message} />
          <TextField label="Role" required {...form.register('assessorRole')} error={errors.assessorRole?.message} />
        </div>
        <TextField label="Communication support used" {...form.register('communicationSupport')} hint="Interpreter, communication aid, best time of day." />
        {FUNCTIONAL.map((f) => (
          <Controller key={f.key} control={form.control} name={f.key} render={({ field }) => <RadioGroup legend={f.label} name={f.key} value={field.value} onChange={field.onChange} orientation="horizontal" options={[{ value: 'yes', label: 'Yes' }, { value: 'partly', label: 'Partly' }, { value: 'no', label: 'No' }]} />} />
        ))}
        <TextareaField label="Evidence for the conclusion" required {...form.register('evidence')} error={errors.evidence?.message} />
        <Controller control={form.control} name="outcome" render={({ field }) => <RadioGroup legend="Outcome for this decision" name="outcome" value={field.value} onChange={field.onChange} orientation="horizontal" options={[{ value: 'has-capacity', label: 'Has capacity' }, { value: 'lacks-capacity', label: 'Lacks capacity' }, { value: 'fluctuating', label: 'Fluctuating' }]} error={errors.outcome?.message} />} />
        <TextareaField label="Past and present wishes considered" required {...form.register('wishesConsidered')} error={errors.wishesConsidered?.message} />
      </form>
    </Dialog>
  );
}
