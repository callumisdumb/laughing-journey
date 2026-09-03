'use client';

import { HARM_TYPES, HARM_TYPE_LABELS, THREE_POINT_LIMBS, threePointTestFormSchema, type AspProcess, type ThreePointTestForm } from '@mas/domain';
import { Button, CheckboxField, DateField, Dialog, RadioGroup, TextareaField, useToast } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useAppStore, useCurrentUser, useNow } from '@/lib/store';

export function ThreePointTestDialog({ open, onClose, process }: { open: boolean; onClose: () => void; process: AspProcess }) {
  const user = useCurrentUser();
  const now = useNow();
  const upsert = useAppStore((s) => s.upsert);
  const audit = useAppStore((s) => s.audit);
  const { toast } = useToast();
  const t = process.detail.threePointTest;
  const form = useForm<ThreePointTestForm>({
    resolver: zodResolver(threePointTestFormSchema),
    defaultValues: { assessedAt: now.toISOString().slice(0, 10), a: { met: t.a.met, reasoning: t.a.reasoning }, b: { met: t.b.met, reasoning: t.b.reasoning }, c: { met: t.c.met, reasoning: t.c.reasoning }, harmTypes: process.detail.concern.harmTypes, immediateSafety: process.detail.concern.immediateSafety },
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
    toast({ title: 'Three-point test recorded', text: parsed.outcome === 'met' ? 'All three limbs met: adult at risk of harm.' : parsed.outcome === 'not-met' ? 'A limb is not met: the adult is not an adult at risk under s3. Consider other support.' : 'A limb is unclear: gather more information under the inquiry.', tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Three-point test (ASP 2007 s3)"
      size="lg"
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void form.handleSubmit(submit)()}>
            Record three-point test
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
        <p>All three limbs must be met. Record your reasoning for each limb; the reasoning is what a reviewer or an inspector reads.</p>
        <Controller control={form.control} name="assessedAt" render={({ field }) => <DateField label="Date of assessment" required value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} error={errors.assessedAt?.message} />} />
        {(['a', 'b', 'c'] as const).map((k) => (
          <div key={k} className="stack" style={{ gap: 8 }}>
            <Controller control={form.control} name={`${k}.met`} render={({ field }) => <RadioGroup legend={`${THREE_POINT_LIMBS[k].label}. ${THREE_POINT_LIMBS[k].text}`} name={`${k}-met`} value={field.value} onChange={field.onChange} orientation="horizontal" options={[{ value: 'yes', label: 'Met' }, { value: 'no', label: 'Not met' }, { value: 'unclear', label: 'Unclear' }]} />} />
            <TextareaField label={`Reasoning for limb (${k})`} required {...form.register(`${k}.reasoning`)} error={errors[k]?.reasoning?.message} />
          </div>
        ))}
        <Controller
          control={form.control}
          name="harmTypes"
          render={({ field }) => (
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 6 }}>Types of harm (all harm counts)</legend>
              {errors.harmTypes ? <div role="alert" style={{ color: 'var(--color-risk-critical)', fontSize: 'var(--text-sm)' }}>{errors.harmTypes.message}</div> : null}
              <div className="cluster">
                {HARM_TYPES.map((h) => (
                  <CheckboxField key={h} label={HARM_TYPE_LABELS[h]} checked={field.value.includes(h)} onChange={(e) => field.onChange(e.target.checked ? [...field.value, h] : field.value.filter((x) => x !== h))} />
                ))}
              </div>
            </fieldset>
          )}
        />
        <TextareaField label="Immediate safety" required {...form.register('immediateSafety')} error={errors.immediateSafety?.message} />
      </form>
    </Dialog>
  );
}
