import { t } from '@mas/messages';
import { AIDEN, MARION } from '@mas/mock-data';
import { MockAdapter, type MockAdapterSpec } from './base';

const aiden = { personId: AIDEN.aiden, displayName: 'BOYLE, Aiden', dateOfBirth: '2019-03-14' };

/**
 * Ids, capabilities, mapping rules and fixture data only. Display names, system names, the
 * narrative and the mapping notes are catalogue copy under connectors.adapters.<id> and
 * connectors.ruleNotes.<rule id>; the fixture events, matches and register values are synthetic
 * source-system data, not copy.
 */
const specs: MockAdapterSpec[] = [
  {
    id: 'emis-web',
    agency: 'health',
    capabilities: ['lookupPerson', 'pullEvents', 'flagRecord', 'registerCheck'],
    direction: 'both',
    mapping: [
      { id: 'emis.consultation.safeguarding-context', sourceField: 'Consultation.Code', sourceValue: 'Safeguarding concern (SNOMED-style code, fictional 9998001)', eventType: 'health.consultation', significance: 'high' },
      { id: 'emis.consultation.routine', sourceField: 'Consultation.Code', sourceValue: 'Any other consultation code', eventType: 'health.consultation', significance: 'low' },
      { id: 'emis.dna', sourceField: 'Appointment.Status', sourceValue: 'DNA', eventType: 'health.missed-appointment', significance: 'moderate' },
      { id: 'emis.diagnosis.disclosed', sourceField: 'Problem.Code', sourceValue: 'Dementia, alcohol dependence, severe mental illness (fictional code group)', eventType: 'health.diagnosis', significance: 'high' },
    ],
    events: [
      { personId: AIDEN.aiden, externalRef: 'EMIS-CONS-88213', occurredAt: '2026-08-27T15:20:00+01:00', hasTime: true, source: { 'Patient': 'BOYLE, Aiden', 'Practice': 'Craiglarrick Health Centre', 'Clinician': 'Dr Farouk', 'Consultation.Code': 'Sleep difficulty; safeguarding context (9998001)' }, ruleId: 'emis.consultation.safeguarding-context', title: 'GP consultation: nightmares and sleep difficulty', detail: 'Mother reports Aiden waking most nights since May. Sleep advice given; review in six weeks.' },
    ],
    matches: [{ ...aiden, externalId: 'EMIS-P-40021', address: '12 Brae Wynd, Craiglarrick QX5 3RT', confidence: 'exact', source: { 'CHI': '1403190012', 'Practice': 'Craiglarrick Health Centre' } }],
    registers: () => ({ register: t('connectors.registers.emisWeb.name'), checkedAt: new Date().toISOString(), found: true, entries: [{ label: t('connectors.registers.emisWeb.cpFlag'), value: 'Present since 17 Jun 2026' }] }),
  },
  {
    id: 'eclipse',
    agency: 'social-work',
    capabilities: ['lookupPerson', 'pullEvents', 'pushOutcome', 'registerCheck', 'flagRecord'],
    direction: 'both',
    mapping: [
      { id: 'eclipse.referral', sourceField: 'Contact.Type', sourceValue: 'Referral', eventType: 'social-work.referral', significance: 'moderate' },
      { id: 'eclipse.assessment', sourceField: 'Assessment.Status', sourceValue: 'Completed', eventType: 'social-work.assessment', significance: 'moderate' },
      { id: 'eclipse.allocation', sourceField: 'Allocation.Change', sourceValue: 'Any', eventType: 'social-work.allocation', significance: 'low' },
      { id: 'eclipse.service', sourceField: 'Service.Status', sourceValue: 'Started or Ended', eventType: 'care.service-start', significance: 'low' },
    ],
    events: [],
    matches: [{ ...aiden, externalId: 'ECL-119203', address: '12 Brae Wynd, Craiglarrick QX5 3RT', confidence: 'exact', source: { 'Client ref': 'ECL-119203', 'Team': 'Children and Families, Ardvale' } }],
    registers: () => ({ register: t('connectors.registers.eclipse.name'), checkedAt: new Date().toISOString(), found: true, entries: [{ label: t('connectors.registers.eclipse.status'), value: 'Registered 12 Jun 2026' }, { label: t('connectors.registers.eclipse.categories'), value: 'Emotional abuse; physical abuse' }, { label: t('connectors.registers.eclipse.leadProfessional'), value: 'Janet Kerr, 01000 456789' }] }),
    /*
     * What the council system says it holds, which deliberately does not match what we last wrote.
     *
     * A reconciliation screen with nothing to reconcile demonstrates nothing, and the divergences
     * here are the three kinds that actually occur: a name the source has updated and we have not
     * (theirs to keep), a stage we have moved and the source has not (ours to write out), and an
     * allocated worker both sides have changed, which is the one a person has to decide.
     */
    held: {
      [MARION.marion]: {
        'Client.Name': 'Marion Fraser',
        'Client.DateOfBirth': '1947-02-19',
        'Episode.Type': 'ASP',
        'Episode.OpenedDate': '2026-08-21',
        'Episode.Stage': 'inquiry',
        'Episode.AllocatedWorker': 'Duty team, Portlennan',
        'Episode.CaseReference': 'ASP-2026-0217',
      },
    },
  },
  {
    id: 'carefirst',
    agency: 'social-work',
    capabilities: ['lookupPerson', 'pullEvents'],
    direction: 'inbound',
    mapping: [
      { id: 'carefirst.contact', sourceField: 'CONTACT_TYPE', sourceValue: 'REF', eventType: 'social-work.referral', significance: 'moderate' },
      { id: 'carefirst.case-closed', sourceField: 'CASE_STATUS', sourceValue: 'CLOSED', eventType: 'social-work.plan-review', significance: 'low' },
    ],
    events: [],
    matches: [{ ...aiden, externalId: 'CF-0029113', confidence: 'probable', source: { 'CF_ID': 'CF-0029113', 'SURNAME': 'BOYLE', 'FORENAME': 'AIDEN' } }],
  },
  {
    id: 'ivpd',
    agency: 'police',
    capabilities: ['lookupPerson', 'pullEvents'],
    direction: 'inbound',
    mapping: [
      { id: 'ivpd.ccr.child-present', sourceField: 'Report.Type', sourceValue: 'Child Concern Report with "child present" marker', eventType: 'police.concern-report', significance: 'high' },
      { id: 'ivpd.ccr', sourceField: 'Report.Type', sourceValue: 'Child Concern Report', eventType: 'police.concern-report', significance: 'moderate' },
      { id: 'ivpd.acr', sourceField: 'Report.Type', sourceValue: 'Adult Concern Report', eventType: 'police.concern-report', significance: 'moderate' },
      { id: 'ivpd.da', sourceField: 'Report.Type', sourceValue: 'Domestic abuse concern report', eventType: 'police.incident', significance: 'high' },
      { id: 'ivpd.charge', sourceField: 'Disposal', sourceValue: 'Charged', eventType: 'police.charge', significance: 'high' },
      { id: 'ivpd.bail', sourceField: 'Disposal', sourceValue: 'Bail or undertaking with conditions', eventType: 'police.bail-condition', significance: 'high' },
    ],
    events: [
      { personId: AIDEN.aiden, externalRef: 'IVPD-CCR-2026-08-2291', occurredAt: '2026-08-29T19:40:00+01:00', hasTime: true, source: { 'Report.Type': 'Child Concern Report', 'Child': 'BOYLE, Aiden', 'Adults': 'BOYLE, Stacey; BOYLE, Kevin', 'Location': '12 Brae Wynd, Craiglarrick', 'Marker': 'Child present', 'Crime': 'None' }, ruleId: 'ivpd.ccr.child-present', title: 'Child concern report: argument between parents at Sunday handover, father intoxicated', detail: 'Officers attended after a call from Stacey Boyle. Kevin Boyle intoxicated when returning Aiden. Argument on the doorstep. No injuries.' },
    ],
    matches: [{ ...aiden, externalId: 'VPD-2026-118842', confidence: 'exact', source: { 'Nominal': 'VPD-2026-118842', 'Reports': '4' } }],
  },
  {
    id: 'seemis',
    agency: 'education',
    capabilities: ['lookupPerson', 'pullEvents', 'flagRecord'],
    direction: 'both',
    mapping: [
      { id: 'seemis.enrolment', sourceField: 'Enrolment.Event', sourceValue: 'Enrolled or transferred', eventType: 'education.enrolment', significance: 'low' },
      { id: 'seemis.attendance.monthly', sourceField: 'Attendance.Summary', sourceValue: 'Monthly percentage below 90 or any unauthorised absence', eventType: 'education.attendance', significance: 'moderate' },
      { id: 'seemis.exclusion', sourceField: 'Exclusion', sourceValue: 'Any', eventType: 'education.exclusion', significance: 'high' },
      { id: 'seemis.pastoral', sourceField: 'Pastoral.Note.Category', sourceValue: 'Wellbeing or child protection', eventType: 'education.concern', significance: 'high' },
    ],
    events: [
      { personId: AIDEN.aiden, externalRef: 'SEEMIS-ATT-2026-08', occurredAt: '2026-08-31T00:00:00+01:00', hasTime: false, source: { 'Pupil': 'BOYLE, Aiden', 'Stage': 'P3', 'Period': 'Aug 2026', 'Possible': '20', 'Attended': '17', 'Unauthorised': '3', 'Pattern': 'Mon, Mon, Fri' }, ruleId: 'seemis.attendance.monthly', title: 'Attendance 85 percent in August (3 unauthorised absences)', detail: 'Three unauthorised absences on Mondays and a Friday in the first weeks of P3.' },
    ],
    matches: [{ ...aiden, externalId: 'SCN-2019031401', confidence: 'exact', source: { 'SCN': 'SCN-2019031401', 'School': 'Ardvale Primary', 'Stage': 'P3' } }],
  },
  {
    id: 'trakcare',
    agency: 'health',
    capabilities: ['lookupPerson', 'pullEvents'],
    direction: 'inbound',
    mapping: [
      { id: 'trakcare.ed', sourceField: 'Encounter.Type', sourceValue: 'Emergency department', eventType: 'health.attendance', significance: 'moderate' },
      { id: 'trakcare.admission', sourceField: 'Encounter.Type', sourceValue: 'Inpatient admission', eventType: 'health.admission', significance: 'moderate' },
      { id: 'trakcare.birth', sourceField: 'Encounter.Type', sourceValue: 'Maternity delivery', eventType: 'family.birth', significance: 'low' },
    ],
    events: [],
    matches: [{ ...aiden, externalId: 'TRAK-MRN-5591002', confidence: 'exact', source: { 'MRN': '5591002', 'CHI': '1403190012' } }],
  },
  {
    id: 'morse',
    agency: 'health',
    capabilities: ['lookupPerson', 'pullEvents'],
    direction: 'inbound',
    mapping: [
      { id: 'morse.hv-review', sourceField: 'Contact.Outcome', sourceValue: 'Completed review', eventType: 'health.assessment', significance: 'low' },
      { id: 'morse.hv-dna', sourceField: 'Contact.Outcome', sourceValue: 'Not achieved', eventType: 'health.missed-appointment', significance: 'moderate' },
      { id: 'morse.cmht', sourceField: 'Service', sourceValue: 'Community mental health contact', eventType: 'health.consultation', significance: 'moderate' },
    ],
    events: [],
    matches: [{ ...aiden, externalId: 'MORSE-CL-77120', confidence: 'exact', source: { 'Client': 'MORSE-CL-77120', 'Service': 'Health visiting, Craiglarrick' } }],
  },
  {
    id: 'opg',
    agency: 'regulator',
    capabilities: ['registerCheck', 'pullEvents'],
    direction: 'inbound',
    mapping: [
      { id: 'opg.poa', sourceField: 'Register.Entry', sourceValue: 'Power of attorney registered', eventType: 'legal.poa-registered', significance: 'moderate' },
      { id: 'opg.guardianship', sourceField: 'Register.Entry', sourceValue: 'Guardianship order registered', eventType: 'legal.guardianship', significance: 'high' },
    ],
    events: [],
    matches: [],
    registers: (subject) => ({ register: t('connectors.registers.opg.name'), checkedAt: new Date().toISOString(), found: false, entries: [{ label: t('connectors.registers.opg.poa'), value: t('connectors.registers.opg.noPoa', { personId: subject.personId }) }, { label: t('connectors.registers.opg.guardianship'), value: t('connectors.registers.opg.noGuardianship') }] }),
  },
  {
    id: 'scra',
    agency: 'scra',
    capabilities: ['pushOutcome', 'pullEvents'],
    direction: 'both',
    mapping: [
      { id: 'scra.referral', sourceField: 'Referral.Received', sourceValue: 'Any', eventType: 'process.referral', significance: 'high' },
      { id: 'scra.hearing', sourceField: 'Hearing.Held', sourceValue: 'Any', eventType: 'legal.hearing', significance: 'high' },
    ],
    events: [],
    matches: [],
  },
  {
    id: 'visor',
    agency: 'police',
    capabilities: ['lookupPerson'],
    direction: 'outbound',
    mapping: [{ id: 'visor.reference', sourceField: 'Nominal.Reference', sourceValue: 'ViSOR nominal id', eventType: 'other', significance: 'low' }],
    events: [],
    matches: [],
  },
];

export const MOCK_ADAPTERS: MockAdapter[] = specs.map((s) => new MockAdapter(s));

export function adapterById(id: string): MockAdapter | undefined {
  return MOCK_ADAPTERS.find((a) => a.id === id);
}
