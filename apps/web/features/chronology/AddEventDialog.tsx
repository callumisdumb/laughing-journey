'use client';

import { EVENT_TYPES, SIGNIFICANCES, type ChronologyAnalysis, type ChronologyEvent, type LawfulBasisRecord } from '@mas/domain';
import { Button, CheckboxField, DateField, Dialog, RadioGroup, SelectField, TextField, TextareaField, useToast } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAppStore, useCurrentUser, useNow } from '@/lib/store';

const factSchema = z
  .object({
    kind: z.literal('fact'),
    occurredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a date'),
    occurredTime: z.string().optional(),
    approximate: z.boolean(),
    eventType: z.enum(EVENT_TYPES),
    title: z.string().min(5, 'Say what happened in one line').max(120),
    detail: z.string().min(10, 'A short factual detail is required').max(600),
    response: z.string().max(400).optional(),
    outcome: z.string().max(400).optional(),
    significance: z.enum(SIGNIFICANCES),
    significanceReason: z.string().max(200).optional(),
    visibility: z.enum(['agency-only', 'integrated']),
    purpose: z.string().max(200).optional(),
    necessity: z.string().max(600).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.significance === 'high' && !v.significanceReason?.trim()) ctx.addIssue({ code: 'custom', path: ['significanceReason'], message: 'High significance needs a reason' });
    if (v.visibility === 'integrated') {
      if (!v.purpose || v.purpose.trim().length < 5) ctx.addIssue({ code: 'custom', path: ['purpose'], message: 'Sharing needs a purpose' });
      if (!v.necessity || v.necessity.trim().length < 20) ctx.addIssue({ code: 'custom', path: ['necessity'], message: 'Say why sharing is necessary and proportionate' });
    }
    if (/\b(I think|I believe|in my view|seems|appears to be|probably)\b/i.test(`${v.title} ${v.detail}`)) ctx.addIssue({ code: 'custom', path: ['detail'], message: 'This reads as opinion. Record the fact here and put your judgement in an analysis note.' });
  });

const analysisSchema = z.object({
  kind: z.literal('analysis'),
  eventIds: z.array(z.string()).min(1, 'Link at least one event'),
  analysisKind: z.enum(['pattern', 'risk', 'recommendation']),
  title: z.string().min(5).max(120),
  text: z.string().min(20, 'Explain your judgement and what it rests on').max(1200),
});

const schema = z.discriminatedUnion('kind', [factSchema, analysisSchema]);
type FormValues = z.infer<typeof schema>;

export interface AddEventDialogProps {
  open: boolean;
  onClose: () => void;
  personId: string;
  processIds: string[];
  recentEvents: ChronologyEvent[];
}

