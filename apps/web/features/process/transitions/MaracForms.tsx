'use client';

import { AGENCIES, agencyShort, formatDate, researchStatusLabel, type Agency, type IdaaFeedbackInput, type LinkCpConcernInput, type MaracActionPlanInput, type MaracProcess, type Person, type ResearchRequestsInput, type ResearchReturnInput, type TransferInput } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, CheckboxField, DateField, SelectField, TextField, TextareaField } from '@mas/ui';
import { addMonths, format } from 'date-fns';
import { Plus, X } from 'lucide-react';
import { PersonPicker } from '@/components/PersonPicker';
import { fullName, personById, userName } from '@/lib/selectors';
import { useData } from '@/lib/store';
import { PlanFields, emptyPlan } from './PlanFields';
import { transitionForm, type TransitionFormProps } from './registry';
import styles from './transitions.module.css';

/**
 * The MARAC decisions recorded from the case (task section 1.4): the research requests the
 * coordinator sends once the meeting is in the diary, an agency's return, the action plan with its
 * flags and the MATAC and DSDAS questions, the child concern that opens a child protection case,
 * the IDAA's feedback and a transfer. What the meeting itself decides lives with the meeting.
 */
const marac = (process: TransitionFormProps<unknown>['process']): MaracProcess => process as MaracProcess;

function ResearchRequestsForm({ value, onChange }: TransitionFormProps<ResearchRequestsInput>) {
  const t = useT();
  const toggle = (agency: Agency, on: boolean) => onChange({ ...value, agencies: on ? [...value.agencies, agency] : value.agencies.filter((a) => a !== agency) });
  return (
    <div className="stack">
      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('processes.forms.maracResearch.agencies')}</legend>
        <p className={styles.hint}>{t('processes.forms.maracResearch.agenciesHint')}</p>
        <div className={styles.checks}>
          {AGENCIES.map((agency) => (
            <CheckboxField key={agency} label={agencyShort(agency)} checked={value.agencies.includes(agency)} onChange={(e) => toggle(agency, e.target.checked)} data-testid={`transition-agency-${agency}`} />
          ))}
        </div>
      </fieldset>
      <TextareaField label={t('processes.forms.maracResearch.wording')} hint={t('processes.forms.maracResearch.wordingHint')} value={value.wording} onChange={(e) => onChange({ ...value, wording: e.target.value })} rows={3} required data-testid="transition-wording" />
      <DateField label={t('processes.forms.maracResearch.due')} hint={t('processes.forms.maracResearch.dueHint')} value={value.dueAt} onChange={(d) => onChange({ ...value, dueAt: d })} required data-testid="transition-due" />
    </div>
  );
}

function ResearchReturnForm({ process, value, onChange }: TransitionFormProps<ResearchReturnInput>) {
  const t = useT();
  const outstanding = marac(process).detail.researchRequests.filter((r) => r.status === 'sent' || r.status === 'overdue');
  return (
    <div className="stack">
      <SelectField
        label={t('processes.forms.maracReturn.request')}
        hint={t('processes.forms.maracReturn.requestHint')}
        value={value.requestId}
        onChange={(e) => onChange({ ...value, requestId: e.target.value })}
        placeholder={outstanding.length === 0 ? t('processes.forms.maracReturn.none') : undefined}
        options={outstanding.map((r) => ({ value: r.id, label: t('processes.forms.maracReturn.requestOption', { agency: agencyShort(r.agency), due: formatDate(r.dueAt), status: researchStatusLabel(r.status) }) }))}
        required
        data-testid="transition-request"
      />
      <CheckboxField label={t('processes.forms.maracReturn.nothingKnown')} hint={t('processes.forms.maracReturn.nothingKnownHint')} checked={value.nothingKnown} onChange={(e) => onChange({ ...value, nothingKnown: e.target.checked })} data-testid="transition-nothing-known" />
      {value.nothingKnown ? null : <TextareaField label={t('processes.forms.maracReturn.summary')} hint={t('processes.forms.maracReturn.summaryHint')} value={value.summary} onChange={(e) => onChange({ ...value, summary: e.target.value })} rows={4} required data-testid="transition-summary" />}
      <CheckboxField label={t('processes.forms.maracReturn.proportionate')} hint={t('processes.forms.maracReturn.proportionateHint')} checked={value.relevantNecessaryProportionate} onChange={(e) => onChange({ ...value, relevantNecessaryProportionate: e.target.checked })} data-testid="transition-proportionate" />
    </div>
  );
}

