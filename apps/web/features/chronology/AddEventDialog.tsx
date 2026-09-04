'use client';

import { EVENT_TYPES, SIGNIFICANCES, significanceLabel, type ChronologyAnalysis, type ChronologyEvent } from '@mas/domain';
import { useT, type Translator } from '@mas/messages';
import { Button, CheckboxField, DateField, Dialog, RadioGroup, SelectField, TextField, TextareaField, useToast } from '@mas/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAppStore, useCurrentUser, useData, useNow } from '@/lib/store';
import { formErrorSummary } from '@/lib/formErrors';
import { useWriteErrors } from '@/lib/writeErrors';

/** Built with the translator so every validation message comes from the catalogue and follows an Admin override. */
function buildSchema(t: Translator) {
  const factSchema = z
    .object({
      kind: z.literal('fact'),
      occurredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t('chronology.addEvent.errors.date')),
      occurredTime: z.string().optional(),
      approximate: z.boolean(),
      eventType: z.enum(EVENT_TYPES),
      title: z.string().min(5, t('chronology.addEvent.errors.title')).max(120),
      detail: z.string().min(10, t('chronology.addEvent.errors.detail')).max(600),
      response: z.string().max(400).optional(),
      outcome: z.string().max(400).optional(),
      significance: z.enum(SIGNIFICANCES),
      significanceReason: z.string().max(200).optional(),
      visibility: z.enum(['agency-only', 'integrated']),
      purpose: z.string().max(200).optional(),
      necessity: z.string().max(600).optional(),
    })
    .superRefine((v, ctx) => {
      if (v.significance === 'high' && !v.significanceReason?.trim()) ctx.addIssue({ code: 'custom', path: ['significanceReason'], message: t('chronology.addEvent.errors.significanceReason') });
      if (v.visibility === 'integrated') {
        if (!v.purpose || v.purpose.trim().length < 5) ctx.addIssue({ code: 'custom', path: ['purpose'], message: t('chronology.addEvent.errors.purpose') });
        if (!v.necessity || v.necessity.trim().length < 20) ctx.addIssue({ code: 'custom', path: ['necessity'], message: t('chronology.addEvent.errors.necessity') });
      }
      if (/\b(I think|I believe|in my view|seems|appears to be|probably)\b/i.test(`${v.title} ${v.detail}`)) ctx.addIssue({ code: 'custom', path: ['detail'], message: t('chronology.addEvent.errors.opinion') });
    });

  const analysisSchema = z.object({
    kind: z.literal('analysis'),
    eventIds: z.array(z.string()).min(1, t('chronology.addEvent.errors.eventIds')),
    analysisKind: z.enum(['pattern', 'risk', 'recommendation']),
    title: z.string().min(5).max(120),
    text: z.string().min(20, t('chronology.addEvent.errors.text')).max(1200),
  });

  return z.discriminatedUnion('kind', [factSchema, analysisSchema]);
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

export interface AddEventDialogProps {
  open: boolean;
  onClose: () => void;
  personId: string;
  processIds: string[];
  recentEvents: ChronologyEvent[];
}

