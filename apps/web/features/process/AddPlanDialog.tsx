'use client';

import { PLAN_TYPES, planTypeLabel, type Plan, type PlanType, type Process } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, DateField, Dialog, SelectField, TextField, TextareaField, useToast } from '@mas/ui';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useAppStore, useCurrentUser, useNow } from '@/lib/store';
import { userName } from '@/lib/selectors';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './AddPlanDialog.module.css';

/**
 * A plan, which is a list of outcomes rather than a document.
 *
 * The outcomes are the plan: actions hang off them, reviews check them, and a plan recorded as one
 * block of prose cannot be reviewed outcome by outcome, which is what a review meeting actually
 * does. So they are entered as a list from the start and each one gets its own row.
 *
 * An adult protection plan must carry a review date unless it has been agreed that no further action
 * is required. That is not a nicety: the ASP national minimum dataset glossary requires it, the
 * schema refuses a plan without one, and the form asks the question rather than letting the refusal
 * arrive after the practitioner has typed everything else.
 */
export function AddPlanDialog({ process, open, onClose }: { process: Process; open: boolean; onClose: () => void }) {
  const t = useT();
  const user = useCurrentUser();
  const now = useNow();
  const write = useAppStore((s) => s.write);
  const newId = useAppStore((s) => s.newId);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const [type, setType] = useState<PlanType>(defaultTypeFor(process));
  const [title, setTitle] = useState('');
  const [outcomes, setOutcomes] = useState<string[]>(['']);
  const [reviewDate, setReviewDate] = useState('');
  const [noFurtherAction, setNoFurtherAction] = useState(false);
  const [consentNote, setConsentNote] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const needsReview = type === 'adult-protection' && !noFurtherAction;

  function submit() {
    if (!user) return;
    const plan: Plan = {
      id: newId('pln'),
      synthetic: true,
      processId: process.id,
      type,
      title: title.trim(),
      outcomes: outcomes.filter((o) => o.trim() !== '').map((text) => ({ id: newId('out'), text: text.trim(), actionIds: [] })),
      coordinatorUserId: user.id,
      coordinatorName: userName(user),
      agreedAt: now.toISOString().slice(0, 10),
      reviewDate: reviewDate || undefined,
      status: 'active',
      consentNote: consentNote.trim() || undefined,
      noFurtherActionAgreed: noFurtherAction || undefined,
    };

    const rules: string[] = [];
    if (plan.title === '') rules.push('planTitleRequired');
    if (plan.outcomes.length === 0) rules.push('planOutcomeRequired');

    const result = write({
      collection: 'plans',
      record: plan,
      intent: 'create',
      act: 'create',
      targetType: 'process',
      targetLabel: `${planTypeLabel(type)}: ${plan.title}`,
      processId: process.id,
      rules,
      event: {
        eventType: 'social-work.plan-review',
        significance: 'high',
        visibility: 'integrated',
        title: t('processes.plans.eventTitle', { type: planTypeLabel(type) }),
        detail: t('processes.plans.eventDetail', { title: plan.title, count: plan.outcomes.length }),
        subjectIds: process.subjectIds,
        linkedProcessIds: [process.id],
      },
    });

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('processes.plans.doneTitle'), text: t('processes.plans.doneText', { title: plan.title, count: plan.outcomes.length }), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('processes.plans.addTitle', { reference: process.reference })}
      size="lg"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} data-testid="plan-submit">
            {t('processes.plans.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className={styles.grid}>
          <SelectField label={t('processes.plans.type')} value={type} onChange={(e) => setType(e.target.value as PlanType)} options={PLAN_TYPES.map((p) => ({ value: p, label: planTypeLabel(p) }))} data-testid="plan-type" />
          <TextField label={t('processes.plans.name')} value={title} onChange={(e) => setTitle(e.target.value)} required data-testid="plan-title" />
        </div>

        <fieldset className={styles.outcomes}>
          <legend className={styles.legend}>{t('processes.plans.outcomes')}</legend>
          <p className={styles.hint}>{t('processes.plans.outcomesHint')}</p>
          {outcomes.map((outcome, i) => (
            <div key={i} className={styles.outcomeRow}>
              <TextField
                label={t('processes.plans.outcomeLabel', { number: i + 1 })}
                value={outcome}
                onChange={(e) => setOutcomes(outcomes.map((o, j) => (j === i ? e.target.value : o)))}
                data-testid={`plan-outcome-${i}`}
              />
              {outcomes.length > 1 ? (
                <Button size="sm" variant="quiet" icon={<X size={14} aria-hidden="true" />} onClick={() => setOutcomes(outcomes.filter((_, j) => j !== i))}>
                  {t('processes.plans.removeOutcome')}
                </Button>
              ) : null}
            </div>
          ))}
          <Button size="sm" variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setOutcomes([...outcomes, ''])} data-testid="plan-add-outcome">
            {t('processes.plans.addOutcome')}
          </Button>
        </fieldset>

        <div className={styles.grid}>
          <DateField label={needsReview ? t('processes.plans.reviewDateRequired') : t('processes.plans.reviewDate')} value={reviewDate} onChange={setReviewDate} hint={needsReview ? t('processes.plans.reviewDateHint') : undefined} data-testid="plan-review-date" />
          {type === 'adult-protection' ? (
            <label className={styles.check}>
              <input type="checkbox" checked={noFurtherAction} onChange={(e) => setNoFurtherAction(e.target.checked)} data-testid="plan-no-further-action" />
              <span>
                {t('processes.plans.noFurtherAction')}
                <span className={styles.hint}>{t('processes.plans.noFurtherActionHint')}</span>
              </span>
            </label>
          ) : null}
        </div>

        {type === 'adult-support' || type === 'adult-protection' ? (
          <TextareaField label={t('processes.plans.consent')} hint={t('processes.plans.consentHint')} value={consentNote} onChange={(e) => setConsentNote(e.target.value)} rows={2} />
        ) : null}
      </div>
    </Dialog>
  );
}

/** The plan type each process usually produces, so the commonest choice is already made. */
function defaultTypeFor(process: Process): PlanType {
  switch (process.type) {
    case 'asp':
      return 'adult-protection';
    case 'cp':
      return 'childs-plan';
    case 'marac':
      return 'marac-action';
    case 'mappa':
      return 'mappa-rmp';
    case 'awi':
      return 'adult-support';
  }
}
