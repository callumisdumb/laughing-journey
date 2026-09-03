'use client';

import { MAPPA_MUST_NOT_RECEIVE_PARTIES, mappaReferralFormSchema, registerUpdateLabel, withMustNotReceive, type MappaProcess, type MappaReferralForm } from '@mas/domain';
import { Button, CheckboxField, Dialog, RadioGroup, SelectField, TextField, TextareaField, useToast } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { useAppStore, useCurrentUser, useData, useNow } from '@/lib/store';
import { MustNotReceiveFields } from './MustNotReceiveFields';

export function MappaReferralDialog({ open, onClose, process }: { open: boolean; onClose: () => void; process: MappaProcess }) {
  const data = useData();
  const user = useCurrentUser();
  const now = useNow();
  const upsert = useAppStore((s) => s.upsert);
  const audit = useAppStore((s) => s.audit);
  const { toast } = useToast();
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
    const by = `${user.givenName} ${user.familyName}`;
    // Anyone named as "must not receive" joins the case-role register as a manual entry from today.
    const register = withMustNotReceive(process.parties, v.mustNotReceive, now.toISOString().slice(0, 10), 'the MAPPA referral');
    upsert('processes', {
      ...process,
      parties: register.parties,
      detail: {
        ...d,
        level: v.levelSought,
        levelHistory: [...d.levelHistory, { level: v.levelSought, at: now.toISOString().slice(0, 10), reason: `Referral by ${by}: ${v.reason}` }],
        referral: { at: now.toISOString(), byName: by, riskAssessmentIds: v.riskAssessmentIds, reason: v.reason },
      },
    });
    audit({ act: 'edit', targetType: 'process', targetId: process.id, targetLabel: `MAPPA referral to Level ${v.levelSought}`, processId: process.id, restricted: true });
    toast({ title: `Referred to Level ${v.levelSought}`, text: 'The MAPPA Coordinator passes the referral to a single point of contact in each Responsible Authority for pre-meeting returns.', tone: 'success' });
    const recorded = register.added + register.updated;
    if (recorded > 0) {
      audit({ act: 'edit', targetType: 'process', targetId: process.id, targetLabel: registerUpdateLabel(register, 'the MAPPA referral'), processId: process.id, restricted: true });
      toast({ title: 'Case-role register updated', text: `${recorded === 1 ? '1 person' : `${recorded} people`} recorded as "Must not receive" for this case.`, tone: 'success' });
    }
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="MAPPA referral (Level 2 or 3)"
      size="lg"
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void form.handleSubmit(submit)()}>
            Send referral
          </Button>
        </>
      }
    >
      <FormProvider {...form}>
        <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
          <p>A referral must be informed by a current risk assessment (MAPPA National Guidance 2022). Category 3 cannot be managed at Level 1. Level 3 is for the critical few.</p>
          <Controller control={form.control} name="category" render={({ field }) => <RadioGroup legend="Category" name="category" value={String(field.value)} onChange={(v) => field.onChange(Number(v))} orientation="horizontal" options={[{ value: '1', label: '1: registered sex offender' }, { value: '2', label: '2: restricted patient' }, { value: '3', label: '3: other risk of serious harm' }]} />} />
          <Controller control={form.control} name="levelSought" render={({ field }) => <RadioGroup legend="Level sought" name="level" value={String(field.value)} onChange={(v) => field.onChange(Number(v))} orientation="horizontal" options={[{ value: '2', label: 'Level 2: active multi-agency management' }, { value: '3', label: 'Level 3: MAPPP' }]} error={errors.levelSought?.message} />} />
          <SelectField label="Lead Responsible Authority" {...form.register('leadResponsibleAuthority')} options={[{ value: 'police', label: 'Police Scotland' }, { value: 'social-work', label: 'Justice social work' }, { value: 'health', label: 'Health board (restricted patients)' }, { value: 'sps', label: 'SPS (in custody)' }]} />
          <Controller
            control={form.control}
            name="riskAssessmentIds"
            render={({ field }) => (
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 6 }}>Current risk assessments informing the referral</legend>
                {errors.riskAssessmentIds ? <div role="alert" style={{ color: 'var(--color-risk-critical)', fontSize: 'var(--text-sm)' }}>{errors.riskAssessmentIds.message}</div> : null}
                {risks.map((r) => (
                  <CheckboxField key={r.id} label={`${r.tool.toUpperCase()}: ${r.bandLabel}, ${r.assessedAt.slice(0, 10)}`} checked={field.value.includes(r.id)} onChange={(e) => field.onChange(e.target.checked ? [...field.value, r.id] : field.value.filter((x) => x !== r.id))} />
                ))}
              </fieldset>
            )}
          />
          <TextareaField label="Why active multi-agency management is needed" required {...form.register('reason')} error={errors.reason?.message} />
          <CheckboxField label="Imminent risk of serious harm (required for Level 3)" {...form.register('imminentRisk')} />
          {errors.imminentRisk ? <div role="alert" style={{ color: 'var(--color-risk-critical)', fontSize: 'var(--text-sm)' }}>{errors.imminentRisk.message}</div> : null}
          <TextareaField label="Victim considerations" required {...form.register('victimConsiderations')} error={errors.victimConsiderations?.message} hint="MAPPA information is not given to victims; the Victim Notification Scheme is separate." />
          <MustNotReceiveFields parties={MAPPA_MUST_NOT_RECEIVE_PARTIES} relationshipHint="For example the victim's mother." />
          <div className="cluster">
            <CheckboxField label="Accommodation issue (ERA needed)" {...form.register('accommodationIssue')} />
            <CheckboxField label="Disclosure to a third party considered" {...form.register('disclosureConsidered')} />
          </div>
          <TextField label="ViSOR (MAPPS) reference" required {...form.register('visorReference')} error={errors.visorReference?.message} />
        </form>
      </FormProvider>
    </Dialog>
  );
}