/** One form, two records: a fact or an analysis note. The separation is enforced by the schema. */
export function AddEventDialog({ open, onClose, personId, processIds, recentEvents }: AddEventDialogProps) {
  const t = useT();
  const user = useCurrentUser();
  const now = useNow();
  const data = useData();
  const write = useAppStore((s) => s.write);
  const newId = useAppStore((s) => s.newId);
  const readErrors = useWriteErrors();
  const { toast } = useToast();
  const [refusals, setRefusals] = useState<string[]>([]);
  const schema = useMemo(() => buildSchema(t), [t]);
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
      const result = write({ collection: 'analyses', record: a, intent: 'create', act: 'create', targetType: 'event', targetLabel: t('chronology.addEvent.audit.analysis', { title: a.title }), processId: processIds[0] });
      if (!result.ok) {
        setRefusals(result.errors);
        return;
      }
      toast({ title: t('chronology.addEvent.toast.analysisTitle'), text: t('chronology.addEvent.toast.analysisText'), tone: 'success' });
    } else {
      // An event raised to the integrated view rests on a lawful basis. The pipeline writes it from
      // the purpose and the necessity typed here; the event names it before either exists.
      const lawfulBasisId = values.visibility === 'integrated' ? newId('lb') : undefined;
      const occurredAt = values.occurredTime ? `${values.occurredDate}T${values.occurredTime}:00+01:00` : `${values.occurredDate}T00:00:00+01:00`;
      const ev: ChronologyEvent = { id: newId('evt'), synthetic: true, subjectIds: [personId], occurredAt, hasTime: Boolean(values.occurredTime), approximate: values.approximate, recordedAt: now.toISOString(), agency: user.agency, sourceSystem: 'manual', recordedByUserId: user.id, recordedByName: by, eventType: values.eventType, title: values.title, detail: values.detail, response: values.response || undefined, outcome: values.outcome || undefined, significance: values.significance, significanceReason: values.significanceReason || undefined, linkedPersonIds: [], linkedProcessIds: processIds, evidenceRefs: [], visibility: values.visibility, lawfulBasisId, versions: [{ at: now.toISOString(), byUserId: user.id, byName: by, change: t('chronology.addEvent.audit.recorded') }] };
      const result = write({
        collection: 'events',
        record: ev,
        intent: 'create',
        act: 'create',
        targetType: 'event',
        targetLabel: ev.title,
        processId: processIds[0],
        lawfulBasis: lawfulBasisId ? { id: lawfulBasisId, purpose: values.purpose ?? '', necessity: values.necessity ?? '', processes: data.processes.filter((p) => processIds.includes(p.id)) } : undefined,
      });
      if (!result.ok) {
        setRefusals(result.errors);
        return;
      }
      toast({ title: t('chronology.addEvent.toast.factTitle'), text: values.visibility === 'integrated' ? t('chronology.addEvent.toast.factIntegrated') : t('chronology.addEvent.toast.factAgency'), tone: 'success' });
    }
    setRefusals([]);
    form.reset();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('chronology.addEvent.title')}
      size="lg"
      errors={[...readErrors(refusals), ...formErrorSummary(errors)]}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void form.handleSubmit(submit)()}>
            {kind === 'analysis' ? t('chronology.addEvent.submitAnalysis') : t('chronology.addEvent.submitFact')}
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
              legend={t('chronology.addEvent.kind.legend')}
              name="kind"
              value={field.value}
              onChange={(v) => {
                if (v === 'analysis') form.reset({ kind: 'analysis', eventIds: [], analysisKind: 'pattern', title: '', text: '' });
                else form.reset({ kind: 'fact', occurredDate: now.toISOString().slice(0, 10), approximate: false, eventType: 'social-work.visit', title: '', detail: '', significance: 'moderate', visibility: 'agency-only' });
              }}
              orientation="horizontal"
              options={[
                { value: 'fact', label: t('chronology.addEvent.kind.fact'), hint: t('chronology.addEvent.kind.factHint') },
                { value: 'analysis', label: t('chronology.addEvent.kind.analysis'), hint: t('chronology.addEvent.kind.analysisHint') },
              ]}
            />
          )}
        />
        {kind === 'fact' ? (
          <>
            <div className="cluster" style={{ alignItems: 'flex-start' }}>
              <Controller control={form.control} name="occurredDate" render={({ field }) => <DateField label={t('chronology.addEvent.fields.date')} required value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} error={'occurredDate' in errors ? errors.occurredDate?.message : undefined} />} />
              <TextField label={t('chronology.addEvent.fields.time')} type="time" {...form.register('occurredTime')} />
              <CheckboxField label={t('chronology.addEvent.fields.approximate')} {...form.register('approximate')} />
            </div>
            <SelectField label={t('chronology.addEvent.fields.eventType')} required {...form.register('eventType')} options={EVENT_TYPES.map((eventType) => ({ value: eventType, label: eventType }))} />
            <TextField label={t('chronology.addEvent.fields.title')} required maxLength={120} {...form.register('title')} error={'title' in errors ? errors.title?.message : undefined} />
            <TextareaField label={t('chronology.addEvent.fields.detail')} required maxLength={600} {...form.register('detail')} error={'detail' in errors ? errors.detail?.message : undefined} hint={t('chronology.addEvent.fields.detailHint')} />
            <TextareaField label={t('chronology.addEvent.fields.response')} maxLength={400} {...form.register('response')} />
            <TextareaField label={t('chronology.addEvent.fields.outcome')} maxLength={400} {...form.register('outcome')} />
            <SelectField label={t('chronology.addEvent.fields.significance')} required {...form.register('significance')} options={SIGNIFICANCES.map((s) => ({ value: s, label: significanceLabel(s) }))} />
            {significance === 'high' ? <TextField label={t('chronology.addEvent.fields.significanceReason')} required {...form.register('significanceReason')} error={'significanceReason' in errors ? errors.significanceReason?.message : undefined} /> : null}
            <Controller
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <RadioGroup
                  legend={t('chronology.addEvent.visibility.legend')}
                  name="visibility"
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: 'agency-only', label: t('chronology.addEvent.visibility.agencyOnly'), hint: t('chronology.addEvent.visibility.agencyOnlyHint') },
                    { value: 'integrated', label: t('chronology.addEvent.visibility.integrated'), hint: t('chronology.addEvent.visibility.integratedHint') },
                  ]}
                />
              )}
            />
            {visibility === 'integrated' ? (
              <>
                <TextField label={t('chronology.addEvent.fields.purpose')} required {...form.register('purpose')} error={'purpose' in errors ? errors.purpose?.message : undefined} />
                <TextareaField label={t('chronology.addEvent.fields.necessity')} required {...form.register('necessity')} error={'necessity' in errors ? errors.necessity?.message : undefined} hint={t('chronology.addEvent.fields.necessityHint')} />
              </>
            ) : null}
          </>
        ) : (
          <>
            <SelectField label={t('chronology.addEvent.analysis.kind')} required {...form.register('analysisKind')} options={[{ value: 'pattern', label: t('chronology.addEvent.analysis.kindPattern') }, { value: 'risk', label: t('chronology.addEvent.analysis.kindRisk') }, { value: 'recommendation', label: t('chronology.addEvent.analysis.kindRecommendation') }]} />
            <TextField label={t('chronology.addEvent.analysis.title')} required maxLength={120} {...form.register('title')} error={'title' in errors ? errors.title?.message : undefined} />
            <TextareaField label={t('chronology.addEvent.analysis.text')} required maxLength={1200} {...form.register('text')} error={'text' in errors ? errors.text?.message : undefined} />
            <Controller
              control={form.control}
              name="eventIds"
              render={({ field }) => (
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 6 }}>{t('chronology.addEvent.analysis.eventsLegend')}</legend>
                  {'eventIds' in errors && errors.eventIds ? <div role="alert" style={{ color: 'var(--color-risk-critical)', fontSize: 'var(--text-sm)' }}>{errors.eventIds.message}</div> : null}
                  <div className="stack" style={{ gap: 4, maxHeight: 220, overflow: 'auto' }}>
                    {recentEvents.slice(0, 40).map((e) => (
                      <CheckboxField
                        key={e.id}
                        label={t('chronology.addEvent.analysis.eventOption', { date: e.occurredAt.slice(0, 10), title: e.title })}
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
