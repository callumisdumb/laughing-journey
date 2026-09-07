'use client';

import { AGENCIES, LSI_SERVICE_TYPES, agencyShort, lsiServiceTypeLabel, roleLabel, type Agency, type AspProcess, type LsiStrandInput, type LsiServiceType, type OpenLsiInput } from '@mas/domain';
import { useT } from '@mas/messages';
import { CheckboxField, SelectField, TextField, TextareaField } from '@mas/ui';
import { useData } from '@/lib/store';
import { userName } from '@/lib/selectors';
import { transitionForm, type TransitionFormProps } from './registry';
import styles from './transitions.module.css';

/**
 * Opening a Large Scale Investigation, and adding an adult to it (D-253). The seniority question is
 * a checkbox rather than an assumption: the national minimum dataset expects the decision to be
 * taken in a meeting chaired by a senior officer of the council, and the record refuses one that
 * was not, so the form asks rather than letting a later return carry a claim nobody made.
 */
function OpenLsiForm({ value, onChange }: TransitionFormProps<OpenLsiInput>) {
  const t = useT();
  const data = useData();
  const chairs = data.users.filter((u) => u.agency === 'social-work' && ['cswo', 'team-leader', 'chair'].includes(u.roleId));
  const toggle = (agency: Agency) => onChange({ ...value, agenciesInvolved: value.agenciesInvolved.includes(agency) ? value.agenciesInvolved.filter((a) => a !== agency) : [...value.agenciesInvolved, agency] });
  return (
    <div className="stack">
      <p className={styles.hint}>{t('processes.forms.lsiOpen.hint')}</p>
      <div className={styles.grid}>
        <TextField label={t('processes.forms.lsiOpen.setting')} required value={value.setting} onChange={(e) => onChange({ ...value, setting: e.target.value })} data-testid="transition-setting" />
        <TextField label={t('processes.forms.lsiOpen.provider')} required value={value.provider} onChange={(e) => onChange({ ...value, provider: e.target.value })} data-testid="transition-provider" />
      </div>
      <SelectField label={t('processes.forms.lsiOpen.serviceType')} value={value.serviceType} onChange={(e) => onChange({ ...value, serviceType: e.target.value as LsiServiceType })} options={LSI_SERVICE_TYPES.map((s) => ({ value: s, label: lsiServiceTypeLabel(s) }))} data-testid="transition-service-type" />
      <div className={styles.grid}>
        <TextField label={t('processes.forms.lsiOpen.csNumber')} hint={t('processes.forms.lsiOpen.csNumberHint')} value={value.careInspectorateCsNumber ?? ''} onChange={(e) => onChange({ ...value, careInspectorateCsNumber: e.target.value })} data-testid="transition-cs-number" />
        <TextField label={t('processes.forms.lsiOpen.hospitalCode')} hint={t('processes.forms.lsiOpen.hospitalCodeHint')} value={value.nhsHospitalLocationCode ?? ''} onChange={(e) => onChange({ ...value, nhsHospitalLocationCode: e.target.value })} data-testid="transition-hospital-code" />
      </div>
      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('processes.forms.lsiOpen.agencies')}</legend>
        <div className={styles.checks}>
          {AGENCIES.map((a) => (
            <CheckboxField key={a} label={agencyShort(a)} checked={value.agenciesInvolved.includes(a)} onChange={() => toggle(a)} data-testid={`transition-agency-${a}`} />
          ))}
        </div>
      </fieldset>
      <CheckboxField label={t('processes.forms.lsiOpen.careInspectorateNotified')} checked={value.careInspectorateNotified} onChange={(e) => onChange({ ...value, careInspectorateNotified: e.target.checked })} data-testid="transition-ci-notified" />
      <CheckboxField label={t('processes.forms.lsiOpen.commissioning')} checked={value.commissioningInvolved} onChange={(e) => onChange({ ...value, commissioningInvolved: e.target.checked })} data-testid="transition-commissioning" />
      <SelectField label={t('processes.forms.lsiOpen.chair')} required value={value.chairUserId} onChange={(e) => onChange({ ...value, chairUserId: e.target.value })} options={chairs.map((u) => ({ value: u.id, label: `${userName(u)}, ${roleLabel(u.roleId)}` }))} data-testid="transition-chair" />
      <CheckboxField label={t('processes.forms.lsiOpen.chairSeniority')} hint={t('processes.forms.lsiOpen.chairSeniorityHint')} checked={value.chairIsSeniorCouncilOfficer} onChange={(e) => onChange({ ...value, chairIsSeniorCouncilOfficer: e.target.checked })} data-testid="transition-chair-senior" />
      <TextareaField label={t('processes.forms.lsiOpen.decision')} hint={t('processes.forms.lsiOpen.decisionHint')} value={value.decision} onChange={(e) => onChange({ ...value, decision: e.target.value })} rows={3} required data-testid="transition-decision" />
    </div>
  );
}

function LsiStrandForm({ process, value, onChange }: TransitionFormProps<LsiStrandInput>) {
  const t = useT();
  const data = useData();
  const asp = process as AspProcess;
  const taken = new Set((asp.detail.lsi?.strands ?? []).map((s) => s.subjectId));
  // Anybody with a record may be a strand: an LSI finds adults the case did not start with.
  const people = data.people.filter((p) => !taken.has(p.id) && !p.death).slice(0, 60);
  const leads = data.users.filter((u) => u.agency === 'social-work' && ['council-officer-asp', 'social-worker-adults', 'team-leader'].includes(u.roleId));
  return (
    <div className="stack">
      <p className={styles.hint}>{t('processes.forms.lsiStrand.hint')}</p>
      <SelectField label={t('processes.forms.lsiStrand.subject')} required value={value.subjectId} onChange={(e) => onChange({ ...value, subjectId: e.target.value })} options={people.map((p) => ({ value: p.id, label: `${p.givenName} ${p.familyName}` }))} data-testid="transition-subject" />
      <TextareaField label={t('processes.forms.lsiStrand.concern')} value={value.concern} onChange={(e) => onChange({ ...value, concern: e.target.value })} rows={3} required data-testid="transition-concern" />
      <SelectField label={t('processes.forms.lsiStrand.lead')} value={value.leadUserId ?? ''} onChange={(e) => onChange({ ...value, leadUserId: e.target.value || undefined })} options={leads.map((u) => ({ value: u.id, label: userName(u) }))} data-testid="transition-strand-lead" />
    </div>
  );
}

export const ASP_OPEN_LSI = transitionForm<OpenLsiInput>((_, { user }) => ({ setting: '', provider: '', serviceType: 'care-home', agenciesInvolved: ['social-work'], careInspectorateNotified: false, commissioningInvolved: false, chairUserId: user?.roleId === 'cswo' ? user.id : '', chairIsSeniorCouncilOfficer: false, decision: '' }), OpenLsiForm);
export const ASP_ADD_LSI_STRAND = transitionForm<LsiStrandInput>(() => ({ subjectId: '', concern: '' }), LsiStrandForm);
