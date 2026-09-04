'use client';

import { aspOrderDecisionLabel, aspOrderLabel, computeClock, findClockRule, formatDate, workingCalendarFrom, type AspDetail, type AspProcess, type ClockTrigger } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, DateField, Dialog, SelectField, TextareaField, useToast } from '@mas/ui';
import { useState } from 'react';
import { useAppStore, useConfig, useNow } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './records.module.css';

type Order = AspDetail['ordersConsidered'][number]['order'];
type Decision = AspDetail['ordersConsidered'][number]['decision'];

const ORDERS = ['assessment-order-s11', 'removal-order-s14', 'banning-order-s19', 'warrant-for-entry'] as const satisfies readonly Order[];
const DECISIONS = ['not-required', 'application-drafting', 'applied', 'granted', 'refused'] as const satisfies readonly Decision[];

/**
 * The clocks a granted order starts, which are the order's statutory duration.
 *
 * The durations are not repeated here. They are already in the clock rules with their citation, so
 * the dialog names the rules and the rule table decides how long each order lasts. A warrant for
 * entry has no duration rule of its own, which is why it maps to nothing rather than to a guess.
 */
const CLOCKS_ON_GRANT: Record<Order, string[]> = {
  'assessment-order-s11': ['asp.order.assessment.validity'],
  'removal-order-s14': ['asp.order.removal.validity', 'asp.order.removal.executeBy'],
  'banning-order-s19': ['asp.order.banning.maximum'],
  'warrant-for-entry': [],
};

/**
 * A protection order application recorded against an adult support and protection case.
 *
 * One entry per order type, replaced rather than duplicated, because the panel and the national
 * return both ask "what happened about the removal order" and not "how many times was it discussed".
 * Recording a grant starts the order's statutory clock, and the dialog shows the date that clock
 * will land on before the practitioner presses Record, because a removal order that must be executed
 * within 72 hours is a fact somebody needs on the day rather than in the audit trail afterwards.
 */
export function ProtectionOrderDialog({ process, open, onClose }: { process: AspProcess; open: boolean; onClose: () => void }) {
  const t = useT();
  const config = useConfig();
  const now = useNow();
  const write = useAppStore((s) => s.write);
  const newId = useAppStore((s) => s.newId);
  const readErrors = useWriteErrors();
  const { toast } = useToast();

  const [order, setOrder] = useState<Order>('assessment-order-s11');
  const [decision, setDecision] = useState<Decision>('applied');
  const [grantedAt, setGrantedAt] = useState(now.toISOString().slice(0, 10));
  const [rationale, setRationale] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const granted = decision === 'granted';
  const ruleIds = granted ? CLOCKS_ON_GRANT[order] : [];
  // Shown before the write, from the same rules the write will use, so the preview cannot drift.
  const preview = ruleIds.flatMap((ruleId) => {
    const rule = findClockRule(config.clockRules, ruleId);
    if (!rule) return [];
    const trigger: ClockTrigger = { id: 'preview', ruleId, triggeredAt: `${grantedAt}T${now.toISOString().slice(11, 19)}Z` };
    const clock = computeClock(trigger, rule, now, { calendar: workingCalendarFrom(config) });
    return [{ ruleId, label: clock.label, dueAt: clock.dueAt }];
  });

  function submit() {
    const entry = { order, decision, considered: true, rationale: rationale.trim() };
    const rules: string[] = [];
    if (entry.rationale.length < 10) rules.push('orderRationaleRequired');

    const kept = process.detail.ordersConsidered.filter((o) => o.order !== order);
    const clocks: ClockTrigger[] = preview.map((p) => ({ id: newId('clk'), ruleId: p.ruleId, triggeredAt: `${grantedAt}T${now.toISOString().slice(11, 19)}Z` }));

    const result = write({
      collection: 'processes',
      record: { ...process, detail: { ...process.detail, ordersConsidered: [...kept, entry] } },
      intent: 'update',
      act: 'edit',
      targetType: 'process',
      targetLabel: t('asp.orders.audit', { order: aspOrderLabel(order), decision: aspOrderDecisionLabel(decision) }),
      processId: process.id,
      rules,
      clocks,
      event: {
        eventType: granted ? 'legal.order-granted' : 'legal.hearing',
        significance: 'high',
        visibility: 'integrated',
        title: t('asp.orders.eventTitle', { order: aspOrderLabel(order), decision: aspOrderDecisionLabel(decision) }),
        detail: entry.rationale,
        subjectIds: process.subjectIds,
        linkedProcessIds: [process.id],
      },
    });

    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast({ title: t('asp.orders.done.title'), text: preview.length > 0 ? t('asp.orders.done.withClocks', { count: preview.length, date: formatDate(preview[0]!.dueAt) }) : t('asp.orders.done.text'), tone: 'success' });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('asp.orders.addTitle')}
      size="md"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} data-testid="order-submit">
            {t('asp.orders.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className={styles.grid}>
          <SelectField label={t('asp.orders.order')} value={order} onChange={(e) => setOrder(e.target.value as Order)} options={ORDERS.map((o) => ({ value: o, label: aspOrderLabel(o) }))} data-testid="order-kind" />
          <SelectField label={t('asp.orders.decision')} value={decision} onChange={(e) => setDecision(e.target.value as Decision)} options={DECISIONS.map((d) => ({ value: d, label: aspOrderDecisionLabel(d) }))} data-testid="order-decision" />
        </div>

        {granted ? <DateField label={t('asp.orders.grantedAt')} hint={t('asp.orders.grantedAtHint')} value={grantedAt} onChange={setGrantedAt} data-testid="order-granted-at" /> : null}

        {preview.length > 0 ? (
          <div className={styles.consequence} data-testid="order-clocks">
            <span className={styles.consequenceHead}>{t('asp.orders.clocksHead')}</span>
            {preview.map((p) => (
              <span key={p.ruleId}>{t('asp.orders.clockLine', { label: p.label, date: formatDate(p.dueAt) })}</span>
            ))}
          </div>
        ) : null}

        <TextareaField label={t('asp.orders.rationale')} hint={t('asp.orders.rationaleHint')} value={rationale} onChange={(e) => setRationale(e.target.value)} rows={3} required data-testid="order-rationale" />
      </div>
    </Dialog>
  );
}
