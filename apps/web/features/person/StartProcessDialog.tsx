'use client';

import {
  AGENCIES,
  agencyShort,
  canOpenProcess,
  classificationLabel,
  clockRuleLabel,
  clocksThatWaitFor,
  eligibilityForAll,
  formatDate,
  isYoungAdult,
  maracRepeatCheck,
  nextReference,
  openProcessesOfType,
  openingClassification,
  openingClockRuleIds,
  processLabel,
  resolveNeedToKnow,
  stageLabel,
  OPENING_STAGE,
  type Agency,
  type Person,
  type ProcessType,
} from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, Dialog, Pill, SelectField, TextField, TextareaField, useToast } from '@mas/ui';
import { Ban, Check, Clock, FolderPlus, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { useNavigate } from '@/lib/router';
import { processPath } from '@/lib/routes';
import { fullName } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useNow } from '@/lib/store';
import { useWriteErrors } from '@/lib/writeErrors';
import styles from './StartProcessDialog.module.css';

/**
 * Starting a process, which is where the product either keeps its promise or shows a form.
 *
 * Two gates, both giving reasons rather than hiding the option: eligibility comes from the person,
 * permission comes from the persona, and a greyed action that explains itself teaches the product
 * where a missing one confuses. The 16 and 17 year old is the case worth seeing: adult support and
 * protection and child protection are both offered, both say so, and the choice is recorded, because
 * the national minimum dataset keeps a separate age category for exactly that reason.
 *
 * What opening does is listed before the button, computed from the rules: the reference it will get,
 * the stage it opens at, which statutory clocks start, and where none start, what will start them.
 */
