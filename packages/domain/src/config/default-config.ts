import { CLOCK_RULES } from '../clocks/rules';
import { EXCLUSIONS } from '../need-to-know/exclusions';
import { NEED_TO_KNOW_ROWS } from '../need-to-know/resolve';
import type { Config } from '../schemas/config';
import { DEFAULT_LABELS } from './labels';

/**
 * Scottish bank holidays used by working-day clocks.
 * TODO(verify): confirm against the Scottish Government published list each year. Admin can edit.
 */
/**
 * Scottish bank holidays, 2025 to 2027, as published on the gov.uk bank holidays feed
 * (https://www.gov.uk/bank-holidays.json, division "scotland"). The feed was unreachable through the
 * session proxy on 03 Sep 2026, so the dates are from published listings and the feed should be re-read
 * once a year (see docs/RESEARCH.md section 1). 15 Jun 2026 is the one-off men's World Cup holiday.
 */
export const BANK_HOLIDAYS_2026_2027: string[] = [
  '2025-01-01',
  '2025-01-02',
  '2025-04-18',
  '2025-05-05',
  '2025-05-26',
  '2025-08-04',
  '2025-12-01',
  '2025-12-25',
  '2025-12-26',
  '2026-01-01',
  '2026-01-02',
  '2026-04-03',
  '2026-05-04',
  '2026-05-25',
  '2026-06-15',
  '2026-08-03',
  '2026-11-30',
  '2026-12-25',
  '2026-12-28',
  '2027-01-01',
  '2027-01-04',
  '2027-03-26',
  '2027-05-03',
  '2027-05-31',
  '2027-08-02',
  '2027-11-30',
  '2027-12-27',
  '2027-12-28',
];

export const DEFAULT_CONFIG: Config = {
  area: {
    councilName: 'Clydeshore Council',
    hscpName: 'Clydeshore Health and Social Care Partnership',
    healthBoardName: 'NHS Clydeshore',
    policeDivision: 'Police Scotland Z Division',
    ppuBase: 'Ardvale Public Protection Unit',
    maracArea: 'Clydeshore MARAC',
    sheriffCourt: 'Ardvale Sheriff Court',
  },
  labels: DEFAULT_LABELS,
  clockRules: CLOCK_RULES,
  needToKnow: NEED_TO_KNOW_ROWS,
  exclusions: EXCLUSIONS,
  classificationMarkings: [
    { id: 'official', label: 'OFFICIAL', handling: 'Routine business information.' },
    { id: 'official-sensitive', label: 'OFFICIAL-SENSITIVE', handling: 'Personal and case information. Share on a need-to-know basis with a recorded lawful basis.' },
    { id: 'restricted', label: 'OFFICIAL-SENSITIVE: RESTRICTED', handling: 'MAPPA and other restricted records. Distribution list only. Every read is audited. Break-glass requires a reason.' },
  ],
  forms: [
    { id: 'asp.three-point-test', label: 'ASP three-point test', process: 'asp', version: '2022.1', effectiveFrom: '2022-07-01', source: 'ASP Code of Practice July 2022' },
    { id: 'asp.adult-concern', label: 'Adult concern record', process: 'asp', version: '2025.2', effectiveFrom: '2025-04-01', source: 'Clydeshore ASP procedures' },
    { id: 'cp.ird-record', label: 'IRD record', process: 'cp', version: '2023.1', effectiveFrom: '2023-09-01', source: 'National Guidance for Child Protection 2021 (updated 2023)' },
    { id: 'cp.cppm-minute', label: 'CPPM minute', process: 'cp', version: '2023.1', effectiveFrom: '2023-09-01', source: 'National Guidance for Child Protection 2021 (updated 2023)' },
    { id: 'marac.referral', label: 'MARAC referral (DASH and DAQ)', process: 'marac', version: '2024.1', effectiveFrom: '2024-01-01', source: 'SafeLives Scotland; Police Scotland DAQ' },
    { id: 'mappa.referral', label: 'MAPPA referral', process: 'mappa', version: '2022.1', effectiveFrom: '2022-03-31', source: 'MAPPA National Guidance 2022' },
    { id: 'mappa.rmp', label: 'Risk Management Plan', process: 'mappa', version: '2022.1', effectiveFrom: '2022-03-31', source: 'MAPPA National Guidance 2022; RMA FRAME standards' },
    { id: 'awi.capacity-assessment', label: 'Capacity assessment', process: 'awi', version: '2020.1', effectiveFrom: '2020-01-01', source: 'AWI Code of Practice' },
    { id: 'awi.mho-report', label: 'MHO report (s57(3))', process: 'awi', version: '2020.1', effectiveFrom: '2020-01-01', source: 'AWI (Scotland) Act 2000 s57' },
  ],
  defaults: { theme: 'system', density: 'comfortable' },
  aspCouncilOfficerEligibility: [
    'Registered as a social worker, or as a social service worker in the relevant part of the SSSC register, with at least 12 months relevant experience of identifying, assessing and managing adults at risk of harm (functions under sections 7 to 10)',
    'Registered as an occupational therapist in the HCPC register (Health Professions Order 2001, article 5(1)), with at least 12 months relevant experience',
    'Registered nurse, with at least 12 months relevant experience',
    'For the functions under sections 11, 14, 16 and 18 (records, visits under warrant, assessment and removal orders): a registered social worker, occupational therapist or nurse with at least 12 months relevant experience',
    'Source: the Adult Support and Protection (Scotland) Act 2007 (Restriction on the Authorisation of Council Officers) Order 2008 (SSI 2008/306), in force 29 October 2008; wording to verify against the Order and any later amendment',
  ],
  bankHolidays: BANK_HOLIDAYS_2026_2027,
  /** Clydeshore local holidays (fictional): a spring and a September Monday, as Ayrshire councils commonly take. Editable in Admin. */
  councilHolidays: ['2026-04-13', '2026-09-21', '2027-04-12', '2027-09-20'],
  breakGlassHours: 4,
  breakGlassReasons: ['Immediate risk to a child', 'Immediate risk to an adult', 'Court, hearing or panel deadline today', 'Request from the coordinator or chair', 'Other (state why)'],
  guidanceEditions: [
    { id: 'asp-cop', label: 'ASP Code of Practice', edition: 'July 2022' },
    { id: 'cp-national', label: 'National Guidance for Child Protection in Scotland', edition: '2021, updated 2023' },
    { id: 'mappa-national', label: 'MAPPA National Guidance', edition: '2022 refresh (31 March 2022, errata April 2022)' },
    { id: 'chronologies', label: 'Care Inspectorate Practice Guide to Chronologies', edition: '2017' },
    { id: 'marac', label: 'Clydeshore MARAC Operating Protocol', edition: '2025 (local)' },
    { id: 'awi-cop', label: 'AWI Codes of Practice', edition: 'Current editions' },
  ],
};
