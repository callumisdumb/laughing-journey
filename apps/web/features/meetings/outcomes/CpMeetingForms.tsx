'use client';

import { AGENCIES, CP_CONCERNS, agencyShort, cpConcernLabel, irdMedicalKindLabel, roleLabel, type Agency, type CpConcern, type CppmHeldInput, type IrdDecision, type IrdDecisionsInput, type PlanInput } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, CheckboxField, DateField, RadioGroup, SelectField, TextField, TextareaField } from '@mas/ui';
import { Plus, X } from 'lucide-react';
import { PlanFields, emptyPlan } from '@/features/process/transitions/PlanFields';
import { fullName, userName } from '@/lib/selectors';
import { useCurrentUser, useData } from '@/lib/store';
import { heldForm, type OutcomeFormProps } from './registry';
import styles from './outcomes.module.css';

/**
 * The inter-agency referral discussion's seven decisions, each with its rationale, and the child
 * protection planning meeting's decision to register with the concerns, the core group and the
 * child's plan. Both are recorded from the meeting they were made in (D-213).
 */
type DecisionKey = 'significantHarm' | 'investigationNeeded' | 'jii' | 'medical' | 'emergencyMeasures' | 'reporterReferral' | 'parentsInformed';
const DECISIONS: readonly DecisionKey[] = ['significantHarm', 'investigationNeeded', 'jii', 'medical', 'emergencyMeasures', 'reporterReferral', 'parentsInformed'];
const MEASURES = ['none', 'cpo', 'exclusion-order', 'police-emergency-powers'] as const;

function DecisionFields({ id, legend, value, onChange, children }: { id: string; legend: string; value: IrdDecision; onChange: (d: IrdDecision) => void; children?: React.ReactNode }) {
  const t = useT();
  return (
    <fieldset className={styles.section} data-testid={`ird-${id}`}>
      <legend className={styles.legend}>{legend}</legend>
      <RadioGroup legend={t('meetings.outcome.ird.decided')} name={`ird-${id}`} value={value.decided ? 'yes' : 'no'} onChange={(v) => onChange({ ...value, decided: v === 'yes' })} orientation="horizontal" options={[{ value: 'yes', label: t('meetings.outcome.yes') }, { value: 'no', label: t('meetings.outcome.no') }]} />
      <div className={styles.grid}>
        <TextField label={t('meetings.outcome.ird.decision')} value={value.decision} onChange={(e) => onChange({ ...value, decision: e.target.value })} data-testid={`ird-${id}-decision`} />
        <TextField label={t('meetings.outcome.rationale')} value={value.rationale} onChange={(e) => onChange({ ...value, rationale: e.target.value })} required data-testid={`ird-${id}-rationale`} />
      </div>
      {children}
    </fieldset>
  );
}

