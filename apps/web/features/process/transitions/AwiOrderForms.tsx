'use client';

import { awiOrderKindLabel, formatDate, type AwiProcess, type OrderLifecycleInput } from '@mas/domain';
import { useT } from '@mas/messages';
import { DateField, SelectField, TextField, TextareaField } from '@mas/ui';
import { transitionForm, type TransitionFormProps } from './registry';
import styles from './transitions.module.css';

/**
 * The life of a guardianship order after it is granted (D-252): renewed, varied, recalled, appealed.
 * One component with four shapes, because each asks which order and what the court decided, and
 * differs only in what it adds. The order picker lists the orders the case holds, so an adult with
 * more than one is never ambiguous.
 */
function OrderForm({ process, value, onChange, kind }: TransitionFormProps<OrderLifecycleInput> & { kind: 'renew' | 'vary' | 'recall' | 'appeal' }) {
  const t = useT();
  const orders = (process as AwiProcess).detail.orders.filter((o) => (kind === 'recall' ? !o.recalledAt : true));
  const chosen = orders.find((o) => o.id === value.orderId);
  return (
    <div className="stack">
      <p className={styles.hint}>{t(kind === 'renew' ? 'processes.forms.orderLifecycle.hintRenew' : kind === 'vary' ? 'processes.forms.orderLifecycle.hintVary' : kind === 'recall' ? 'processes.forms.orderLifecycle.hintRecall' : 'processes.forms.orderLifecycle.hintAppeal')}</p>
      <SelectField
        label={t('processes.forms.orderLifecycle.order')}
        required
        value={value.orderId}
        onChange={(e) => onChange({ ...value, orderId: e.target.value, powers: orders.find((o) => o.id === e.target.value)?.powers ?? value.powers })}
        options={orders.map((o) => ({ value: o.id, label: `${awiOrderKindLabel(o.kind)}, granted ${formatDate(o.grantedAt)}${o.expiresAt ? `, expires ${formatDate(o.expiresAt)}` : ''}` }))}
        data-testid="transition-order"
      />
      <DateField label={t('processes.forms.orderLifecycle.at')} hint={t('processes.forms.orderLifecycle.atHint')} required value={value.at} onChange={(v) => onChange({ ...value, at: v })} data-testid="transition-at" />
      {kind === 'renew' ? <DateField label={t('processes.forms.orderLifecycle.expiresAt')} required value={value.expiresAt ?? ''} onChange={(v) => onChange({ ...value, expiresAt: v })} data-testid="transition-expires" /> : null}
      {kind === 'vary' ? (
        <TextareaField
          label={t('processes.forms.orderLifecycle.powers')}
          hint={t('processes.forms.orderLifecycle.powersHint')}
          value={(value.powers ?? chosen?.powers ?? []).join('\n')}
          onChange={(e) => onChange({ ...value, powers: e.target.value.split('\n').map((p) => p.trim()).filter(Boolean) })}
          rows={4}
          required
          data-testid="transition-powers"
        />
      ) : null}
      {kind === 'appeal' ? (
        <>
          <TextField label={t('processes.forms.orderLifecycle.appellant')} required value={value.appellant ?? ''} onChange={(e) => onChange({ ...value, appellant: e.target.value })} data-testid="transition-appellant" />
          <SelectField
            label={t('processes.forms.orderLifecycle.appealOutcome')}
            value={value.appealOutcome ?? 'lodged'}
            onChange={(e) => onChange({ ...value, appealOutcome: e.target.value as OrderLifecycleInput['appealOutcome'] })}
            options={APPEAL_OUTCOMES.map((o) => ({ value: o.id, label: t(o.key) }))}
            data-testid="transition-appeal-outcome"
          />
        </>
      ) : null}
      <TextareaField label={t('processes.forms.orderLifecycle.summary')} value={value.summary} onChange={(e) => onChange({ ...value, summary: e.target.value })} rows={3} required data-testid="transition-summary" />
    </div>
  );
}

const APPEAL_OUTCOMES = [
  { id: 'lodged', key: 'processes.forms.orderLifecycle.appealLodged' },
  { id: 'allowed', key: 'processes.forms.orderLifecycle.appealAllowed' },
  { id: 'refused', key: 'processes.forms.orderLifecycle.appealRefused' },
  { id: 'withdrawn', key: 'processes.forms.orderLifecycle.appealWithdrawn' },
] as const;

/** The first order the case holds, so the picker opens on something rather than on nothing. */
const first = (process: AwiProcess, recallable = false): string => (process.detail.orders.filter((o) => (recallable ? !o.recalledAt : true))[0]?.id ?? '');

export const AWI_RENEW_ORDER = transitionForm<OrderLifecycleInput>((process, { now }) => ({ orderId: first(process as AwiProcess), at: now.toISOString().slice(0, 10), summary: '', expiresAt: '' }), (props) => <OrderForm {...props} kind="renew" />);
export const AWI_VARY_ORDER = transitionForm<OrderLifecycleInput>((process, { now }) => ({ orderId: first(process as AwiProcess), at: now.toISOString().slice(0, 10), summary: '', powers: (process as AwiProcess).detail.orders[0]?.powers ?? [] }), (props) => <OrderForm {...props} kind="vary" />);
export const AWI_RECALL_ORDER = transitionForm<OrderLifecycleInput>((process, { now }) => ({ orderId: first(process as AwiProcess, true), at: now.toISOString().slice(0, 10), summary: '' }), (props) => <OrderForm {...props} kind="recall" />);
export const AWI_RECORD_APPEAL = transitionForm<OrderLifecycleInput>((process, { now }) => ({ orderId: first(process as AwiProcess), at: now.toISOString().slice(0, 10), summary: '', appellant: '', appealOutcome: 'lodged' }), (props) => <OrderForm {...props} kind="appeal" />);
