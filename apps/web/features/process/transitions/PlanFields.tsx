'use client';

import { agencyShort, assignableUsers, roleLabel, type PlanInput, type Process } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, DateField, SelectField, TextField, TextareaField } from '@mas/ui';
import { Plus, X } from 'lucide-react';
import { useMemo } from 'react';
import { userName } from '@/lib/selectors';
import { useConfig, useCurrentUser, useData } from '@/lib/store';
import styles from './transitions.module.css';

/**
 * A plan as the engine takes it: a title, outcomes rather than prose, a coordinator, a review date
 * and the actions that hang off the first outcome, each with an owner the case permits. One editor
 * for every transition that records a plan (the adult protection and support plans, the child's
 * plan, the MARAC action plan, the MAPPA risk management plan), so the rule about who may own an
 * action is asked once, by the same helper the action dialogs use.
 */
export function PlanFields({ process, value, onChange, consent, reviewRequired }: { process: Process; value: PlanInput; onChange: (value: PlanInput) => void; consent?: boolean; reviewRequired?: boolean }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const ctx = useMemo(() => ({ users: data.users, exclusions: config.exclusions, relationships: data.relationships, rows: config.needToKnow }), [data.users, data.relationships, config.exclusions, config.needToKnow]);
  const people = useMemo(() => assignableUsers(process, ctx).filter((u) => u.roleId !== 'system-administrator'), [process, ctx]);
  const coordinators = people.some((u) => u.id === user?.id) || !user ? people : [user, ...people];
  const setAction = (i: number, patch: Partial<PlanInput['actions'][number]>) => onChange({ ...value, actions: value.actions.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  return (
    <div className="stack">
      <TextField label={t('processes.forms.plan.title')} value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} required data-testid="plan-title" />
      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('processes.forms.plan.outcomes')}</legend>
        <p className={styles.hint}>{t('processes.forms.plan.outcomesHint')}</p>
        {value.outcomes.map((outcome, i) => (
          <div key={i} className={styles.row}>
            <TextField label={t('processes.forms.plan.outcome', { number: i + 1 })} value={outcome} onChange={(e) => onChange({ ...value, outcomes: value.outcomes.map((o, j) => (j === i ? e.target.value : o)) })} data-testid={`plan-outcome-${i}`} />
            {value.outcomes.length > 1 ? (
              <Button size="sm" variant="quiet" icon={<X size={14} aria-hidden="true" />} onClick={() => onChange({ ...value, outcomes: value.outcomes.filter((_, j) => j !== i) })}>
                {t('processes.forms.plan.remove')}
              </Button>
            ) : null}
          </div>
        ))}
        <div>
          <Button size="sm" variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => onChange({ ...value, outcomes: [...value.outcomes, ''] })} data-testid="plan-add-outcome">
            {t('processes.forms.plan.addOutcome')}
          </Button>
        </div>
      </fieldset>
      <div className={styles.grid}>
        <SelectField
          label={t('processes.forms.plan.coordinator')}
          value={value.coordinatorUserId ?? ''}
          onChange={(e) => {
            const u = data.users.find((x) => x.id === e.target.value);
            onChange({ ...value, coordinatorUserId: u?.id, coordinatorName: u ? userName(u) : '' });
          }}
          placeholder={t('processes.forms.plan.coordinatorPlaceholder')}
          options={coordinators.map((u) => ({ value: u.id, label: `${userName(u)} (${roleLabel(u.roleId)}, ${agencyShort(u.agency)})` }))}
          required
          data-testid="plan-coordinator"
        />
        <DateField label={reviewRequired ? t('processes.forms.plan.reviewDateRequired') : t('processes.forms.plan.reviewDate')} value={value.reviewDate ?? ''} onChange={(d) => onChange({ ...value, reviewDate: d || undefined })} required={reviewRequired} data-testid="plan-review-date" />
      </div>
      {consent ? <TextareaField label={t('processes.forms.plan.consent')} hint={t('processes.forms.plan.consentHint')} value={value.consentNote ?? ''} onChange={(e) => onChange({ ...value, consentNote: e.target.value })} rows={2} required data-testid="plan-consent" /> : null}
      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('processes.forms.plan.actions')}</legend>
        <p className={styles.hint}>{t('processes.forms.plan.actionsHint')}</p>
        {value.actions.map((a, i) => (
          <div key={i} className={styles.actionRow}>
            <TextField label={t('processes.forms.plan.actionTitle')} value={a.title} onChange={(e) => setAction(i, { title: e.target.value })} data-testid={`plan-action-title-${i}`} />
            <SelectField
              label={t('processes.forms.plan.actionOwner')}
              value={a.ownerUserId ?? ''}
              onChange={(e) => {
                const u = data.users.find((x) => x.id === e.target.value);
                if (u) setAction(i, { ownerUserId: u.id, ownerName: userName(u), ownerAgency: u.agency, ownerRoleId: undefined });
              }}
              placeholder={t('processes.forms.plan.actionOwnerPlaceholder')}
              options={people.map((u) => ({ value: u.id, label: `${userName(u)} (${agencyShort(u.agency)})` }))}
              data-testid={`plan-action-owner-${i}`}
            />
            <DateField label={t('processes.forms.plan.actionDue')} value={a.due} onChange={(d) => setAction(i, { due: d })} data-testid={`plan-action-due-${i}`} />
            <Button size="sm" variant="quiet" icon={<X size={14} aria-hidden="true" />} onClick={() => onChange({ ...value, actions: value.actions.filter((_, j) => j !== i) })} aria-label={t('processes.forms.plan.removeAction')}>
              {t('processes.forms.plan.remove')}
            </Button>
          </div>
        ))}
        <div>
          <Button size="sm" variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => onChange({ ...value, actions: [...value.actions, { title: '', ownerUserId: undefined, ownerName: '', ownerAgency: 'social-work', due: '' }] })} data-testid="plan-add-action">
            {t('processes.forms.plan.addAction')}
          </Button>
        </div>
      </fieldset>
    </div>
  );
}

/** A plan before anybody has typed: one empty outcome, the current user coordinating, no actions. */
export function emptyPlan(coordinator: { id: string; name: string } | null, extra: Partial<PlanInput> = {}): PlanInput {
  return { title: '', outcomes: [''], coordinatorUserId: coordinator?.id, coordinatorName: coordinator?.name ?? '', actions: [], ...extra };
}
