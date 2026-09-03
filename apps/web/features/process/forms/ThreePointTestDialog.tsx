'use client';

import { HARM_TYPES, THREE_POINT_LIMBS, harmTypeLabel, threePointTestFormSchema, type AspProcess, type ThreePointTestForm } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, CheckboxField, DateField, Dialog, RadioGroup, TextareaField, useToast } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useAppStore, useCurrentUser, useNow } from '@/lib/store';
import { formErrorSummary } from '@/lib/formErrors';

export function ThreePointTestDialog({ open, onClose, process }: { open: boolean; onClose: () => void; process: AspProcess }) {
  const t = useT();
  const user = useCurrentUser();
  const now = useNow();
  const upsert = useAppStore((s) => s.upsert);
  const audit = useAppStore((s) => s.audit);
  const { toast } = useToast();
  const current = process.detail.threePointTest;
  const form = useForm<ThreePointTestForm>({
    resolver: zodResolver(threePointTestFormSchema),
    defaultValues: { assessedAt: now.toISOString().slice(0, 10), a: { met: current.a.met, reasoning: current.a.reasoning }, b: { met: current.b.met, reasoning: current.b.reasoning }, c: { met: current.c.met, reasoning: current.c.reasoning }, harmTypes: process.detail.concern.harmTypes, immediateSafety: process.detail.concern.immediateSafety },
  });
  const errors = form.formState.errors;

  function submit(values: ThreePointTestForm) {
    if (!user) return;
    const parsed = threePointTestFormSchema.parse(values);
    const by = `${user.givenName} ${user.familyName}`;
    upsert('processes', {
      ...process,
      detail: {
        ...process.detail,
        threePointTest: { assessedAt: `${parsed.assessedAt}T${now.toISOString().slice(11, 19)}+01:00`, byName: by, byUserId: user.id, a: parsed.a, b: parsed.b, c: parsed.c, outcome: parsed.outcome },
        concern: { ...process.detail.concern, harmTypes: parsed.harmTypes, immediateSafety: parsed.immediateSafety },
      },
    });
    audit({ act: 'edit', targetType: 'process', targetId: process.id, targetLabel: `Three-point test recorded: ${parsed.outcome}`, processId: process.id });
    toast({ title: t('forms.threePointTest.recorded.title'), text: t('forms.threePointTest.recorded.text', { outcome: parsed.outcome === 'not-met' ? 'notMet' : parsed.outcome }), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('forms.threePointTest.title')}
      size="lg"
      errors={formErrorSummary(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void form.handleSubmit(submit)()}>
            {t('forms.threePointTest.submit')}
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
        <p>{t('forms.threePointTest.intro')}</p>
        <Controller control={form.control} name="assessedAt" render={({ field }) => <DateField label={t('forms.threePointTest.date.label')} required value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} error={errors.assessedAt?.message} />} />
        {(['a', 'b', 'c'] as const).map((k) => (
          <div key={k} className="stack" style={{ gap: 8 }}>
            <Controller control={form.control} name={`${k}.met`} render={({ field }) => <RadioGroup legend={t('forms.threePointTest.limbLegend', { label: THREE_POINT_LIMBS[k].label, text: THREE_POINT_LIMBS[k].text })} name={`${k}-met`} value={field.value} onChange={field.onChange} orientation="horizontal" options={[{ value: 'yes', label: t('forms.threePointTest.met.met') }, { value: 'no', label: t('forms.threePointTest.met.notMet') }, { value: 'unclear', label: t('forms.threePointTest.met.unclear') }]} />} />
            <TextareaField label={t('forms.threePointTest.reasoning.label', { limb: k })} required {...form.register(`${k}.reasoning`)} error={errors[k]?.reasoning?.message} />
          </div>
        ))}
        <Controller
          control={form.control}
          name="harmTypes"
          render={({ field }) => (
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 6 }}>{t('forms.threePointTest.harm.legend')}</legend>
              {errors.harmTypes ? <div role="alert" style={{ color: 'var(--color-risk-critical)', fontSize: 'var(--text-sm)' }}>{errors.harmTypes.message}</div> : null}
              <div className="cluster">
                {HARM_TYPES.map((h) => (
                  <CheckboxField key={h} label={harmTypeLabel(h)} checked={field.value.includes(h)} onChange={(e) => field.onChange(e.target.checked ? [...field.value, h] : field.value.filter((x) => x !== h))} />
                ))}
              </div>
            </fieldset>
          )}
        />
        <TextareaField label={t('forms.threePointTest.safety.label')} required {...form.register('immediateSafety')} error={errors.immediateSafety?.message} />
      </form>
    </Dialog>
  );
}