function IrdDecisionsForm({ meeting, process, value, onChange }: OutcomeFormProps<IrdDecisionsInput & { withPlan: boolean }>) {
  const t = useT();
  const data = useData();
  const user = useCurrentUser();
  const set = <K extends DecisionKey>(key: K, d: IrdDecisionsInput[K]) => onChange({ ...value, [key]: d });
  const siblings = data.relationships.filter((r) => (r.fromPersonId === process.subjectIds[0] || r.toPersonId === process.subjectIds[0]) && /sibling/i.test(r.type)).map((r) => (r.fromPersonId === process.subjectIds[0] ? r.toPersonId : r.fromPersonId));
  const setRow = (i: number, patch: Partial<IrdDecisionsInput['contributions'][number]>) => onChange({ ...value, contributions: value.contributions.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const jii = value.jii;
  const medical = value.medical;
  const emergency = value.emergencyMeasures;
  const parents = value.parentsInformed;
  return (
    <div className="stack">
      {DECISIONS.map((key) => (
        <DecisionFields key={key} id={key} legend={t(`cp.ird.decisions.${key}`)} value={value[key]} onChange={(d) => set(key, { ...value[key], ...d })}>
          {key === 'jii' ? (
            <div className={styles.grid}>
              <TextField label={t('meetings.outcome.ird.planner')} value={jii.plannerName ?? ''} onChange={(e) => set('jii', { ...jii, plannerName: e.target.value })} />
              <TextField label={t('meetings.outcome.ird.informedBy')} value={jii.informedBy ?? ''} onChange={(e) => set('jii', { ...jii, informedBy: e.target.value })} />
            </div>
          ) : null}
          {key === 'medical' ? (
            <div className={styles.grid}>
              <SelectField label={t('meetings.outcome.ird.medicalKind')} value={medical.kind ?? 'none'} onChange={(e) => set('medical', { ...medical, kind: e.target.value as NonNullable<typeof medical.kind> })} options={(['jpfe', 'comprehensive', 'none'] as const).map((k) => ({ value: k, label: irdMedicalKindLabel(k) }))} data-testid="ird-medical-kind" />
              <TextField label={t('meetings.outcome.ird.consentBy')} value={medical.consentBy ?? ''} onChange={(e) => set('medical', { ...medical, consentBy: e.target.value })} />
              <DateField label={t('meetings.outcome.ird.medicalWhen')} value={medical.when?.slice(0, 10) ?? ''} onChange={(d) => set('medical', { ...medical, when: d ? `${d}T09:00:00.000Z` : undefined })} />
            </div>
          ) : null}
          {key === 'emergencyMeasures' ? <SelectField label={t('meetings.outcome.ird.measure')} value={emergency.measure ?? 'none'} onChange={(e) => set('emergencyMeasures', { ...emergency, measure: e.target.value as (typeof MEASURES)[number] })} options={MEASURES.map((m) => ({ value: m, label: t(`meetings.outcome.irdMeasures.${m === 'exclusion-order' ? 'exclusionOrder' : m === 'police-emergency-powers' ? 'policeEmergencyPowers' : m}`) }))} data-testid="ird-measure" /> : null}
          {key === 'parentsInformed' && !parents.decided ? <TextField label={t('meetings.outcome.ird.withheld')} value={parents.withheld ?? ''} onChange={(e) => set('parentsInformed', { ...parents, withheld: e.target.value })} required data-testid="ird-withheld" /> : null}
        </DecisionFields>
      ))}
      {!value.investigationNeeded.decided ? (
        <fieldset className={styles.section} data-testid="ird-no-investigation">
          <legend className={styles.legend}>{t('meetings.outcome.ird.noInvestigation')}</legend>
          <RadioGroup legend={t('meetings.outcome.ird.noInvestigationRoute')} name="ird-route" value={value.noInvestigation?.route ?? 'single-agency'} onChange={(v) => onChange({ ...value, noInvestigation: { route: v as 'close' | 'single-agency', reason: value.noInvestigation?.reason ?? '' } })} orientation="horizontal" options={[{ value: 'single-agency', label: t('meetings.outcome.ird.singleAgency') }, { value: 'close', label: t('meetings.outcome.ird.close') }]} />
          <TextField label={t('meetings.outcome.ird.noInvestigationReason')} value={value.noInvestigation?.reason ?? ''} onChange={(e) => onChange({ ...value, noInvestigation: { route: value.noInvestigation?.route ?? 'single-agency', reason: e.target.value } })} required data-testid="ird-no-investigation-reason" />
        </fieldset>
      ) : null}
      <TextareaField label={t('meetings.outcome.ird.childViews')} hint={t('meetings.outcome.ird.childViewsHint')} value={value.childViewsSought} onChange={(e) => onChange({ ...value, childViewsSought: e.target.value })} rows={2} required data-testid="ird-child-views" />
      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('meetings.outcome.ird.siblings')}</legend>
        {siblings.length === 0 ? <p className={styles.hint}>{t('meetings.outcome.ird.noSiblings')}</p> : null}
        {siblings.map((id) => {
          const person = data.people.find((p) => p.id === id);
          return <CheckboxField key={id} label={person ? fullName(person) : id} checked={value.siblingsConsidered.includes(id)} onChange={(e) => onChange({ ...value, siblingsConsidered: e.target.checked ? [...value.siblingsConsidered, id] : value.siblingsConsidered.filter((x) => x !== id) })} />;
        })}
      </fieldset>
      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('meetings.outcome.ird.contributions')}</legend>
        <p className={styles.hint}>{t('meetings.outcome.ird.contributionsHint')}</p>
        {value.contributions.map((row, i) => (
          <div key={i} className={styles.sharedRow}>
            <SelectField label={t('meetings.outcome.marac.agency')} value={row.agency} onChange={(e) => setRow(i, { agency: e.target.value as Agency })} options={AGENCIES.map((a) => ({ value: a, label: agencyShort(a) }))} />
            <TextField label={t('meetings.outcome.ird.contributor')} value={row.byName} onChange={(e) => setRow(i, { byName: e.target.value })} data-testid={`ird-contribution-name-${i}`} />
            <Button size="sm" variant="quiet" icon={<X size={14} aria-hidden="true" />} onClick={() => onChange({ ...value, contributions: value.contributions.filter((_, j) => j !== i) })} aria-label={t('meetings.outcome.marac.remove')}>
              {t('meetings.outcome.marac.remove')}
            </Button>
            <div className={styles.full}>
              <TextField label={t('meetings.outcome.marac.summary')} value={row.summary} onChange={(e) => setRow(i, { summary: e.target.value })} data-testid={`ird-contribution-summary-${i}`} />
            </div>
          </div>
        ))}
        <div>
          <Button size="sm" variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => onChange({ ...value, contributions: [...value.contributions, { agency: user?.agency ?? 'social-work', byName: user ? userName(user) : '', summary: '' }] })} data-testid="ird-contribution-add">
            {t('meetings.outcome.ird.addContribution')}
          </Button>
        </div>
      </fieldset>
      <TextField label={t('meetings.outcome.ird.dissent')} value={value.dissent ?? ''} onChange={(e) => onChange({ ...value, dissent: e.target.value || undefined })} />
      <CheckboxField label={t('meetings.outcome.ird.interimPlan')} hint={t('meetings.outcome.ird.interimPlanHint')} checked={value.withPlan} onChange={(e) => onChange({ ...value, withPlan: e.target.checked, interimSafetyPlan: e.target.checked ? (value.interimSafetyPlan ?? emptyPlan(user ? { id: user.id, name: userName(user) } : null, { title: t('meetings.outcome.ird.interimPlanTitle') })) : undefined })} data-testid="ird-with-plan" />
      {value.withPlan && value.interimSafetyPlan ? <PlanFields process={process} value={value.interimSafetyPlan} onChange={(plan) => onChange({ ...value, interimSafetyPlan: plan })} /> : null}
      <p className={styles.hint}>{t('meetings.outcome.ird.meetingNote', { title: meeting.title })}</p>
    </div>
  );
}