export function StartProcessDialog({ person, open, onClose }: { person: Person; open: boolean; onClose: () => void }) {
  const t = useT();
  const data = useData();
  const user = useCurrentUser();
  const config = useConfig();
  const now = useNow();
  const openProcess = useAppStore((s) => s.openProcess);
  const readErrors = useWriteErrors();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [type, setType] = useState<ProcessType | null>(null);
  const [source, setSource] = useState('');
  const [sourceAgency, setSourceAgency] = useState<Agency>(user?.agency ?? 'social-work');
  const [sourceReference, setSourceReference] = useState('');
  const [summary, setSummary] = useState('');
  const [secondCaseReason, setSecondCaseReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const answers = useMemo(() => eligibilityForAll(person, now), [person, now]);
  const permissions = useMemo(() => new Map(answers.map((a) => [a.type, user ? canOpenProcess(user.roleId, a.type) : ({ allowed: false, reason: '', route: '' } as const)])), [answers, user]);
  const existing = useMemo(() => (type ? openProcessesOfType(data, person.id, type) : []), [data, person.id, type]);
  const repeat = useMemo(() => (type === 'marac' ? maracRepeatCheck(data, person.id, now) : { repeat: false }), [type, data, person.id, now]);

  function close() {
    setType(null);
    setSource('');
    setSummary('');
    setSecondCaseReason('');
    setErrors([]);
    onClose();
  }

  function submit() {
    if (!type) return;
    const result = openProcess({
      type,
      subjectIds: [person.id],
      at: now.toISOString(),
      source,
      sourceAgency,
      sourceReference: sourceReference.trim() || undefined,
      summary,
      byName: user ? `${user.givenName} ${user.familyName}` : '',
      byUserId: user?.id,
      secondCaseReason: secondCaseReason.trim() || undefined,
      /*
       * A MARAC referral needs its three people and its assessment. Opened from a person record the
       * subject is the victim; the perpetrator and the assessment are recorded on the referral form
       * afterwards, which is why this path is offered from the person record and the full referral
       * dialog is offered from the MARAC screen.
       */
      marac: type === 'marac' ? { victimPersonId: person.id, perpetratorPersonId: person.id, childPersonIds: [], riskAssessmentId: undefined, repeat: repeat.repeat, previousHearingAt: repeat.previousAt?.slice(0, 10), professionalJudgement: true } : undefined,
      mappa: type === 'mappa' ? { category: 1, level: 1, leadResponsibleAuthority: 'police', visorReference: '' } : undefined,
      preBirth: type === 'cp' && person.lifeStage === 'unborn' && person.expectedDeliveryDate ? { expectedDeliveryDate: person.expectedDeliveryDate, motherPersonId: person.id } : undefined,
    });

    if (!result.ok || !result.process) {
      setErrors(result.errors);
      return;
    }
    const started = result.effects.filter((e) => e.kind === 'clock').length;
    toast({ title: t('processes.open.done.title'), text: t('processes.open.done.text', { reference: result.process.reference, clocks: t('processes.open.started', { count: started }) }), tone: 'success' });
    navigate(processPath(result.process.id));
    close();
  }

  const chosen = type ? answers.find((a) => a.type === type) : undefined;
  const permission = type ? permissions.get(type) : undefined;
  const ruleIds = type ? openingClockRuleIds({ type, preBirth: type === 'cp' && person.lifeStage === 'unborn' ? { expectedDeliveryDate: '', motherPersonId: '' } : undefined }) : [];
  const waits = type ? clocksThatWaitFor(type) : null;
  /** How many people the matrix entitles at the opening stage, so the count is the rules speaking. */
  const notified = useMemo(() => {
    if (!type) return 0;
    return resolveNeedToKnow({ process: type, stage: OPENING_STAGE[type], flags: {} }, config.needToKnow, config.exclusions).recipients.length;
  }, [type, config]);

  const ready = Boolean(type && chosen?.eligibility.eligible && permission?.allowed && source.trim() !== '' && summary.trim().length > 10 && (existing.length === 0 || secondCaseReason.trim().length >= 10));

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t('processes.open.title', { name: fullName(person) })}
      size="lg"
      errors={readErrors(errors)}
      actions={
        <>
          <Button variant="quiet" onClick={close}>
            {t('common.actions.cancel')}
          </Button>
          <Button variant="primary" icon={<FolderPlus size={16} aria-hidden="true" />} disabled={!ready} onClick={submit} data-testid="start-process-submit">
            {existing.length > 0 ? t('processes.open.createAnyway') : t('processes.open.submit')}
          </Button>
        </>
      }
    >
      <div className="stack">
        {isYoungAdult(person, now) ? (
          <p className={styles.youngAdult} data-testid="young-adult">
            <TriangleAlert size={16} aria-hidden="true" />
            {answers.find((a) => a.type === 'asp')?.eligibility.warning}
          </p>
        ) : null}

        <fieldset className={styles.choices}>
          <legend className={styles.legend}>{t('processes.open.chooseType')}</legend>
          {answers.map(({ type: candidate, eligibility }) => {
            const perm = permissions.get(candidate);
            const blocked = !eligibility.eligible || !perm?.allowed;
            return (
              <label key={candidate} className={styles.choice} data-blocked={blocked ? 'true' : undefined} data-testid={`process-choice-${candidate}`}>
                <input type="radio" name="process-type" value={candidate} checked={type === candidate} disabled={blocked} onChange={() => setType(candidate)} />
                <span className={styles.choiceBody}>
                  <span className={styles.choiceHead}>
                    <strong>{processLabel(candidate)}</strong>
                    {eligibility.eligible ? (
                      perm?.allowed ? (
                        <Pill size="sm" tone="low" icon={<Check size={12} aria-hidden="true" />}>
                          {t('processes.open.eligible')}
                        </Pill>
                      ) : (
                        <Pill size="sm" tone="medium" icon={<Ban size={12} aria-hidden="true" />}>
                          {t('processes.open.needsPermission')}
                        </Pill>
                      )
                    ) : (
                      <Pill size="sm" tone="outline" icon={<Ban size={12} aria-hidden="true" />}>
                        {t('processes.open.notEligible')}
                      </Pill>
                    )}
                  </span>
                  <span className={styles.choiceReason}>{eligibility.reason}</span>
                  {eligibility.eligible && eligibility.warning ? <span className={styles.choiceWarning}>{eligibility.warning}</span> : null}
                  {!eligibility.eligible && eligibility.route ? <span className={styles.choiceRoute}>{eligibility.route}</span> : null}
                  {eligibility.eligible && perm && !perm.allowed ? (
                    <>
                      <span className={styles.choiceReason}>{perm.reason}</span>
                      <span className={styles.choiceRoute}>{perm.route}</span>
                    </>
                  ) : null}
                </span>
              </label>
            );
          })}
        </fieldset>

        {existing.length > 0 ? (
          <div className={styles.existing} data-testid="process-existing">
            <h4 className={styles.existingTitle}>{t('processes.open.existingTitle', { name: person.givenName, process: processLabel(existing[0]!.type) })}</h4>
            <p className={styles.hint}>{t('processes.open.existingLede')}</p>
            <ul>
              {existing.map((p) => (
                <li key={p.id}>
                  <AppLink href={processPath(p.id)}>{t('processes.open.openExisting', { reference: p.reference })}</AppLink> {stageLabel(p.type, p.stage)}
                </li>
              ))}
            </ul>
            <TextareaField label={t('processes.open.createAnywayReason')} hint={t('processes.open.createAnywayReasonHint')} value={secondCaseReason} onChange={(e) => setSecondCaseReason(e.target.value)} rows={2} data-testid="process-second-reason" />
          </div>
        ) : null}

        {repeat.repeat ? (
          <div className={styles.repeat} data-testid="marac-repeat">
            <h4 className={styles.existingTitle}>{t('processes.open.repeatTitle')}</h4>
            <p>{t('processes.open.repeatLede', { date: formatDate((repeat.previousAt ?? '').slice(0, 10)) })}</p>
          </div>
        ) : null}

        {type && chosen?.eligibility.eligible && permission?.allowed ? (
          <>
            <div className={styles.grid}>
              <TextField label={t('processes.open.source')} hint={t('processes.open.sourceHint')} value={source} onChange={(e) => setSource(e.target.value)} required data-testid="process-source" />
              <SelectField label={t('processes.open.sourceAgency')} value={sourceAgency} onChange={(e) => setSourceAgency(e.target.value as Agency)} options={AGENCIES.map((a) => ({ value: a, label: agencyShort(a) }))} />
              <TextField label={t('processes.open.sourceReference')} value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} />
            </div>
            <TextareaField label={t('processes.open.summary')} hint={t('processes.open.summaryHint')} value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} required data-testid="process-summary" />

            <div className={styles.consequences} data-testid="process-consequences">
              <h4 className={styles.consequencesTitle}>
                <Clock size={16} aria-hidden="true" /> {t('processes.open.consequences.title')}
              </h4>
              <ul>
                <li>{t('processes.open.consequences.reference', { reference: nextReference(data.processes, type, now), stage: stageLabel(type, OPENING_STAGE[type]), agency: agencyShort(user?.agency ?? 'social-work') })}</li>
                <li>
                  {t('processes.open.consequences.clocks', { count: ruleIds.length })}
                  {ruleIds.length > 0 ? <span className={styles.clockList}>{ruleIds.map((id) => clockRuleLabel(id)).join('; ')}</span> : null}
                  {ruleIds.length === 0 && waits ? <span className={styles.clockList}>{waits}</span> : null}
                </li>
                <li>{t('processes.open.consequences.classification', { classification: classificationLabel(openingClassification(type).classification) })}</li>
                <li>{t('processes.open.consequences.sharing', { count: notified })}</li>
                <li>{t('processes.open.consequences.chronology')}</li>
                <li>{t('processes.open.consequences.audit')}</li>
              </ul>
            </div>
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
