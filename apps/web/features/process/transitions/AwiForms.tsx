'use client';

import { awiOrderKindLabel, londonToIso, medicalReportKindLabel, poaKindLabel, roleLabel, type AwiDetail, type AwiProcess, type BeginSupervisionInput, type CourtEventInput, type ExistingPowersInput, type OpenApplicationInput, type ReportInput, type RouteDecisionInput } from '@mas/domain';
import { hasMessage, tKey, useT } from '@mas/messages';
import { Button, CheckboxField, DateField, RadioGroup, SelectField, TextField, TextareaField } from '@mas/ui';
import { Plus, X } from 'lucide-react';
import { userName } from '@/lib/selectors';
import { useData } from '@/lib/store';
import { transitionForm, type TransitionFormProps } from './registry';
import styles from './transitions.module.css';

/**
 * The adults with incapacity decisions recorded from the case (task section 1.6): the check of
 * existing powers, the route decision with the adult's will and preferences, the application
 * naming its Mental Health Officer, the reports and the court events as they arrive, and the
 * start of supervision. The capacity assessment, a supervision visit and an investigation open
 * the dialogs the case already had.
 */
type Route = NonNullable<AwiDetail['routeDecision']>['route'];
const ROUTES: Route[] = ['informal-support', 's13za', 'poa-covers', 'part5-certificate', 'intervention-order', 'guardianship-welfare', 'guardianship-financial', 'guardianship-combined'];
const ORDER_KINDS: AwiDetail['orders'][number]['kind'][] = ['welfare-guardianship', 'financial-guardianship', 'combined-guardianship', 'intervention-order'];
const POA_KINDS = ['welfare', 'financial', 'combined'] as const;
const lines = (text: string) => text.split('\n').map((s) => s.trim()).filter(Boolean);

/** Route ids are hyphenated; the catalogue keys under awi.routes are camelCase, as the panel reads them. */
function routeLabel(route: string): string {
  const key = `awi.routes.${route.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase())}`;
  return hasMessage(key) ? tKey(key) : route;
}

function ExistingPowersForm({ value, onChange }: TransitionFormProps<ExistingPowersInput>) {
  const t = useT();
  const poa = value.powerOfAttorney;
  const guardianship = value.guardianship;
  return (
    <div className="stack">
      <TextField label={t('processes.forms.awiPowers.reference')} hint={t('processes.forms.awiPowers.referenceHint')} value={value.reference} onChange={(e) => onChange({ ...value, reference: e.target.value })} required data-testid="transition-reference" />
      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('processes.forms.awiPowers.poa')}</legend>
        <CheckboxField label={t('processes.forms.awiPowers.poaExists')} checked={poa.exists} onChange={(e) => onChange({ ...value, powerOfAttorney: { ...poa, exists: e.target.checked } })} data-testid="transition-poa" />
        {poa.exists ? (
          <div className={styles.grid}>
            <SelectField label={t('processes.forms.awiPowers.poaKind')} value={poa.kind ?? 'welfare'} onChange={(e) => onChange({ ...value, powerOfAttorney: { ...poa, kind: e.target.value as (typeof POA_KINDS)[number] } })} options={POA_KINDS.map((k) => ({ value: k, label: poaKindLabel(k) }))} data-testid="transition-poa-kind" />
            <TextField label={t('processes.forms.awiPowers.attorney')} value={poa.attorneyName ?? ''} onChange={(e) => onChange({ ...value, powerOfAttorney: { ...poa, attorneyName: e.target.value } })} required data-testid="transition-attorney" />
            <DateField label={t('processes.forms.awiPowers.registered')} value={poa.registeredAt ?? ''} onChange={(d) => onChange({ ...value, powerOfAttorney: { ...poa, registeredAt: d || undefined } })} />
          </div>
        ) : null}
      </fieldset>
      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('processes.forms.awiPowers.guardianship')}</legend>
        <CheckboxField label={t('processes.forms.awiPowers.guardianshipExists')} checked={guardianship.exists} onChange={(e) => onChange({ ...value, guardianship: { ...guardianship, exists: e.target.checked } })} data-testid="transition-guardianship" />
        {guardianship.exists ? (
          <>
            <div className={styles.grid}>
              <TextField label={t('processes.forms.awiPowers.guardian')} value={guardianship.guardianName ?? ''} onChange={(e) => onChange({ ...value, guardianship: { ...guardianship, guardianName: e.target.value } })} required data-testid="transition-guardian" />
              <DateField label={t('processes.forms.awiPowers.expires')} value={guardianship.expiresAt ?? ''} onChange={(d) => onChange({ ...value, guardianship: { ...guardianship, expiresAt: d || undefined } })} />
            </div>
            <TextareaField label={t('processes.forms.awiPowers.powers')} hint={t('processes.forms.oneALine')} value={(guardianship.powers ?? []).join('\n')} onChange={(e) => onChange({ ...value, guardianship: { ...guardianship, powers: lines(e.target.value) } })} rows={2} />
          </>
        ) : null}
      </fieldset>
    </div>
  );
}