function CppmHeldForm({ meeting, process, value, onChange }: OutcomeFormProps<CppmHeldInput>) {
  const t = useT();
  const data = useData();
  const user = useCurrentUser();
  const candidates = [...meeting.invitees.filter((i) => i.userId), ...(meeting.chairUserId ? [{ userId: meeting.chairUserId, name: meeting.chairName }] : [])].filter((i, idx, all) => all.findIndex((x) => x.userId === i.userId) === idx);
  const users = candidates.map((c) => data.users.find((u) => u.id === c.userId)).filter((u): u is NonNullable<typeof u> => Boolean(u));
  const toggleMember = (id: string, on: boolean) => onChange({ ...value, coreGroupMemberUserIds: on ? [...value.coreGroupMemberUserIds, id] : value.coreGroupMemberUserIds.filter((x) => x !== id) });
  const toggleConcern = (c: CpConcern, on: boolean) => onChange({ ...value, concerns: on ? [...value.concerns, c] : value.concerns.filter((x) => x !== c) });
  const plan: PlanInput = value.plan ?? emptyPlan(user ? { id: user.id, name: userName(user) } : null);
  return (
    <div className="stack">
      <CheckboxField label={t('meetings.outcome.cpReview.quorate')} hint={t('meetings.outcome.cpReview.quorateHint')} checked={value.quorate} onChange={(e) => onChange({ ...value, quorate: e.target.checked })} data-testid="outcome-quorate" />
      {value.quorate ? (
        <>
          <RadioGroup legend={t('meetings.outcome.cppm.decision')} name="cppm-decision" value={value.decision} onChange={(v) => onChange({ ...value, decision: v as CppmHeldInput['decision'], plan: v === 'register' ? plan : undefined })} orientation="horizontal" options={[{ value: 'register', label: t('meetings.outcome.cppm.register'), hint: t('meetings.outcome.cppm.registerHint') }, { value: 'not-register', label: t('meetings.outcome.cppm.notRegister'), hint: t('meetings.outcome.cppm.notRegisterHint') }]} />
          {value.decision === 'register' ? (
            <>
              <fieldset className={styles.section}>
                <legend className={styles.legend}>{t('meetings.outcome.cppm.concerns')}</legend>
                <p className={styles.hint}>{t('meetings.outcome.cppm.concernsHint')}</p>
                <div className={styles.checks}>
                  {CP_CONCERNS.map((c) => (
                    <CheckboxField key={c} label={cpConcernLabel(c)} checked={value.concerns.includes(c)} onChange={(e) => toggleConcern(c, e.target.checked)} data-testid={`cppm-concern-${c}`} />
                  ))}
                </div>
              </fieldset>
              <TextField label={t('meetings.outcome.cppm.localCategory')} hint={t('meetings.outcome.cppm.localCategoryHint')} value={value.localCategory ?? ''} onChange={(e) => onChange({ ...value, localCategory: e.target.value || undefined })} />
              <fieldset className={styles.section}>
                <legend className={styles.legend}>{t('meetings.outcome.cppm.coreGroup')}</legend>
                <p className={styles.hint}>{t('meetings.outcome.cppm.coreGroupHint')}</p>
                <div className={styles.checks}>
                  {users.map((u) => (
                    <CheckboxField key={u.id} label={`${userName(u)} (${roleLabel(u.roleId)})`} checked={value.coreGroupMemberUserIds.includes(u.id)} onChange={(e) => toggleMember(u.id, e.target.checked)} data-testid={`cppm-member-${u.id}`} />
                  ))}
                </div>
              </fieldset>
              <div className={styles.grid}>
                <SelectField label={t('meetings.outcome.cppm.leadProfessional')} value={value.leadProfessionalUserId ?? ''} onChange={(e) => onChange({ ...value, leadProfessionalUserId: e.target.value || undefined })} placeholder={t('meetings.outcome.cppm.choose')} options={users.map((u) => ({ value: u.id, label: `${userName(u)} (${roleLabel(u.roleId)})` }))} required data-testid="cppm-lead" />
                <SelectField label={t('meetings.outcome.cppm.namedPerson')} value={value.namedPersonUserId ?? ''} onChange={(e) => onChange({ ...value, namedPersonUserId: e.target.value || undefined })} placeholder={t('meetings.outcome.cppm.choose')} options={users.map((u) => ({ value: u.id, label: `${userName(u)} (${roleLabel(u.roleId)})` }))} data-testid="cppm-named-person" />
              </div>
              <fieldset className={styles.section}>
                <legend className={styles.legend}>{t('meetings.outcome.cppm.plan')}</legend>
                <PlanFields process={process} value={plan} onChange={(next) => onChange({ ...value, plan: next })} />
              </fieldset>
            </>
          ) : null}
          <TextareaField label={t('meetings.outcome.rationale')} hint={t('meetings.outcome.rationaleHint')} value={value.rationale} onChange={(e) => onChange({ ...value, rationale: e.target.value })} rows={3} required data-testid="outcome-rationale" />
        </>
      ) : (
        <p className={styles.hint}>{t('meetings.outcome.cpReview.inquorateHint')}</p>
      )}
    </div>
  );
}

const decision = (): IrdDecision => ({ decided: true, decision: '', rationale: '' });

export const CP_IRD_DECISIONS = heldForm<IrdDecisionsInput & { withPlan: boolean }>((meeting) => ({
  meetingId: meeting.id,
  significantHarm: decision(),
  investigationNeeded: decision(),
  jii: decision(),
  medical: { ...decision(), kind: 'jpfe' },
  emergencyMeasures: { ...decision(), decided: false, measure: 'none' },
  reporterReferral: decision(),
  parentsInformed: decision(),
  childViewsSought: '',
  siblingsConsidered: [],
  contributions: meeting.informationShared.map((s) => ({ agency: s.agency, byName: s.byName, byUserId: s.byUserId, summary: s.summary })),
  withPlan: false,
}), IrdDecisionsForm);

export const CP_CPPM_HELD = heldForm<CppmHeldInput>((meeting, _process, { user }) => ({ meetingId: meeting.id, quorate: true, decision: 'register', concerns: [], rationale: '', coreGroupMemberUserIds: [], leadProfessionalUserId: undefined, namedPersonUserId: undefined, plan: emptyPlan(user ? { id: user.id, name: userName(user) } : null) }), CppmHeldForm);