function ActionPlanForm({ process, value, onChange }: TransitionFormProps<MaracActionPlanInput>) {
  const t = useT();
  const flags = value.flags;
  const setFlag = (i: number, patch: Partial<MaracActionPlanInput['flags'][number]>) => onChange({ ...value, flags: flags.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  return (
    <div className="stack">
      <PlanFields process={process} value={value.plan} onChange={(plan) => onChange({ ...value, plan })} />
      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('processes.forms.maracPlan.flags')}</legend>
        <p className={styles.hint}>{t('processes.forms.maracPlan.flagsHint')}</p>
        {flags.map((flag, i) => (
          <div key={i} className={styles.actionRow}>
            <SelectField label={t('processes.forms.maracPlan.flagAgency')} value={flag.agency} onChange={(e) => setFlag(i, { agency: e.target.value as Agency })} options={AGENCIES.map((a) => ({ value: a, label: agencyShort(a) }))} data-testid={`flag-agency-${i}`} />
            <TextField label={t('processes.forms.maracPlan.flagSystem')} value={flag.system} onChange={(e) => setFlag(i, { system: e.target.value })} required data-testid={`flag-system-${i}`} />
            <TextField label={t('processes.forms.maracPlan.flagReceipt')} value={flag.receiptRef} onChange={(e) => setFlag(i, { receiptRef: e.target.value })} data-testid={`flag-receipt-${i}`} />
            <Button size="sm" variant="quiet" icon={<X size={14} aria-hidden="true" />} onClick={() => onChange({ ...value, flags: flags.filter((_, j) => j !== i) })} aria-label={t('processes.forms.maracPlan.removeFlag')}>
              {t('processes.forms.maracPlan.removeFlag')}
            </Button>
          </div>
        ))}
        <div className={styles.grid}>
          <div>
            <Button size="sm" variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => onChange({ ...value, flags: [...flags, { agency: 'health', system: '', receiptRef: '' }] })} data-testid="transition-add-flag">
              {t('processes.forms.maracPlan.addFlag')}
            </Button>
          </div>
          <DateField label={t('processes.forms.maracPlan.flagExpiry')} hint={t('processes.forms.maracPlan.flagExpiryHint')} value={value.flagExpiresAt} onChange={(d) => onChange({ ...value, flagExpiresAt: d })} required data-testid="transition-flag-expiry" />
        </div>
      </fieldset>
      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('processes.forms.maracPlan.perpetrator')}</legend>
        <div className={styles.grid}>
          <CheckboxField label={t('processes.forms.maracPlan.matac')} hint={t('processes.forms.maracPlan.matacHint')} checked={value.matac.considered} onChange={(e) => onChange({ ...value, matac: { ...value.matac, considered: e.target.checked } })} data-testid="transition-matac" />
          <CheckboxField label={t('processes.forms.maracPlan.matacReferred')} checked={Boolean(value.matac.referred)} onChange={(e) => onChange({ ...value, matac: { ...value.matac, referred: e.target.checked } })} data-testid="transition-matac-referred" />
        </div>
        <TextField label={t('processes.forms.maracPlan.matacNote')} value={value.matac.note ?? ''} onChange={(e) => onChange({ ...value, matac: { ...value.matac, note: e.target.value } })} />
        <CheckboxField label={t('processes.forms.maracPlan.dsdas')} hint={t('processes.forms.maracPlan.dsdasHint')} checked={value.dsdas.considered} onChange={(e) => onChange({ ...value, dsdas: { ...value.dsdas, considered: e.target.checked } })} data-testid="transition-dsdas" />
        <TextField label={t('processes.forms.maracPlan.dsdasNote')} value={value.dsdas.note ?? ''} onChange={(e) => onChange({ ...value, dsdas: { ...value.dsdas, note: e.target.value } })} data-testid="transition-dsdas-note" />
      </fieldset>
    </div>
  );
}

/** The children the case already knows of: named on the referral, or related to the victim. */
function knownChildren(data: ReturnType<typeof useData>, process: MaracProcess): Array<{ person: Person; onReferral: boolean }> {
  const victim = process.detail.referral.victimPersonId;
  const related = data.relationships.filter((r) => r.fromPersonId === victim || r.toPersonId === victim).map((r) => (r.fromPersonId === victim ? r.toPersonId : r.fromPersonId));
  const ids = [...new Set([...process.detail.referral.childPersonIds, ...related])];
  return ids
    .map((id) => personById(data, id))
    .filter((p): p is Person => Boolean(p) && (process.detail.referral.childPersonIds.includes(p!.id) || p!.lifeStage === 'child' || p!.lifeStage === 'unborn'))
    .map((person) => ({ person, onReferral: process.detail.referral.childPersonIds.includes(person.id) }));
}

