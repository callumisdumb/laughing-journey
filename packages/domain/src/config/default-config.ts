import { CLOCK_RULES } from '../clocks/rules';
import bankHolidayFeed from './bank-holidays.json';
import { EXCLUSIONS } from '../need-to-know/exclusions';
import { NEED_TO_KNOW_ROWS } from '../need-to-know/resolve';
import type { Config } from '../schemas/config';

/**
 * Scottish bank holidays used by working-day clocks.
 * TODO(verify): confirm against the Scottish Government published list each year. Admin can edit.
 */
/**
 * Scottish bank holidays from the gov.uk bank holidays feed (https://www.gov.uk/bank-holidays.json),
 * committed as a fixture (bank-holidays.json, "scotland" division only) and refreshed with
 * `pnpm holidays:sync`. Verified against the feed on 03 Sep 2026, including the one-off 15 June 2026.
 */
export const BANK_HOLIDAYS: string[] = bankHolidayFeed.scotland.events.map((e) => e.date);
/** @deprecated use BANK_HOLIDAYS */
export const BANK_HOLIDAYS_2026_2027 = BANK_HOLIDAYS;

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
  clockRules: CLOCK_RULES,
  needToKnow: NEED_TO_KNOW_ROWS,
  exclusions: EXCLUSIONS,
  classificationMarkings: [
    { id: 'official', handling: 'Routine business information. No marking is required.', instructions: [] },
    { id: 'official-sensitive', handling: 'Personal and case information. Share on a need-to-know basis with a recorded lawful basis.', instructions: ['do-not-forward'] },
    {
      id: 'access-restricted',
      handling: 'MAPPA and other records on a distribution list. Every read is audited. Break-glass requires a reason.',
      instructions: ['distribution-list-only', 'chair-approval-required', 'not-for-subject-access'],
    },
  ],
  // The Caldicott Guardian, the MAPPA co-ordinator and the CSWO. A practitioner cannot talk a
  // derived classification down; the whole point of deriving it is that the decision is visible.
  classificationLowerableBy: ['caldicott-guardian', 'mappa-coordinator', 'cswo'],
  // Seeded from the roles that in this product only ever receive presence-level information: they
  // sit outside the statutory partnership, or outside its secure channels. TODO(verify) against the
  // partnership's information sharing agreement.
  officialSensitiveWithheldFrom: ['independent-advocate', 'fire-safety-officer', 'housing-officer'],
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
  bankHolidays: BANK_HOLIDAYS,
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