function RouteDecisionForm({ value, onChange }: TransitionFormProps<RouteDecisionInput>) {
  const t = useT();
  const will = value.willAndPreferences;
  const s13za = value.s13za ?? { considered: false, applied: false, reasoning: '' };
  const consulted = will.consultedOthers ?? [];
  const setWill = (patch: Partial<RouteDecisionInput['willAndPreferences']>) => onChange({ ...value, willAndPreferences: { ...will, ...patch } });
  const setConsulted = (i: number, patch: Partial<(typeof consulted)[number]>) => setWill({ consultedOthers: consulted.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <div className="stack">
      <SelectField label={t('processes.forms.awiRoute.route')} hint={t('processes.forms.awiRoute.routeHint')} value={value.route} onChange={(e) => onChange({ ...value, route: e.target.value as Route, s13za: e.target.value === 's13za' ? { ...s13za, considered: true } : value.s13za })} options={ROUTES.map((r) => ({ value: r, label: routeLabel(r) }))} required data-testid="transition-awi-route" />
      {value.route === 's13za' ? (
        <fieldset className={styles.section}>
          <legend className={styles.legend}>{t('processes.forms.awiRoute.s13za')}</legend>
          <div className={styles.grid}>
            <CheckboxField label={t('processes.forms.awiRoute.s13zaConsidered')} checked={s13za.considered} onChange={(e) => onChange({ ...value, s13za: { ...s13za, considered: e.target.checked } })} data-testid="transition-s13za-considered" />
            <CheckboxField label={t('processes.forms.awiRoute.s13zaApplied')} checked={s13za.applied} onChange={(e) => onChange({ ...value, s13za: { ...s13za, applied: e.target.checked } })} data-testid="transition-s13za-applied" />
          </div>
          <TextareaField label={t('processes.forms.awiRoute.s13zaReasoning')} value={s13za.reasoning} onChange={(e) => onChange({ ...value, s13za: { ...s13za, reasoning: e.target.value } })} rows={2} data-testid="transition-s13za-reasoning" />
          <TextField label={t('processes.forms.awiRoute.s13zaObjection')} hint={t('processes.forms.awiRoute.s13zaObjectionHint')} value={s13za.objectionFrom ?? ''} onChange={(e) => onChange({ ...value, s13za: { ...s13za, objectionFrom: e.target.value || undefined } })} data-testid="transition-s13za-objection" />
        </fieldset>
      ) : null}
      <TextareaField label={t('processes.forms.rationale')} hint={t('processes.forms.rationaleHint')} value={value.rationale} onChange={(e) => onChange({ ...value, rationale: e.target.value })} rows={3} required data-testid="transition-rationale" />
      <fieldset className={styles.section}>
        <legend className={styles.legend}>{t('processes.forms.awiRoute.will')}</legend>
        <p className={styles.hint}>{t('processes.forms.awiRoute.willHint')}</p>
        <TextareaField label={t('processes.forms.awiRoute.pastWishes')} value={will.pastWishes} onChange={(e) => setWill({ pastWishes: e.target.value })} rows={2} data-testid="transition-past-wishes" />
        <TextareaField label={t('processes.forms.awiRoute.presentWishes')} value={will.presentWishes} onChange={(e) => setWill({ presentWishes: e.target.value })} rows={2} required data-testid="transition-present-wishes" />
        <TextField label={t('processes.forms.awiRoute.communication')} hint={t('processes.forms.awiRoute.communicationHint')} value={will.communicationMethod} onChange={(e) => setWill({ communicationMethod: e.target.value })} data-testid="transition-communication" />
        {consulted.map((c, i) => (
          <div key={i} className={styles.actionRow}>
            <TextField label={t('processes.forms.awiRoute.consultedName')} value={c.name} onChange={(e) => setConsulted(i, { name: e.target.value })} data-testid={`consulted-name-${i}`} />
            <TextField label={t('processes.forms.awiRoute.consultedRelationship')} value={c.relationship} onChange={(e) => setConsulted(i, { relationship: e.target.value })} data-testid={`consulted-relationship-${i}`} />
            <TextField label={t('processes.forms.awiRoute.consultedView')} value={c.view} onChange={(e) => setConsulted(i, { view: e.target.value })} data-testid={`consulted-view-${i}`} />
            <Button size="sm" variant="quiet" icon={<X size={14} aria-hidden="true" />} onClick={() => setWill({ consultedOthers: consulted.filter((_, j) => j !== i) })} aria-label={t('processes.forms.awiRoute.removeConsulted')}>
              {t('processes.forms.awiRoute.removeConsulted')}
            </Button>
          </div>
        ))}
        <div>
          <Button size="sm" variant="secondary" icon={<Plus size={14} aria-hidden="true" />} onClick={() => setWill({ consultedOthers: [...consulted, { name: '', relationship: '', view: '' }] })} data-testid="transition-add-consulted">
            {t('processes.forms.awiRoute.addConsulted')}
          </Button>
        </div>
      </fieldset>
    </div>
  );
}

function OpenApplicationForm({ value, onChange }: TransitionFormProps<OpenApplicationInput>) {
  const t = useT();
  const data = useData();
  const mhos = data.users.filter((u) => u.roleId === 'mho');
  return (
    <div className="stack">
      <RadioGroup legend={t('processes.forms.awiApplication.applicant')} name="awi-applicant" value={value.applicant} onChange={(v) => onChange({ ...value, applicant: v as OpenApplicationInput['applicant'] })} orientation="horizontal" options={[{ value: 'council', label: t('processes.forms.awiApplication.council'), hint: t('processes.forms.awiApplication.councilHint') }, { value: 'private', label: t('processes.forms.awiApplication.private'), hint: t('processes.forms.awiApplication.privateHint') }]} />
      <div className={styles.grid}>
        <TextField label={t('processes.forms.awiApplication.applicantName')} value={value.applicantName} onChange={(e) => onChange({ ...value, applicantName: e.target.value })} required data-testid="transition-applicant-name" />
        <TextField label={t('processes.forms.awiApplication.solicitor')} value={value.solicitor ?? ''} onChange={(e) => onChange({ ...value, solicitor: e.target.value || undefined })} data-testid="transition-solicitor" />
      </div>
      <TextareaField label={t('processes.forms.awiApplication.powers')} hint={t('processes.forms.awiApplication.powersHint')} value={value.powersSought.join('\n')} onChange={(e) => onChange({ ...value, powersSought: lines(e.target.value) })} rows={3} required data-testid="transition-powers" />
      <div className={styles.grid}>
        <SelectField label={t('processes.forms.awiApplication.mho')} hint={t('processes.forms.awiApplication.mhoHint')} value={value.mhoUserId} onChange={(e) => onChange({ ...value, mhoUserId: e.target.value })} placeholder={t('processes.forms.awiApplication.mhoPlaceholder')} options={mhos.map((u) => ({ value: u.id, label: `${userName(u)}, ${roleLabel(u.roleId)}` }))} required data-testid="transition-mho" />
        <TextField label={t('processes.forms.awiApplication.court')} value={value.sheriffCourt} onChange={(e) => onChange({ ...value, sheriffCourt: e.target.value })} required data-testid="transition-court" />
      </div>
    </div>
  );
}

type ReportValue = ReportInput & { date: string };

function ReportForm({ value, onChange }: TransitionFormProps<ReportValue>) {
  const t = useT();
  const kinds: Array<{ value: ReportInput['kind']; label: string; hint: string }> = [
    { value: 'medical', label: t('processes.forms.awiReport.medical'), hint: t('processes.forms.awiReport.medicalHint') },
    { value: 'mho', label: t('processes.forms.awiReport.mho'), hint: t('processes.forms.awiReport.mhoHint') },
    { value: 'suitability', label: t('processes.forms.awiReport.suitability'), hint: t('processes.forms.awiReport.suitabilityHint') },
  ];
  function pick(kind: ReportInput['kind'], date: string) {
    if (kind === 'medical') onChange({ kind, practitioner: value.kind === 'medical' ? value.practitioner : '', practitionerKind: value.kind === 'medical' ? value.practitionerKind : 'approved-medical-practitioner', receivedAt: date, date });
    else if (kind === 'mho') onChange({ kind, submittedAt: date ? londonToIso(date, '09:00') : '', date });
    else onChange({ kind, receivedAt: date, date });
  }
  return (
    <div className="stack">
      <RadioGroup legend={t('processes.forms.awiReport.kind')} name="awi-report-kind" value={value.kind} onChange={(v) => pick(v as ReportInput['kind'], value.date)} options={kinds} />
      {value.kind === 'medical' ? (
        <div className={styles.grid}>
          <TextField label={t('processes.forms.awiReport.practitioner')} value={value.practitioner} onChange={(e) => onChange({ ...value, practitioner: e.target.value })} required data-testid="transition-practitioner" />
          <SelectField label={t('processes.forms.awiReport.practitionerKind')} value={value.practitionerKind} onChange={(e) => onChange({ ...value, practitionerKind: e.target.value as Extract<ReportInput, { kind: 'medical' }>['practitionerKind'] })} options={(['approved-medical-practitioner', 'medical-practitioner'] as const).map((k) => ({ value: k, label: medicalReportKindLabel(k) }))} data-testid="transition-practitioner-kind" />
        </div>
      ) : null}
      <DateField label={value.kind === 'mho' ? t('processes.forms.awiReport.submitted') : t('processes.forms.awiReport.received')} value={value.date} onChange={(d) => pick(value.kind, d)} required data-testid="transition-date" />
    </div>
  );
}

type CourtValue = CourtEventInput & { powersText?: string };

function CourtEventForm({ value, onChange }: TransitionFormProps<CourtValue>) {
  const t = useT();
  const events: Array<{ value: CourtEventInput['event']; label: string; hint: string }> = [
    { value: 'lodged', label: t('processes.forms.awiCourt.lodged'), hint: t('processes.forms.awiCourt.lodgedHint') },
    { value: 'interim-granted', label: t('processes.forms.awiCourt.interim'), hint: t('processes.forms.awiCourt.interimHint') },
    { value: 'hearing-set', label: t('processes.forms.awiCourt.hearing'), hint: t('processes.forms.awiCourt.hearingHint') },
    { value: 'order-granted', label: t('processes.forms.awiCourt.granted'), hint: t('processes.forms.awiCourt.grantedHint') },
  ];
  function pick(event: CourtEventInput['event']) {
    const at = value.at;
    if (event === 'lodged' || event === 'hearing-set') onChange({ event, at });
    else if (event === 'interim-granted') onChange({ event, at, expiresAt: '' });
    else onChange({ event, at, order: { kind: 'welfare-guardianship', guardianName: '', powers: [] }, powersText: '' });
  }
  return (
    <div className="stack">
      <RadioGroup legend={t('processes.forms.awiCourt.event')} name="awi-court-event" value={value.event} onChange={(v) => pick(v as CourtEventInput['event'])} options={events} />
      <div className={styles.grid}>
        <DateField label={t('processes.forms.awiCourt.date')} value={value.at} onChange={(d) => onChange({ ...value, at: d })} required data-testid="transition-date" />
        {value.event === 'interim-granted' ? <DateField label={t('processes.forms.awiCourt.expires')} hint={t('processes.forms.awiCourt.expiresHint')} value={value.expiresAt} onChange={(d) => onChange({ ...value, expiresAt: d })} required data-testid="transition-expiry" /> : null}
      </div>
      {value.event === 'order-granted' ? (
        <fieldset className={styles.section}>
          <legend className={styles.legend}>{t('processes.forms.awiCourt.order')}</legend>
          <div className={styles.grid}>
            <SelectField label={t('processes.forms.awiCourt.orderKind')} value={value.order.kind} onChange={(e) => onChange({ ...value, order: { ...value.order, kind: e.target.value as AwiDetail['orders'][number]['kind'] } })} options={ORDER_KINDS.map((k) => ({ value: k, label: awiOrderKindLabel(k) }))} data-testid="transition-order-kind" />
            <DateField label={t('processes.forms.awiCourt.orderExpires')} value={value.order.expiresAt ?? ''} onChange={(d) => onChange({ ...value, order: { ...value.order, expiresAt: d || undefined } })} data-testid="transition-order-expiry" />
          </div>
          <TextField label={t('processes.forms.awiCourt.guardian')} value={value.order.guardianName} onChange={(e) => onChange({ ...value, order: { ...value.order, guardianName: e.target.value } })} required data-testid="transition-guardian" />
          <TextareaField label={t('processes.forms.awiCourt.powers')} hint={t('processes.forms.oneALine')} value={value.powersText ?? ''} onChange={(e) => onChange({ ...value, powersText: e.target.value, order: { ...value.order, powers: lines(e.target.value) } })} rows={3} required data-testid="transition-powers" />
        </fieldset>
      ) : null}
    </div>
  );
}

function BeginSupervisionForm({ value, onChange }: TransitionFormProps<BeginSupervisionInput>) {
  const t = useT();
  const data = useData();
  const officers = data.users.filter((u) => u.agency === 'social-work' && (u.roleId === 'social-worker-adults' || u.roleId === 'mho' || u.roleId === 'team-leader'));
  return (
    <div className="stack">
      <SelectField label={t('processes.forms.awiSupervision.officer')} hint={t('processes.forms.awiSupervision.officerHint')} value={value.supervisingOfficerUserId} onChange={(e) => { const u = officers.find((x) => x.id === e.target.value); onChange({ ...value, supervisingOfficerUserId: e.target.value, supervisingOfficerName: u ? userName(u) : '' }); }} placeholder={t('processes.forms.awiSupervision.officerPlaceholder')} options={officers.map((u) => ({ value: u.id, label: `${userName(u)}, ${roleLabel(u.roleId)}` }))} required data-testid="transition-officer" />
      <DateField label={t('processes.forms.awiSupervision.firstVisit')} hint={t('processes.forms.awiSupervision.firstVisitHint')} value={value.firstVisitAt} onChange={(d) => onChange({ ...value, firstVisitAt: d })} required data-testid="transition-date" />
    </div>
  );
}

export const AWI_CHECK_POWERS = transitionForm<ExistingPowersInput>(() => ({ reference: '', powerOfAttorney: { exists: false }, guardianship: { exists: false } }), ExistingPowersForm);
export const AWI_ROUTE_DECISION = transitionForm<RouteDecisionInput>(() => ({ route: 'guardianship-welfare', rationale: '', willAndPreferences: { pastWishes: '', presentWishes: '', communicationMethod: '', consultedOthers: [] } }), RouteDecisionForm);
export const AWI_OPEN_APPLICATION = transitionForm<OpenApplicationInput>(() => ({ applicant: 'council', applicantName: '', powersSought: [], mhoUserId: '', sheriffCourt: '' }), OpenApplicationForm);
export const AWI_RECORD_REPORT = transitionForm<ReportValue>((_, { user }) => ({ kind: user?.roleId === 'mho' ? 'mho' : 'medical', practitioner: '', practitionerKind: 'approved-medical-practitioner', receivedAt: '', submittedAt: '', date: '' }), ReportForm);
export const AWI_COURT_EVENT = transitionForm<CourtValue>((process) => ({ event: (process as AwiProcess).detail.application?.court.lodgedAt ? 'hearing-set' : 'lodged', at: '' }), CourtEventForm);
export const AWI_BEGIN_SUPERVISION = transitionForm<BeginSupervisionInput>((_, { user }) => ({ supervisingOfficerUserId: user?.roleId === 'social-worker-adults' ? user.id : '', supervisingOfficerName: user?.roleId === 'social-worker-adults' ? `${user.givenName} ${user.familyName}` : '', firstVisitAt: '' }), BeginSupervisionForm);
