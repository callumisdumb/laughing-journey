'use client';

import { DAQ_QUESTIONS, DASH_QUESTIONS, HIGH_RISK_THRESHOLD, daqFormSchema, type DaqForm, type MaracProcess, type RiskAssessment } from '@mas/domain';
import { Button, CheckboxField, Dialog, RadioGroup, TextField, TextareaField, useToast } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useAppStore, useCurrentUser, useNow } from '@/lib/store';

export function DaqDialog({ open, onClose, process }: { open: boolean; onClose: () => void; process: MaracProcess }) {
  const user = useCurrentUser();
  const now = useNow();
  const upsert = useAppStore((s) => s.upsert);
  const audit = useAppStore((s) => s.audit);
  const newId = useAppStore((s) => s.newId);
  const { toast } = useToast();
  const form = useForm<DaqForm>({ resolver: zodResolver(daqFormSchema), defaultValues: { tool: 'daq', assessedAt: now.toISOString().slice(0, 10), answers: {}, referBelowThreshold: false, professionalJudgement: '' } });
  const tool = form.watch('tool');
  const answers = form.watch('answers');
  const questions = tool === 'dash' ? DASH_QUESTIONS : DAQ_QUESTIONS;
  const yes = questions.filter((q) => answers?.[q.id] === 'yes').length;
  const errors = form.formState.errors;

  function submit(values: DaqForm) {
    if (!user) return;
    const r = daqFormSchema.parse(values);
    const by = `${user.givenName} ${user.familyName}`;
    const ra: RiskAssessment = {
      id: newId('ra'),
      synthetic: true,
      processId: process.id,
      subjectId: process.detail.referral.victimPersonId,
      tool: r.tool,
      assessedAt: `${r.assessedAt}T${now.toISOString().slice(11, 19)}+01:00`,
      assessorUserId: user.id,
      assessorName: by,
      assessorAgency: user.agency,
      score: r.score,
      maxScore: r.maxScore,
      band: r.highRisk ? 'high' : 'medium',
      bandLabel: r.highRisk ? `High risk (${HIGH_RISK_THRESHOLD} or more)` : `Below threshold (${r.score} of ${r.maxScore})`,
      items: questions.map((q) => ({ id: q.id, question: q.text, answer: r.answers[q.id] ?? 'unknown' })),
      evidenceRefs: [],
      judgementOverride: !r.highRisk && r.refer ? { band: 'high', reason: r.professionalJudgement ?? '', byName: by } : undefined,
    };
    upsert('riskAssessments', ra);
    upsert('processes', { ...process, riskAssessmentIds: [...process.riskAssessmentIds, ra.id], detail: { ...process.detail, referral: { ...process.detail.referral, riskAssessmentId: ra.id, professionalJudgementReferral: !r.highRisk && r.refer } } });
    audit({ act: 'edit', targetType: 'process', targetId: process.id, targetLabel: `${r.tool.toUpperCase()} recorded: ${r.score} of ${r.maxScore}`, processId: process.id });
    toast({ title: `${r.tool.toUpperCase()} recorded: ${r.score} yes answers`, text: r.highRisk ? 'High risk: refer to MARAC.' : r.refer ? 'Below threshold; referred on professional judgement.' : 'Below threshold; no MARAC referral.', tone: 'success' });
    form.reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Domestic abuse risk checklist"
      size="lg"
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void form.handleSubmit(submit)()}>
            Record and score
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
        <Controller control={form.control} name="tool" render={({ field }) => <RadioGroup legend="Instrument" name="tool" value={field.value} onChange={field.onChange} orientation="horizontal" options={[{ value: 'daq', label: 'Police Scotland DAQ (27 questions)' }, { value: 'dash', label: 'SafeLives DASH (24 questions)' }]} />} />
        <TextField label="Date completed" type="date" required {...form.register('assessedAt')} error={errors.assessedAt?.message} />
        <p aria-live="polite" style={{ fontWeight: 700 }}>
          {yes} yes answers so far. {yes >= HIGH_RISK_THRESHOLD ? 'High risk: this meets the referral threshold.' : `${HIGH_RISK_THRESHOLD - yes} more for the high-risk threshold.`}
        </p>
        <div className="stack" style={{ gap: 6, maxHeight: 360, overflow: 'auto', paddingRight: 8 }}>
          {questions.map((q) => (
            <Controller key={q.id} control={form.control} name={`answers.${q.id}`} render={({ field }) => <RadioGroup legend={q.text} name={q.id} value={field.value ?? ''} onChange={field.onChange} orientation="horizontal" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unknown', label: 'Not known' }]} error={errors.answers?.[q.id]?.message} />} />
          ))}
        </div>
        <CheckboxField label="Refer on professional judgement even if below 14" {...form.register('referBelowThreshold')} />
        <TextareaField label="Professional judgement" {...form.register('professionalJudgement')} error={errors.professionalJudgement?.message} hint="Required for a referral below the threshold. Why the score understates the risk." />
      </form>
    </Dialog>
  );
}