function LinkCpConcernForm({ process, value, onChange }: TransitionFormProps<LinkCpConcernInput & { added?: Person[] }>) {
  const t = useT();
  const data = useData();
  const known = knownChildren(data, marac(process));
  const added = (value.added ?? []).filter((p) => !known.some((k) => k.person.id === p.id));
  const rows = [...known, ...added.map((person) => ({ person, onReferral: false }))];
  const toggle = (id: string, on: boolean) => onChange({ ...value, childPersonIds: on ? [...value.childPersonIds, id] : value.childPersonIds.filter((x) => x !== id) });
  return (
    <div className="stack">
      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('processes.forms.maracCp.children')}</legend>
        <p className={styles.hint}>{t('processes.forms.maracCp.childrenHint')}</p>
        {rows.length === 0 ? <p className={styles.hint}>{t('processes.forms.maracCp.none')}</p> : null}
        <div className={styles.checks}>
          {rows.map(({ person, onReferral }) => (
            <CheckboxField key={person.id} label={fullName(person)} hint={onReferral ? t('processes.forms.maracCp.onReferral') : t('processes.forms.maracCp.known', { born: person.dateOfBirth ? formatDate(person.dateOfBirth) : '' })} checked={value.childPersonIds.includes(person.id)} onChange={(e) => toggle(person.id, e.target.checked)} data-testid={`transition-child-${person.id}`} />
          ))}
        </div>
        <PersonPicker
          label={t('processes.forms.maracCp.another')}
          hint={t('processes.forms.maracCp.anotherHint')}
          value={null}
          onChange={(person) => {
            if (!person || rows.some((r) => r.person.id === person.id)) return;
            onChange({ ...value, added: [...(value.added ?? []), person], childPersonIds: [...value.childPersonIds, person.id] });
          }}
          exclude={[marac(process).detail.referral.victimPersonId, marac(process).detail.referral.perpetratorPersonId, ...rows.map((r) => r.person.id)]}
          idPrefix="transition-child"
        />
      </fieldset>
      <TextareaField label={t('processes.forms.maracCp.summary')} hint={t('processes.forms.maracCp.summaryHint')} value={value.summary} onChange={(e) => onChange({ ...value, summary: e.target.value })} rows={4} required data-testid="transition-summary" />
    </div>
  );
}

function IdaaFeedbackForm({ value, onChange }: TransitionFormProps<IdaaFeedbackInput>) {
  const t = useT();
  return (
    <div className="stack">
      <TextareaField label={t('processes.forms.maracFeedback.summary')} hint={t('processes.forms.maracFeedback.summaryHint')} value={value.summary} onChange={(e) => onChange({ ...value, summary: e.target.value })} rows={4} required data-testid="transition-summary" />
      <TextareaField label={t('processes.forms.maracFeedback.victimResponse')} hint={t('processes.forms.maracFeedback.victimResponseHint')} value={value.victimResponse ?? ''} onChange={(e) => onChange({ ...value, victimResponse: e.target.value || undefined })} rows={2} data-testid="transition-victim-response" />
    </div>
  );
}

function TransferForm({ value, onChange }: TransitionFormProps<TransferInput>) {
  const t = useT();
  return (
    <div className="stack">
      <p className={styles.hint}>{t('processes.forms.maracTransfer.hint')}</p>
      <div className={styles.grid}>
        <TextField label={t('processes.forms.maracTransfer.area')} value={value.toArea} onChange={(e) => onChange({ ...value, toArea: e.target.value })} required data-testid="transition-area" />
        <TextField label={t('processes.forms.maracTransfer.coordinator')} hint={t('processes.forms.maracTransfer.coordinatorHint')} value={value.receivingCoordinator} onChange={(e) => onChange({ ...value, receivingCoordinator: e.target.value })} required data-testid="transition-coordinator" />
      </div>
    </div>
  );
}

/** The first outstanding request for the recorder's own agency, else the first outstanding at all. */
function firstRequestFor(process: MaracProcess, agency: Agency | undefined): string {
  const outstanding = process.detail.researchRequests.filter((r) => r.status === 'sent' || r.status === 'overdue');
  return (outstanding.find((r) => r.agency === agency) ?? outstanding[0])?.id ?? '';
}

export const MARAC_RESEARCH_REQUESTS = transitionForm<ResearchRequestsInput>(() => ({ agencies: [], wording: '', dueAt: '' }), ResearchRequestsForm);
export const MARAC_RESEARCH_RETURN = transitionForm<ResearchReturnInput>((process, { user }) => ({ requestId: firstRequestFor(process as MaracProcess, user?.agency), summary: '', nothingKnown: false, relevantNecessaryProportionate: false }), ResearchReturnForm);
export const MARAC_ACTION_PLAN = transitionForm<MaracActionPlanInput>((_, { user, now }) => ({ plan: emptyPlan(user ? { id: user.id, name: userName(user) } : null), flags: [], matac: { considered: false }, dsdas: { considered: false }, flagExpiresAt: format(addMonths(now, 12), 'yyyy-MM-dd') }), ActionPlanForm);
export const MARAC_LINK_CP_CONCERN = transitionForm<LinkCpConcernInput & { added?: Person[] }>(() => ({ childPersonIds: [], summary: '' }), LinkCpConcernForm);
export const MARAC_IDAA_FEEDBACK = transitionForm<IdaaFeedbackInput>(() => ({ summary: '' }), IdaaFeedbackForm);
export const MARAC_TRANSFER = transitionForm<TransferInput>(() => ({ toArea: '', receivingCoordinator: '' }), TransferForm);
