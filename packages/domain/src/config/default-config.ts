import { CLOCK_RULES } from '../clocks/rules';
import { EXCLUSIONS } from '../need-to-know/exclusions';
import { NEED_TO_KNOW_ROWS } from '../need-to-know/resolve';
import type { Config } from '../schemas/config';
import { DEFAULT_LABELS } from './labels';

/**
 * Scottish bank holidays used by working-day clocks.
 * TODO(verify): confirm against the Scottish Government published list each year. Admin can edit.
 */
export const BANK_HOLIDAYS_2026_2027: string[] = [
  '2026-01-01',
  '2026-01-02',
  '2026-04-03',
  '2026-05-04',
  '2026-05-25',
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
    'Registered social worker with the required post-qualifying experience',
    'Registered nurse with the required post-qualifying experience and ASP training',
    'Registered occupational therapist with the required post-qualifying experience and ASP training',
  ],
  bankHolidays: BANK_HOLIDAYS_2026_2027,
  breakGlassHours: 4,
  guidanceEditions: [
    { id: 'asp-cop', label: 'ASP Code of Practice', edition: 'July 2022' },
    { id: 'cp-national', label: 'National Guidance for Child Protection in Scotland', edition: '2021, updated 2023' },
    { id: 'mappa-national', label: 'MAPPA National Guidance', edition: '2022 refresh (31 March 2022, errata April 2022)' },
    { id: 'chronologies', label: 'Care Inspectorate Practice Guide to Chronologies', edition: '2017' },
    { id: 'marac', label: 'Clydeshore MARAC Operating Protocol', edition: '2025 (local)' },
    { id: 'awi-cop', label: 'AWI Codes of Practice', edition: 'Current editions' },
  ],
};