/** One form, two records: a fact or an analysis note. The separation is enforced by the schema. */
export function AddEventDialog({ open, onClose, personId, processIds, recentEvents }: AddEventDialogProps) {
  const user = useCurrentUser();
  const now = useNow();
  const upsert = useAppStore((s) => s.upsert);
  const audit = useAppStore((s) => s.audit);
  const newId = useAppStore((s) => s.newId);
  const { toast } = useToast();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { kind: 'fact', occurredDate: now.toISOString().slice(0, 10), approximate: false, eventType: 'social-work.visit', title: '', detail: '', significance: 'moderate', visibility: 'agency-only' },
  });
  const kind = form.watch('kind');
  const significance = form.watch('significance');
  const visibility = form.watch('visibility');
  const errors = form.formState.errors;

  function submit(values: FormValues) {
    if (!user) return;
    const by = `${user.givenName} ${user.familyName}`;
    if (values.kind === 'analysis') {
      const a: ChronologyAnalysis = { id: newId('ana'), synthetic: true, subjectId: personId, processId: processIds[0], eventIds: values.eventIds, authorUserId: user.id, authorName: by, agency: user.agency, recordedAt: now.toISOString(), kind: values.analysisKind, title: values.title, text: values.text };
      upsert('analyses', a);
      audit({ act: 'edit', targetType: 'event', targetId: a.id, targetLabel: `Analysis note: ${a.title}`, processId: processIds[0] });
      toast({ title: 'Analysis note recorded', text: 'It sits in the analysis lane, linked to the facts it rests on.', tone: 'success' });
    } else {
      let lawfulBasisId: string | undefined;
      if (values.visibility === 'integrated') {
        const lb: LawfulBasisRecord = { id: newId('lb'), synthetic: true, purpose: values.purpose ?? '', article6: '6(1)(e) public task', article9Condition: '9(2)(g) substantial public interest, DPA 2018 Sch 1 Pt 2 para 18 (safeguarding)', article10Criminal: user.agency === 'police' ? 'DPA 2018 s10 and Sch 1' : 'not applicable', statutoryGateway: ['Recorded at event entry'], necessityAndProportionality: values.necessity ?? '', consentStatus: 'not-required', authorisedByUserId: user.id, authorisedByName: by, createdAt: now.toISOString() };
        upsert('lawfulBases', lb);
        lawfulBasisId = lb.id;
      }
      const occurredAt = values.occurredTime ? `${values.occurredDate}T${values.occurredTime}:00+01:00` : `${values.occurredDate}T00:00:00+01:00`;
      const ev: ChronologyEvent = { id: newId('evt'), synthetic: true, subjectIds: [personId], occurredAt, hasTime: Boolean(values.occurredTime), approximate: values.approximate, recordedAt: now.toISOString(), agency: user.agency, sourceSystem: 'manual', recordedByUserId: user.id, recordedByName: by, eventType: values.eventType, title: values.title, detail: values.detail, response: values.response || undefined, outcome: values.outcome || undefined, significance: values.significance, significanceReason: values.significanceReason || undefined, linkedPersonIds: [], linkedProcessIds: processIds, evidenceRefs: [], visibility: values.visibility, lawfulBasisId, versions: [{ at: now.toISOString(), byUserId: user.id, byName: by, change: 'Recorded' }] };
      upsert('events', ev);
      audit({ act: 'edit', targetType: 'event', targetId: ev.id, targetLabel: ev.title, processId: processIds[0] });
      toast({ title: 'Event recorded', text: values.visibility === 'integrated' ? 'Shared into the integrated chronology with a lawful basis.' : "Added to your agency's chronology.", tone: 'success' });
    }
    form.reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record in the chronology"
      size="lg"
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void form.handleSubmit(submit)()}>
            {kind === 'analysis' ? 'Record analysis note' : 'Record event'}
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={(e) => e.preventDefault()} noValidate>
        <Controller
          control={form.control}
          name="kind"
          render={({ field }) => (
            <RadioGroup
              legend="What are you recording?"
              name="kind"
              value={field.value}
              onChange={(v) => {
                if (v === 'analysis') form.reset({ kind: 'analysis', eventIds: [], analysisKind: 'pattern', title: '', text: '' });
                else form.reset({ kind: 'fact', occurredDate: now.toISOString().slice(0, 10), approximate: false, eventType: 'social-work.visit', title: '', detail: '', significance: 'moderate', visibility: 'agency-only' });
              }}
              orientation="horizontal"
              options={[
                { value: 'fact', label: 'A fact', hint: 'Something that happened: dated, brief, no opinion.' },
                { value: 'analysis', label: 'An analysis note', hint: 'Your professional judgement about facts already recorded.' },
              ]}
            />
          )}
        />
        {kind === 'fact' ? (
          <>
            <div className="cluster" style={{ alignItems: 'flex-start' }}>
              <Controller control={form.control} name="occurredDate" render={({ field }) => <DateField label="Date" required value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} error={'occurredDate' in errors ? errors.occurredDate?.message : undefined} />} />
              <TextField label="Time (if known)" type="time" {...form.register('occurredTime')} />
              <CheckboxField label="Date is approximate" {...form.register('approximate')} />
            </div>
            <SelectField label="Event type" required {...form.register('eventType')} options={EVENT_TYPES.map((t) => ({ value: t, label: t }))} />
            <TextField label="Title (one line, plain language)" required maxLength={120} {...form.register('title')} error={'title' in errors ? errors.title?.message : undefined} />
            <TextareaField label="Detail (short and factual)" required maxLength={600} {...form.register('detail')} error={'detail' in errors ? errors.detail?.message : undefined} hint="What happened, who was there, what was seen or said. Not what you think about it." />
            <TextareaField label="Response (what was done)" maxLength={400} {...form.register('response')} />
            <TextareaField label="Outcome (what changed)" maxLength={400} {...form.register('outcome')} />
            <SelectField label="Significance" required {...form.register('significance')} options={SIGNIFICANCES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))} />
            {significance === 'high' ? <TextField label="Why is this high significance?" required {...form.register('significanceReason')} error={'significanceReason' in errors ? errors.significanceReason?.message : undefined} /> : null}
            <Controller
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <RadioGroup
                  legend="Visibility"
                  name="visibility"
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: 'agency-only', label: 'My agency only', hint: 'Single-agency chronology.' },
                    { value: 'integrated', label: 'Integrated chronology', hint: 'Shared with the other agencies on the case. A lawful basis is recorded.' },
                  ]}
                />
              )}
            />
            {visibility === 'integrated' ? (
              <>
                <TextField label="Purpose of sharing" required {...form.register('purpose')} error={'purpose' in errors ? errors.purpose?.message : undefined} />
                <TextareaField label="Necessity and proportionality" required {...form.register('necessity')} error={'necessity' in errors ? errors.necessity?.message : undefined} hint="Why the other agencies need this to protect the person, and why nothing less would do." />
              </>
            ) : null}
          </>
        ) : (
          <>
            <SelectField label="Kind of note" required {...form.register('analysisKind')} options={[{ value: 'pattern', label: 'Pattern' }, { value: 'risk', label: 'Risk judgement' }, { value: 'recommendation', label: 'Recommendation' }]} />
            <TextField label="Title" required maxLength={120} {...form.register('title')} error={'title' in errors ? errors.title?.message : undefined} />
            <TextareaField label="Your judgement and what it rests on" required maxLength={1200} {...form.register('text')} error={'text' in errors ? errors.text?.message : undefined} />
            <Controller
              control={form.control}
              name="eventIds"
              render={({ field }) => (
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 6 }}>Facts this note rests on (required)</legend>
                  {'eventIds' in errors && errors.eventIds ? <div role="alert" style={{ color: 'var(--color-risk-critical)', fontSize: 'var(--text-sm)' }}>{errors.eventIds.message}</div> : null}
                  <div className="stack" style={{ gap: 4, maxHeight: 220, overflow: 'auto' }}>
                    {recentEvents.slice(0, 40).map((e) => (
                      <CheckboxField
                        key={e.id}
                        label={`${e.occurredAt.slice(0, 10)}: ${e.title}`}
                        checked={field.value.includes(e.id)}
                        onChange={(ev) => field.onChange(ev.target.checked ? [...field.value, e.id] : field.value.filter((x) => x !== e.id))}
                      />
                    ))}
                  </div>
                </fieldset>
              )}
            />
          </>
        )}
      </form>
    </Dialog>
  );
}
