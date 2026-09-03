import { AIDEN } from '@mas/mock-data';
import { MockAdapter, type MockAdapterSpec } from './base';

const aiden = { personId: AIDEN.aiden, displayName: 'BOYLE, Aiden', dateOfBirth: '2019-03-14' };

const specs: MockAdapterSpec[] = [
  {
    id: 'emis-web',
    displayName: 'EMIS Web (GP)',
    systemName: 'EMIS Web',
    agency: 'health',
    capabilities: ['lookupPerson', 'pullEvents', 'flagRecord', 'registerCheck'],
    mapping: [
      { id: 'emis.consultation.safeguarding-context', sourceField: 'Consultation.Code', sourceValue: 'Safeguarding concern (SNOMED-style code, fictional 9998001)', eventType: 'health.consultation', significance: 'high', note: 'Any consultation carrying a safeguarding code becomes a high-significance health event.' },
      { id: 'emis.consultation.routine', sourceField: 'Consultation.Code', sourceValue: 'Any other consultation code', eventType: 'health.consultation', significance: 'low', note: 'Routine consultations are pulled only inside a process window.' },
      { id: 'emis.dna', sourceField: 'Appointment.Status', sourceValue: 'DNA', eventType: 'health.missed-appointment', significance: 'moderate', note: 'Did not attend.' },
      { id: 'emis.diagnosis.disclosed', sourceField: 'Problem.Code', sourceValue: 'Dementia, alcohol dependence, severe mental illness (fictional code group)', eventType: 'health.diagnosis', significance: 'high', note: 'Only with a recorded lawful basis; the GP confirms disclosure.' },
    ],
    narrative: { authModel: 'NHS Scotland national identity with a practice-level data sharing agreement; the platform holds a service account per health board.', direction: 'both', cadence: 'Nightly pull for people with an open process; on-demand pull for an s10 records request; flags pushed on the day they are placed.', notes: 'Health records are only inspected by a health professional. The adapter returns coded events, never free-text consultation notes.' },
    events: [
      { personId: AIDEN.aiden, externalRef: 'EMIS-CONS-88213', occurredAt: '2026-08-27T15:20:00+01:00', hasTime: true, source: { 'Patient': 'BOYLE, Aiden', 'Practice': 'Craiglarrick Health Centre', 'Clinician': 'Dr Farouk', 'Consultation.Code': 'Sleep difficulty; safeguarding context (9998001)' }, ruleId: 'emis.consultation.safeguarding-context', title: 'GP consultation: nightmares and sleep difficulty', detail: 'Mother reports Aiden waking most nights since May. Sleep advice given; review in six weeks.' },
    ],
    matches: [{ ...aiden, externalId: 'EMIS-P-40021', address: '12 Brae Wynd, Craiglarrick QX5 3RT', confidence: 'exact', source: { 'CHI': '1403190012', 'Practice': 'Craiglarrick Health Centre' } }],
    registers: () => ({ register: 'GP record flags', checkedAt: new Date().toISOString(), found: true, entries: [{ label: 'Child protection flag', value: 'Present since 17 Jun 2026' }] }),
  },
  {
    id: 'eclipse',
    displayName: 'Civica ECLIPSE (social work)',
    systemName: 'Civica ECLIPSE',
    agency: 'social-work',
    capabilities: ['lookupPerson', 'pullEvents', 'pushOutcome', 'registerCheck', 'flagRecord'],
    mapping: [
      { id: 'eclipse.referral', sourceField: 'Contact.Type', sourceValue: 'Referral', eventType: 'social-work.referral', significance: 'moderate', note: 'Every referral is significant enough for the single-agency chronology.' },
      { id: 'eclipse.assessment', sourceField: 'Assessment.Status', sourceValue: 'Completed', eventType: 'social-work.assessment', significance: 'moderate', note: 'Outcome text is mapped from the assessment outcome field.' },
      { id: 'eclipse.allocation', sourceField: 'Allocation.Change', sourceValue: 'Any', eventType: 'social-work.allocation', significance: 'low', note: 'Allocation changes are visible to the team, not integrated by default.' },
      { id: 'eclipse.service', sourceField: 'Service.Status', sourceValue: 'Started or Ended', eventType: 'care.service-start', significance: 'low', note: 'Service end maps to care.service-end.' },
    ],
    narrative: { authModel: 'Council single sign-on (Entra ID) with ECLIPSE API keys held by the council; the platform reads via the ECLIPSE integration layer.', direction: 'both', cadence: 'Near real time for referrals and allocations; outcomes (registration, case conference decisions) pushed back on approval of the minute.', notes: 'ECLIPSE remains the council case record. The platform holds the multi-agency picture and writes back decisions, not case notes.' },
    events: [],
    matches: [{ ...aiden, externalId: 'ECL-119203', address: '12 Brae Wynd, Craiglarrick QX5 3RT', confidence: 'exact', source: { 'Client ref': 'ECL-119203', 'Team': 'Children and Families, Ardvale' } }],
    registers: () => ({ register: 'Child Protection Register (Clydeshore)', checkedAt: new Date().toISOString(), found: true, entries: [{ label: 'Status', value: 'Registered 12 Jun 2026' }, { label: 'Categories', value: 'Emotional abuse; physical abuse' }, { label: 'Lead professional', value: 'Janet Kerr, 01000 456789' }] }),
  },
  {
    id: 'carefirst',
    displayName: 'OLM CareFirst (legacy social work)',
    systemName: 'OLM CareFirst',
    agency: 'social-work',
    capabilities: ['lookupPerson', 'pullEvents'],
    mapping: [
      { id: 'carefirst.contact', sourceField: 'CONTACT_TYPE', sourceValue: 'REF', eventType: 'social-work.referral', significance: 'moderate', note: 'Legacy referrals before the ECLIPSE migration.' },
      { id: 'carefirst.case-closed', sourceField: 'CASE_STATUS', sourceValue: 'CLOSED', eventType: 'social-work.plan-review', significance: 'low', note: 'Closure with reason.' },
    ],
    narrative: { authModel: 'Read-only database replica with a nightly extract; no write-back because the system is no longer developed.', direction: 'inbound', cadence: 'Nightly, historical only (pre-2023 records).', notes: 'Used for history during the migration period. Retire once ECLIPSE holds the full history.' },
    events: [],
    matches: [{ ...aiden, externalId: 'CF-0029113', confidence: 'probable', source: { 'CF_ID': 'CF-0029113', 'SURNAME': 'BOYLE', 'FORENAME': 'AIDEN' } }],
  },
  {
    id: 'ivpd',
    displayName: 'iVPD (Police Scotland concern reports)',
    systemName: 'interim Vulnerable Persons Database',
    agency: 'police',
    capabilities: ['lookupPerson', 'pullEvents'],
    mapping: [
      { id: 'ivpd.ccr.child-present', sourceField: 'Report.Type', sourceValue: 'Child Concern Report with "child present" marker', eventType: 'police.concern-report', significance: 'high', note: 'A child present at an incident is always high significance.' },
      { id: 'ivpd.ccr', sourceField: 'Report.Type', sourceValue: 'Child Concern Report', eventType: 'police.concern-report', significance: 'moderate', note: 'Concern reports without the child-present marker.' },
      { id: 'ivpd.acr', sourceField: 'Report.Type', sourceValue: 'Adult Concern Report', eventType: 'police.concern-report', significance: 'moderate', note: 'Adult concern reports feed the ASP duty screen.' },
      { id: 'ivpd.da', sourceField: 'Report.Type', sourceValue: 'Domestic abuse concern report', eventType: 'police.incident', significance: 'high', note: 'Domestic abuse reports carry the DAQ score when completed.' },
      { id: 'ivpd.charge', sourceField: 'Disposal', sourceValue: 'Charged', eventType: 'police.charge', significance: 'high', note: 'Offence data: DPA 2018 s10 applies to onward sharing.' },
      { id: 'ivpd.bail', sourceField: 'Disposal', sourceValue: 'Bail or undertaking with conditions', eventType: 'police.bail-condition', significance: 'high', note: 'Conditions are the fields most often shared to schools and housing.' },
    ],
    narrative: { authModel: 'Police Scotland secure gateway with a signed data sharing agreement per Chief Officers Group; the platform is a receiving system only.', direction: 'inbound', cadence: 'Concern reports arrive within an hour of submission and land in the concern hub inbox.', notes: 'The platform never writes to police systems. Charges and bail conditions are offence data and are shared onward only under a recorded lawful basis.' },
    events: [
      { personId: AIDEN.aiden, externalRef: 'IVPD-CCR-2026-08-2291', occurredAt: '2026-08-29T19:40:00+01:00', hasTime: true, source: { 'Report.Type': 'Child Concern Report', 'Child': 'BOYLE, Aiden', 'Adults': 'BOYLE, Stacey; BOYLE, Kevin', 'Location': '12 Brae Wynd, Craiglarrick', 'Marker': 'Child present', 'Crime': 'None' }, ruleId: 'ivpd.ccr.child-present', title: 'Child concern report: argument between parents at Sunday handover, father intoxicated', detail: 'Officers attended after a call from Stacey Boyle. Kevin Boyle intoxicated when returning Aiden. Argument on the doorstep. No injuries.' },
    ],
    matches: [{ ...aiden, externalId: 'VPD-2026-118842', confidence: 'exact', source: { 'Nominal': 'VPD-2026-118842', 'Reports': '4' } }],
  },
  {
    id: 'seemis',
    displayName: 'SEEMIS (schools)',
    systemName: 'SEEMIS',
    agency: 'education',
    capabilities: ['lookupPerson', 'pullEvents', 'flagRecord'],
    mapping: [
      { id: 'seemis.enrolment', sourceField: 'Enrolment.Event', sourceValue: 'Enrolled or transferred', eventType: 'education.enrolment', significance: 'low', note: 'School and stage.' },
      { id: 'seemis.attendance.monthly', sourceField: 'Attendance.Summary', sourceValue: 'Monthly percentage below 90 or any unauthorised absence', eventType: 'education.attendance', significance: 'moderate', note: 'Above 90 percent with no unauthorised absence is not pulled.' },
      { id: 'seemis.exclusion', sourceField: 'Exclusion', sourceValue: 'Any', eventType: 'education.exclusion', significance: 'high', note: 'Exclusions are always significant.' },
      { id: 'seemis.pastoral', sourceField: 'Pastoral.Note.Category', sourceValue: 'Wellbeing or child protection', eventType: 'education.concern', significance: 'high', note: 'Only the category and date are pulled; the note text stays in SEEMIS.' },
    ],
    narrative: { authModel: 'Council education directorate account with SEEMIS Group API access; the named person authorises pulls for their pupils.', direction: 'both', cadence: 'Attendance monthly; pastoral categories and exclusions same day; child protection register status pushed as a pupil flag.', notes: 'Free-text pastoral notes never leave SEEMIS. The head teacher promotes what is relevant.' },
    events: [
      { personId: AIDEN.aiden, externalRef: 'SEEMIS-ATT-2026-08', occurredAt: '2026-08-31T00:00:00+01:00', hasTime: false, source: { 'Pupil': 'BOYLE, Aiden', 'Stage': 'P3', 'Period': 'Aug 2026', 'Possible': '20', 'Attended': '17', 'Unauthorised': '3', 'Pattern': 'Mon, Mon, Fri' }, ruleId: 'seemis.attendance.monthly', title: 'Attendance 85 percent in August (3 unauthorised absences)', detail: 'Three unauthorised absences on Mondays and a Friday in the first weeks of P3.' },
    ],
    matches: [{ ...aiden, externalId: 'SCN-2019031401', confidence: 'exact', source: { 'SCN': 'SCN-2019031401', 'School': 'Ardvale Primary', 'Stage': 'P3' } }],
  },
  {
    id: 'trakcare',
    displayName: 'TrakCare (hospital patient management)',
    systemName: 'InterSystems TrakCare',
    agency: 'health',
    capabilities: ['lookupPerson', 'pullEvents'],
    mapping: [
      { id: 'trakcare.ed', sourceField: 'Encounter.Type', sourceValue: 'Emergency department', eventType: 'health.attendance', significance: 'moderate', note: 'Injury attendances for children carry the child protection screening result.' },
      { id: 'trakcare.admission', sourceField: 'Encounter.Type', sourceValue: 'Inpatient admission', eventType: 'health.admission', significance: 'moderate', note: 'Discharge maps to health.discharge.' },
      { id: 'trakcare.birth', sourceField: 'Encounter.Type', sourceValue: 'Maternity delivery', eventType: 'family.birth', significance: 'low', note: 'Birth registered with weight and gestation.' },
    ],
    narrative: { authModel: 'Health board integration engine with a patient-level consent and safeguarding override model; Caldicott guardian sign-off on the sharing agreement.', direction: 'inbound', cadence: 'Encounters within four hours of discharge.', notes: 'Diagnoses are not pulled; encounter type, date and screening outcome only.' },
    events: [],
    matches: [{ ...aiden, externalId: 'TRAK-MRN-5591002', confidence: 'exact', source: { 'MRN': '5591002', 'CHI': '1403190012' } }],
  },
  {
    id: 'morse',
    displayName: 'Morse (community and mental health)',
    systemName: 'Morse',
    agency: 'health',
    capabilities: ['lookupPerson', 'pullEvents'],
    mapping: [
      { id: 'morse.hv-review', sourceField: 'Contact.Outcome', sourceValue: 'Completed review', eventType: 'health.assessment', significance: 'low', note: 'Health visitor and school nurse reviews.' },
      { id: 'morse.hv-dna', sourceField: 'Contact.Outcome', sourceValue: 'Not achieved', eventType: 'health.missed-appointment', significance: 'moderate', note: 'Missed contacts are the pattern lens input.' },
      { id: 'morse.cmht', sourceField: 'Service', sourceValue: 'Community mental health contact', eventType: 'health.consultation', significance: 'moderate', note: 'Adult mental health contacts, shared only inside a process window.' },
    ],
    narrative: { authModel: 'As TrakCare, via the health board integration engine.', direction: 'inbound', cadence: 'Daily.', notes: 'Community contacts for children under five are the richest early-years signal in the chronology.' },
    events: [],
    matches: [{ ...aiden, externalId: 'MORSE-CL-77120', confidence: 'exact', source: { 'Client': 'MORSE-CL-77120', 'Service': 'Health visiting, Craiglarrick' } }],
  },
  {
    id: 'opg',
    displayName: 'OPG register (powers of attorney and guardianship)',
    systemName: 'Office of the Public Guardian register',
    agency: 'regulator',
    capabilities: ['registerCheck', 'pullEvents'],
    mapping: [
      { id: 'opg.poa', sourceField: 'Register.Entry', sourceValue: 'Power of attorney registered', eventType: 'legal.poa-registered', significance: 'moderate', note: 'Welfare, financial or combined.' },
      { id: 'opg.guardianship', sourceField: 'Register.Entry', sourceValue: 'Guardianship order registered', eventType: 'legal.guardianship', significance: 'high', note: 'Powers and expiry are register fields.' },
    ],
    narrative: { authModel: 'OPG public register search plus an authorised enquirer account for councils and health boards.', direction: 'inbound', cadence: 'On demand when an AWI or ASP financial harm process opens.', notes: 'The result is a register extract: whether a power exists, its type, the attorney or guardian, and dates.' },
    events: [],
    matches: [],
    registers: (subject) => ({ register: 'OPG register', checkedAt: new Date().toISOString(), found: false, entries: [{ label: 'Power of attorney', value: `No registered power of attorney for ${subject.personId}` }, { label: 'Guardianship', value: 'No guardianship order' }] }),
  },
  {
    id: 'scra',
    displayName: "SCRA (Children's Reporter)",
    systemName: 'SCRA case management',
    agency: 'scra',
    capabilities: ['pushOutcome', 'pullEvents'],
    mapping: [
      { id: 'scra.referral', sourceField: 'Referral.Received', sourceValue: 'Any', eventType: 'process.referral', significance: 'high', note: 'Referral to the Reporter recorded either way.' },
      { id: 'scra.hearing', sourceField: 'Hearing.Held', sourceValue: 'Any', eventType: 'legal.hearing', significance: 'high', note: "Children's hearing outcomes." },
    ],
    narrative: { authModel: 'SCRA secure referral gateway; the platform sends the referral decision and the Reporter returns the outcome.', direction: 'both', cadence: 'On decision.', notes: 'Every IRD and CPPM records whether a referral was made; the adapter sends the decision and reason.' },
    events: [],
    matches: [],
  },
  {
    id: 'visor',
    displayName: 'ViSOR (MAPPA reference only)',
    systemName: 'ViSOR (MAPPS from 2028)',
    agency: 'police',
    capabilities: ['lookupPerson'],
    mapping: [
      { id: 'visor.reference', sourceField: 'Nominal.Reference', sourceValue: 'ViSOR nominal id', eventType: 'other', significance: 'low', note: 'The platform stores the reference and never pulls ViSOR content.' },
    ],
    narrative: { authModel: 'No data connection. ViSOR access stays inside the police and RA secure estate; the platform stores the nominal reference typed in by the MAPPA Coordinator.', direction: 'outbound', cadence: 'None.', notes: 'When MAPPS replaces ViSOR the same reference field applies.' },
    events: [],
    matches: [],
  },
];

export const MOCK_ADAPTERS: MockAdapter[] = specs.map((s) => new MockAdapter(s));

export function adapterById(id: string): MockAdapter | undefined {
  return MOCK_ADAPTERS.find((a) => a.id === id);
}
