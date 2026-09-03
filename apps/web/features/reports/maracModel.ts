/**
 * MARAC SafeLives return fields, computed from MARAC referrals and meetings. SafeLives collects
 * meeting-level counts, so nothing here identifies a victim.
 */
import { AGENCIES, AGENCY_SHORT, formatDateTime, localDateOf, type Dataset, type MaracProcess } from '@mas/domain';
import { agencyColourVar } from '@mas/ui';
import { personById } from '@/lib/selectors';
import { ageOn } from './helpers';
import { countBy, pct, per10k, plural, scaleColour, sum, type ChartSpec, type ReportModel, type ReportSection, type TableSpec } from './model';
import { inPeriod, type Period } from './period';

export function maracModel(data: Dataset, now: Date, period: Period, population: number): ReportModel {
  const maracs = data.processes.filter((p): p is MaracProcess => p.type === 'marac');
  const referrals = maracs.filter((p) => inPeriod(p.detail.referral.receivedAt, period));
  const heldIds = new Set(data.meetings.filter((m) => m.type === 'marac' && m.status === 'held' && inPeriod(m.scheduledAt, period)).map((m) => m.id));
  const meetingsHeld = heldIds.size;
  const discussed = maracs.filter((p) => p.detail.meetingId && heldIds.has(p.detail.meetingId));
  const awaiting = referrals.filter((p) => !(p.detail.meetingId && heldIds.has(p.detail.meetingId)));
  const repeats = referrals.filter((p) => p.detail.referral.repeat);
  const judgement = referrals.filter((p) => p.detail.referral.professionalJudgementReferral);
  const withChildren = referrals.filter((p) => p.detail.referral.childPersonIds.length > 0);
  const children = sum(referrals.map((p) => p.detail.referral.childPersonIds.length));
  const byAgency = countBy(referrals, (p) => p.detail.referral.referringAgency);
  const agencies = AGENCIES.filter((a) => (byAgency.get(a) ?? 0) > 0);
  const police = byAgency.get('police') ?? 0;

  const victims = referrals.map((p) => ({ p, v: personById(data, p.detail.referral.victimPersonId) }));
  const male = victims.filter(({ v }) => v?.sex === 'male').length;
  const older = victims.filter(({ p, v }) => v?.dateOfBirth && ageOn(v.dateOfBirth, localDateOf(p.detail.referral.receivedAt)) >= 61).length;
  const minority = victims.filter(({ v }) => v?.ethnicity && v.ethnicity !== 'scottish').length;
  const interpreter = victims.filter(({ v }) => v?.communicationNeeds.interpreterLanguage).length;

  const risk = referrals.map((p) => data.riskAssessments.find((r) => r.id === p.detail.referral.riskAssessmentId));
  const dash = risk.filter((r) => r?.tool === 'dash').length;
  const daq = risk.filter((r) => r?.tool === 'daq').length;
  const overrides = risk.filter((r) => r?.judgementOverride).length;

  const flags = maracs.flatMap((p) => p.detail.flags).filter((f) => inPeriod(f.placedAt, period)).length;
  const cpLinked = referrals.filter((p) => p.detail.links.cpProcessId).length;
  const aspLinked = referrals.filter((p) => p.detail.links.aspProcessId).length;
  const mappaLinked = referrals.filter((p) => p.detail.links.mappaProcessId).length;
  const matac = referrals.filter((p) => p.detail.links.matacReferredAt).length;
  const dsdas = referrals.filter((p) => p.detail.links.dsdasConsidered).length;
  const transfers = maracs.filter((p) => p.detail.transfer && inPeriod(p.detail.transfer.at, period)).length;

  const chart: ChartSpec = {
    id: 'marac-by-agency',
    kind: 'bar',
    title: 'Referrals by agency',
    summary: `Referrals by agency: ${plural(referrals.length, 'referral')}${agencies.length > 0 ? `, ${agencies.map((a) => `${byAgency.get(a) ?? 0} from ${AGENCY_SHORT[a]}`).join(', ')}` : ''}.`,
    categories: agencies.map((a) => AGENCY_SHORT[a]),
    categoryColours: agencies.map((a) => agencyColourVar(a)),
    categoryLegend: agencies.map((a) => ({ key: a, label: AGENCY_SHORT[a], colour: agencyColourVar(a), agency: a })),
    series: [{ key: 'referrals', label: 'Referrals', colour: scaleColour(0) }],
    values: [agencies.map((a) => byAgency.get(a) ?? 0)],
    xLabel: 'Referring agency',
    yLabel: 'Referrals',
  };

  const agencyTable: TableSpec = {
    id: 'marac-agency-table',
    columns: ['Referring agency', 'Referrals', 'Share of referrals'],
    numeric: [1, 2],
    rows: agencies.map((a) => [AGENCY_SHORT[a], byAgency.get(a) ?? 0, pct(byAgency.get(a) ?? 0, referrals.length)]),
    empty: 'No referrals in period',
  };

  const casesTable: TableSpec = {
    id: 'marac-cases',
    columns: ['Measure', 'Count', 'Share or rate'],
    numeric: [1, 2],
    rows: [
      ['MARAC meetings held', meetingsHeld, ''],
      ['Referrals received', referrals.length, ''],
      ['Cases discussed at a MARAC held in the period', discussed.length, ''],
      ['Referrals awaiting a meeting', awaiting.length, pct(awaiting.length, referrals.length)],
      ['Repeat referrals (a further referral within 12 months of the last MARAC)', repeats.length, pct(repeats.length, referrals.length)],
      ['Referrals on professional judgement below the DASH threshold', judgement.length, pct(judgement.length, referrals.length)],
      ['Cases with children in the household', withChildren.length, pct(withChildren.length, referrals.length)],
      ['Children in those households', children, ''],
      ['Police referrals', police, pct(police, referrals.length)],
      [`Cases discussed per 10,000 adult women (population ${population.toLocaleString('en-GB')}, fictional)`, discussed.length, per10k(discussed.length, population)],
      ['Referrals per 10,000 adult women (same population)', referrals.length, per10k(referrals.length, population)],
    ],
  };

  const victimTable: TableSpec = {
    id: 'marac-victims',
    columns: ['Characteristic', 'Cases', 'How it is derived'],
    numeric: [1],
    rows: [
      ['Male victims', male, 'Sex on the person record'],
      ['Victims aged 61 or over at referral', older, 'Date of birth on the person record; SafeLives counts older victims from 61'],
      ['Minority ethnic victims', minority, 'Ethnicity recorded as other than Scottish; census categories are not held yet'],
      ['Victims who need an interpreter', interpreter, 'Communication needs on the person record'],
      ['LGBT victims', 'Not recorded', 'The record store has no field for this yet, so no number is given'],
      ['Victims with a disability', 'Not recorded', 'The record store has no field for this yet, so no number is given'],
    ],
  };

  const riskTable: TableSpec = {
    id: 'marac-risk',
    columns: ['Risk identification', 'Count'],
    numeric: [1],
    rows: [
      ['SafeLives DASH checklists', dash],
      ['Police Scotland DAQ', daq],
      ['Professional judgement overrides of the tool score', overrides],
    ],
  };

  const linksTable: TableSpec = {
    id: 'marac-links',
    columns: ['Link or outcome', 'Cases'],
    numeric: [1],
    rows: [
      ['Linked child protection process', cpLinked],
      ['Linked adult support and protection process', aspLinked],
      ['Linked MAPPA process', mappaLinked],
      ['Perpetrator referred to MATAC', matac],
      ['Disclosure Scheme for Domestic Abuse Scotland considered', dsdas],
      ['MARAC flags placed on agency records in the period', flags],
      ['Cases transferred to another MARAC', transfers],
    ],
  };

  const sections: ReportSection[] = [
    { id: 'agency', title: 'Referrals by agency', note: 'The agency that made the referral, from the referral record.', chart, tables: [agencyTable] },
    { id: 'cases', title: 'Cases, repeats and children', note: 'SafeLives counts cases discussed at each meeting; referrals are shown as well because a case referred late in a quarter is discussed in the next.', tables: [casesTable] },
    { id: 'victims', title: 'Victim characteristics', note: 'Counts only. Where the record store holds no field, the return says so rather than guessing.', tables: [victimTable] },
    { id: 'risk', title: 'Risk identification', tables: [riskTable] },
    { id: 'links', title: 'Links, flags and outcomes', tables: [linksTable] },
  ];

  return {
    kind: 'marac',
    title: 'MARAC SafeLives return',
    lede: 'The meeting-level counts SafeLives collects from every MARAC each quarter, computed from the referrals and meetings in the record store. Counts only: nothing here names a victim.',
    period,
    classification: 'official-sensitive',
    meta: [
      `Period ${period.label}.`,
      `Computed ${formatDateTime(now)} from the local record store: ${plural(maracs.length, 'MARAC record')} in total, ${referrals.length} referred in the period.`,
      `Rate per 10,000 uses an adult female population of ${population.toLocaleString('en-GB')} for Clydeshore, which is fictional and can be changed above.`,
      'Field set to verify against the current template.',
    ],
    verify: [
      'SafeLives publishes guidance and a data template workbook for MARACs; the field list here (cases, repeats, children, referral agency, older, male, minority ethnic, LGBT and disabled victims, cases per 10,000 adult women) follows the quarterly key findings reports and should be checked against the current workbook.',
      'The older victim threshold of 61 follows the SafeLives spotlight on older people; confirm it against the current dataset definitions.',
    ],
    sources: [
      'SafeLives, MARAC data: guidance for MARACs, and the MARAC data template workbook (safelives.org.uk).',
      'SafeLives, Marac data key findings April 2024 to March 2025 (safelives.org.uk).',
      'SafeLives, Spotlight on older people and domestic abuse (safelives.org.uk).',
    ],
    figures: [
      { id: 'referrals', label: 'Referrals received', value: String(referrals.length) },
      { id: 'discussed', label: 'Cases discussed', value: String(discussed.length), note: `${plural(meetingsHeld, 'meeting')} held` },
      { id: 'repeat', label: 'Repeat rate', value: pct(repeats.length, referrals.length), note: `${plural(repeats.length, 'repeat referral')}` },
      { id: 'children', label: 'Children in households', value: String(children) },
      { id: 'police', label: 'Police referrals', value: pct(police, referrals.length), note: `${police} of ${referrals.length}` },
      { id: 'rate', label: 'Cases per 10,000 adult women', value: per10k(discussed.length, population), note: 'fictional population' },
    ],
    sections,
    activity: referrals.length + discussed.length,
  };
}
