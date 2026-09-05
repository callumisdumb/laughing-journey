'use client';

import { MAPPA_MUST_NOT_RECEIVE_PARTIES, formatDate, mappaReferralFormSchema, riskToolLabel, type MappaProcess, type MappaReferralForm } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, CheckboxField, Dialog, RadioGroup, SelectField, TextField, TextareaField, useToast } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useAppStore, useCurrentUser, useData } from '@/lib/store';
import { formErrorSummary } from '@/lib/formErrors';
import { useWriteErrors } from '@/lib/writeErrors';
import { MustNotReceiveFields } from './MustNotReceiveFields';
import { toastRegisterEffects } from './registerEffects';

export function MappaReferralDialog({ open, onClose, process }: { open: boolean; onClose: () => void; process: MappaProcess }) {
  const t = useT();
  const data = useData();
  const user = useCurrentUser();
  const recordTransition = useAppStore((s) => s.recordTransition);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const [refusals, setRefusals] = useState<string[]>([]);
  const d = process.detail;
  const risks = data.riskAssessments.filter((r) => d.riskAssessmentIds.includes(r.id) || r.processId === process.id);
  const form = useForm<MappaReferralForm>({
    resolver: zodResolver(mappaReferralFormSchema),
    defaultValues: { category: d.category, levelSought: d.level === 3 ? 3 : 2, leadResponsibleAuthority: d.leadResponsibleAuthority, riskAssessmentIds: risks.map((r) => r.id), reason: '', imminentRisk: false, victimConsiderations: d.rmp?.victimSafety ?? '', accommodationIssue: Boolean(d.era), disclosureConsidered: d.disclosures.length > 0, visorReference: d.visorReference, mustNotReceive: [] },
  });
  const errors = form.formState.errors;

  function submit(values: MappaReferralForm) {
    if (!user) return;
    const v = mappaReferralFormSchema.parse(values);
    /*
     * The referral is the engine's `mappa-refer-level` (D-225): it moves the case to Referral,
     * records the level sought and the form's own answers, and puts anyone named as "must not
     * receive" on the case-role register, where the pipeline ledgers the change and runs the
     * check in reverse against every name already on a list. The level itself is the meeting's
     * decision, so the case stays at its current level until the meeting sets one.
     */
    const result = recordTransition(process.id, 'mappa-refer-level', {
      level: v.levelSought,
      reason: v.reason,
      riskAssessmentId: v.riskAssessmentIds[0] ?? '',
      referringAuthority: v.leadResponsibleAuthority,
      category: v.category,
      visorReference: v.visorReference,
      imminentRisk: v.imminentRisk,
      victimConsiderations: v.victimConsiderations,
      mustNotReceive: v.mustNotReceive,
      via: t('forms.mappaReferral.via'),
    });
    if (!result.ok) {
      setRefusals(result.errors);
      return;
    }
    setRefusals([]);
    toast({ title: t('forms.mappaReferral.referred.title', { level: v.levelSought }), text: t('forms.mappaReferral.referred.text'), tone: 'success' });
    toastRegisterEffects(result.effects, t, toast);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('forms.mappaReferral.title')}
      size="lg"
      errors={[...readErrors(refusals), ...formErrorSummary(errors)]}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void form.handleSubmit(submit)()} data-testid="referral-submit">
            {t('forms.mappaReferral.submit')}
          </Button>
        </>
      }
    >
      <FormProvider {...form}>
        <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
          <p>{t('forms.mappaReferral.intro')}</p>
          <Controller control={form.control} name="category" render={({ field }) => <RadioGroup legend={t('forms.mappaReferral.category.legend')} name="category" value={String(field.value)} onChange={(v) => field.onChange(Number(v))} orientation="horizontal" options={[{ value: '1', label: t('forms.mappaReferral.category.one') }, { value: '2', label: t('forms.mappaReferral.category.two') }, { value: '3', label: t('forms.mappaReferral.category.three') }]} />} />
          <Controller control={form.control} name="levelSought" render={({ field }) => <RadioGroup legend={t('forms.mappaReferral.level.legend')} name="level" value={String(field.value)} onChange={(v) => field.onChange(Number(v))} orientation="horizontal" options={[{ value: '2', label: t('forms.mappaReferral.level.two') }, { value: '3', label: t('forms.mappaReferral.level.three') }]} error={errors.levelSought?.message} />} />
          <SelectField label={t('forms.mappaReferral.leadRa.label')} {...form.register('leadResponsibleAuthority')} options={[{ value: 'police', label: t('forms.mappaReferral.leadRa.police') }, { value: 'social-work', label: t('forms.mappaReferral.leadRa.socialWork') }, { value: 'health', label: t('forms.mappaReferral.leadRa.health') }, { value: 'sps', label: t('forms.mappaReferral.leadRa.sps') }]} />
          <Controller
            control={form.control}
            name="riskAssessmentIds"
            render={({ field }) => (
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 6 }}>{t('forms.mappaReferral.riskAssessments.legend')}</legend>
                {errors.riskAssessmentIds ? <div role="alert" style={{ color: 'var(--color-risk-critical)', fontSize: 'var(--text-sm)' }}>{errors.riskAssessmentIds.message}</div> : null}
                {risks.map((r) => (
                  <CheckboxField key={r.id} label={t('forms.mappaReferral.riskAssessments.option', { tool: riskToolLabel(r.tool), band: r.bandLabel, date: formatDate(r.assessedAt) })} checked={field.value.includes(r.id)} onChange={(e) => field.onChange(e.target.checked ? [...field.value, r.id] : field.value.filter((x) => x !== r.id))} />
                ))}
              </fieldset>
            )}
          />
          <TextareaField label={t('forms.mappaReferral.reason.label')} required {...form.register('reason')} error={errors.reason?.message} data-testid="referral-reason" />
          <CheckboxField label={t('forms.mappaReferral.imminent.label')} {...form.register('imminentRisk')} />
          {errors.imminentRisk ? <div role="alert" style={{ color: 'var(--color-risk-critical)', fontSize: 'var(--text-sm)' }}>{errors.imminentRisk.message}</div> : null}
          <TextareaField label={t('forms.mappaReferral.victim.label')} required {...form.register('victimConsiderations')} error={errors.victimConsiderations?.message} hint={t('forms.mappaReferral.victim.hint')} data-testid="referral-victim" />
          <MustNotReceiveFields parties={MAPPA_MUST_NOT_RECEIVE_PARTIES} relationshipHint={t('forms.mappaReferral.relationshipHint')} />
          <div className="cluster">
            <CheckboxField label={t('forms.mappaReferral.accommodation.label')} {...form.register('accommodationIssue')} />
            <CheckboxField label={t('forms.mappaReferral.disclosure.label')} {...form.register('disclosureConsidered')} />
          </div>
          <TextField label={t('forms.mappaReferral.visor.label')} required {...form.register('visorReference')} error={errors.visorReference?.message} data-testid="referral-visor" />
        </form>
      </FormProvider>
    </Dialog>
  );
}
