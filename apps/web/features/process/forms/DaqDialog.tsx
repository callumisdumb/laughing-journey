'use client';

import { DAQ_QUESTIONS, DASH_QUESTIONS, HIGH_RISK_THRESHOLD, MARAC_MUST_NOT_RECEIVE_PARTIES, daqFormSchema, daqQuestionText, nearMatchesOnList, registerUpdateLabel, riskToolLabel, withMustNotReceive, type DaqForm, type MaracProcess, type RiskAssessment } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, CheckboxField, DateField, Dialog, RadioGroup, TextareaField, useToast } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useAppStore, useCurrentUser, useData, useNow } from '@/lib/store';
import { listedNames } from '@/lib/selectors';
import { MustNotReceiveFields } from './MustNotReceiveFields';

export function DaqDialog({ open, onClose, process }: { open: boolean; onClose: () => void; process: MaracProcess }) {
  const t = useT();
  const user = useCurrentUser();
  const data = useData();
  const now = useNow();
  const upsert = useAppStore((s) => s.upsert);
  const audit = useAppStore((s) => s.audit);
  const newId = useAppStore((s) => s.newId);
  const { toast } = useToast();
  const form = useForm<DaqForm>({ resolver: zodResolver(daqFormSchema), defaultValues: { tool: 'daq', assessedAt: now.toISOString().slice(0, 10), answers: {}, referBelowThreshold: false, professionalJudgement: '', mustNotReceive: [] } });
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
      bandLabel: r.highRisk ? t('forms.daq.band.high', { threshold: HIGH_RISK_THRESHOLD }) : t('forms.daq.band.below', { score: r.score, max: r.maxScore }),
      items: questions.map((q) => ({ id: q.id, question: daqQuestionText(q.id), answer: r.answers[q.id] ?? 'unknown' })),
      evidenceRefs: [],
      judgementOverride: !r.highRisk && r.refer ? { band: 'high', reason: r.professionalJudgement ?? '', byName: by } : undefined,
    };
    // Anyone named as "must not receive" joins the case-role register as a manual entry from today.
    const register = withMustNotReceive(process.parties, r.mustNotReceive, now.toISOString().slice(0, 10), 'the DAQ');
    upsert('riskAssessments', ra);
    upsert('processes', { ...process, riskAssessmentIds: [...process.riskAssessmentIds, ra.id], parties: register.parties, detail: { ...process.detail, referral: { ...process.detail.referral, riskAssessmentId: ra.id, professionalJudgementReferral: !r.highRisk && r.refer } } });
    audit({ act: 'edit', targetType: 'process', targetId: process.id, targetLabel: `${riskToolLabel(r.tool)} recorded: ${r.score} of ${r.maxScore}`, processId: process.id });
    toast({ title: t('forms.daq.recorded.title', { tool: riskToolLabel(r.tool), count: r.score }), text: t('forms.daq.recorded.text', { outcome: r.highRisk ? 'high' : r.refer ? 'referred' : 'none' }), tone: 'success' });
    const recorded = register.added + register.updated;
    if (recorded > 0) {
      audit({ act: 'edit', targetType: 'process', targetId: process.id, targetLabel: registerUpdateLabel(register, 'the DAQ'), processId: process.id });
      toast({ title: t('forms.mustNotReceive.registerUpdated.title'), text: t('forms.mustNotReceive.registerUpdated.text', { count: recorded }), tone: 'success' });
      // The check in reverse. An exclusion often arrives after the sharing has started, and nothing
      // else in the product would notice that somebody with a similar name is already on a list.
      const onLists = listedNames(data, process.id);
      for (const entry of register.parties.filter((party) => party.source === 'manual' && party.name)) {
        const similar = nearMatchesOnList(entry.name!, onLists);
        if (similar.length === 0) continue;
        audit({
          act: 'edit',
          targetType: 'process',
          targetId: process.id,
          targetLabel: t('sharing.nearMatch.audit.reverse', { entry: entry.name!, count: similar.length }),
          processId: process.id,
          reason: entry.reason ?? '',
        });
        toast({
          title: t('sharing.nearMatch.reverseTitle'),
          text: t('sharing.nearMatch.reverseText', { count: similar.length, names: similar.map((m) => m.name).join('; ') }),
          tone: 'error',
        });
      }
    }
    form.reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('forms.daq.title')}
      size="lg"
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void form.handleSubmit(submit)()}>
            {t('forms.daq.submit')}
          </Button>
        </>
      }
    >
      <FormProvider {...form}>
        <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
          <Controller control={form.control} name="tool" render={({ field }) => <RadioGroup legend={t('forms.daq.instrument.legend')} name="tool" value={field.value} onChange={field.onChange} orientation="horizontal" options={[{ value: 'daq', label: t('forms.daq.instrument.daq', { count: DAQ_QUESTIONS.length }) }, { value: 'dash', label: t('forms.daq.instrument.dash', { count: DASH_QUESTIONS.length }) }]} />} />
          <Controller control={form.control} name="assessedAt" render={({ field }) => <DateField label={t('forms.daq.date.label')} required value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} error={errors.assessedAt?.message} />} />
          <p aria-live="polite" style={{ fontWeight: 700 }}>
            {t('forms.daq.tally', { count: yes, high: yes >= HIGH_RISK_THRESHOLD ? 'yes' : 'no', remaining: HIGH_RISK_THRESHOLD - yes })}
          </p>
          <div className="stack" style={{ gap: 6, maxHeight: 360, overflow: 'auto', paddingRight: 8 }}>
            {questions.map((q) => (
              <Controller key={q.id} control={form.control} name={`answers.${q.id}`} render={({ field }) => <RadioGroup legend={daqQuestionText(q.id)} name={q.id} value={field.value ?? ''} onChange={field.onChange} orientation="horizontal" options={[{ value: 'yes', label: t('common.answers.yes') }, { value: 'no', label: t('common.answers.no') }, { value: 'unknown', label: t('common.answers.notKnown') }]} error={errors.answers?.[q.id]?.message} />} />
            ))}
          </div>
          <CheckboxField label={t('forms.daq.referBelow.label', { threshold: HIGH_RISK_THRESHOLD })} {...form.register('referBelowThreshold')} />
          <TextareaField label={t('forms.daq.judgement.label')} {...form.register('professionalJudgement')} error={errors.professionalJudgement?.message} hint={t('forms.daq.judgement.hint')} />
          <MustNotReceiveFields parties={MARAC_MUST_NOT_RECEIVE_PARTIES} relationshipHint={t('forms.daq.relationshipHint')} />
        </form>
      </FormProvider>
    </Dialog>
  );
}
