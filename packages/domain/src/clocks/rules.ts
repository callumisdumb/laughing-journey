import { tKey } from '@mas/messages';
import { keySegment } from '../enums';
import type { ClockRule } from '../schemas/config';

/**
 * Statutory and local clock rules. Values come from docs/RESEARCH.md. The name, trigger and
 * plain-language description of each rule live in the message catalogue under `domain.clockRules`
 * and are read by id; `source`, `sourceRef`, `confidence`, `localNote` and `todoVerify` stay here as
 * citations and configuration.
 * Rules marked `todoVerify` were seeded from search extracts or local procedures
 * rather than read in the primary source; Admin shows their confidence.
 */
/** A rule without the catalogue-backed text. */
export type ClockRuleData = Omit<ClockRule, 'label' | 'trigger'>;

const RULES: ClockRuleData[] = [
  {
    id: 'cp.cppm.initial',
    process: 'cp',
    unit: 'calendar-days',
    amount: 28,
    kind: 'deadline',
    warnDays: 7,
    source: 'National Guidance for Child Protection in Scotland 2021 (updated 2023), Part 3',
    sourceRef: 'Within 28 calendar days following a child protection investigation (Appendix D). The "concern being raised" framing belongs to the unborn baby row',
    confidence: 'high',
  },
  {
    id: 'cp.coregroup.first',
    process: 'cp',
    unit: 'working-days',
    amount: 15,
    kind: 'deadline',
    warnDays: 5,
    source: 'National Guidance for Child Protection in Scotland 2021, Appendix D',
    sourceRef: 'Within 15 working days of the CPPM (Appendix D, read live 03 Sep 2026)',
    confidence: 'high',
  },
  {
    id: 'cp.cppm.review.first',
    process: 'cp',
    unit: 'months',
    amount: 6,
    kind: 'review',
    warnDays: 21,
    source: 'National Guidance for Child Protection in Scotland 2021, Appendix D',
    sourceRef: 'Within 6 months of the initial CPPM (Appendix D). A review may be brought forward on significant change without altering the statutory maximum',
    confidence: 'high',
  },
  {
    id: 'cp.cppm.review.subsequent',
    process: 'cp',
    unit: 'months',
    amount: 6,
    kind: 'review',
    warnDays: 21,
    source: 'National Guidance for Child Protection in Scotland 2021, Appendix D',
    sourceRef: 'At least every 6 months, or earlier on significant change',
    confidence: 'high',
  },
  {
    id: 'cp.cppm.notice',
    process: 'cp',
    unit: 'calendar-days',
    amount: 5,
    direction: 'before',
    kind: 'deadline',
    warnDays: 2,
    source: 'National Guidance for Child Protection in Scotland 2021, Appendix D',
    sourceRef: 'Invitations, reports and notice to the family no later than 5 calendar days before the CPPM (Appendix D, read live 03 Sep 2026)',
    confidence: 'high',
  },
  {
    id: 'cp.coregroup.escalate',
    process: 'cp',
    unit: 'calendar-days',
    amount: 3,
    kind: 'deadline',
    warnDays: 1,
    source: 'National Guidance for Child Protection in Scotland 2021, Appendix D',
    sourceRef: 'Escalation to the lead professional and the CPPM chair within 3 calendar days (Appendix D, read live 03 Sep 2026)',
    confidence: 'high',
  },
  {
    id: 'cp.prebirth.review',
    process: 'cp',
    unit: 'months',
    amount: 3,
    kind: 'review',
    warnDays: 21,
    source: 'National Guidance for Child Protection in Scotland 2021, Appendix D',
    sourceRef: 'Review within 3 months of the pre-birth CPPM (Appendix D, read live 03 Sep 2026). After the birth the review may be deferred on professional judgement, with the reason recorded',
    confidence: 'high',
    deferrable: true,
    deferralNote: 'After the birth, professional judgement may defer this review; record the reason as a due date override',
  },
  {
    id: 'cp.cppm.inquorate.reconvene',
    process: 'cp',
    unit: 'working-days',
    amount: 10,
    kind: 'deadline',
    warnDays: 3,
    source: 'National Guidance for Child Protection in Scotland 2021, Appendix D',
    sourceRef: 'An inquorate CPPM is reconvened within 10 working days (Appendix D, read live 03 Sep 2026)',
    confidence: 'high',
  },
  {
    id: 'cp.cppm.record.distribute',
    process: 'cp',
    unit: 'working-days',
    amount: 10,
    kind: 'deadline',
    warnDays: 3,
    source: 'National Guidance for Child Protection in Scotland 2021, Appendix D',
    sourceRef: 'The record of the CPPM is distributed within 10 working days (Appendix D, read live 03 Sep 2026)',
    confidence: 'high',
  },
  {
    id: 'cp.prebirth.cppm',
    process: 'cp',
    unit: 'calendar-days',
    amount: 28,
    kind: 'deadline',
    warnDays: 7,
    source: 'National Guidance for Child Protection in Scotland 2021, Part 4 (unborn babies)',
    sourceRef: 'Within 28 calendar days of the concern and no later than 28 weeks gestation. The gestation cap is applied as a due date override on the process',
    confidence: 'high',
  },
  {
    id: 'asp.inquiry.decision',
    process: 'asp',
    unit: 'working-days',
    amount: 5,
    kind: 'deadline',
    warnDays: 2,
    source: 'Local procedures (the Code of Practice 2022 sets no national timescale)',
    sourceRef: 'West of Scotland inter-agency guidance and Edinburgh 2024 procedures use 5 working days',
    confidence: 'local',
    localNote: 'Clydeshore ASP procedures: 5 working days',
    todoVerify: true,
  },
  {
    id: 'asp.caseconference.initial',
    process: 'asp',
    unit: 'calendar-days',
    amount: 21,
    kind: 'deadline',
    warnDays: 7,
    source: 'Local procedures (the Code of Practice 2022 sets no national timescale)',
    sourceRef: 'Highland 21 days; Orkney 20 days; Renfrewshire 20 working days',
    confidence: 'local',
    localNote: 'Clydeshore ASP procedures: 21 calendar days',
    todoVerify: true,
  },
  {
    /**
     * The four quarterly submission deadlines for the ASP National Minimum Dataset. The workbook's
     * own notes give a worked example against "August 12th, the Scottish Government submission date
     * for returns", and say the current deadlines live on the ASP data collection web page rather
     * than in the workbook, so these dates are configuration seeded from the product owner and
     * marked to verify against that page each year.
     *
     * The clock runs from the last day of the quarter, so Q1 (1 April to 30 June) is due 45 calendar
     * days later. That is the shape the deadline takes, not a rule stated anywhere: the published
     * dates are absolute, and an area that finds them moved edits them in Admin.
     */
    id: 'asp.nmds.q1',
    process: 'asp',
    unit: 'calendar-days',
    amount: 45,
    kind: 'deadline',
    warnDays: 14,
    source: 'ASP National Minimum Dataset single guidance document, July 2025; ASP data collection web page',
    sourceRef: 'Actions can be tracked up to the submission date you have been provided with for each quarterly data return. If 100 inquiries were begun in Quarter 1 (1 April - 30 June inclusive) we ask you to record what actions were taken, tracking these up to August 12th, the Scottish Government submission date for returns. Deadline seeded as 14 Aug 2026 for Q1 2026/27',
    confidence: 'verify',
    todoVerify: true,
    localNote: 'Confirm the four 2026-27 submission dates against the ASP data collection web page, which the guidance names as the source rather than printing them.',
  },
  {
    id: 'asp.nmds.q2',
    process: 'asp',
    unit: 'calendar-days',
    amount: 44,
    kind: 'deadline',
    warnDays: 14,
    source: 'ASP National Minimum Dataset single guidance document, July 2025; ASP data collection web page',
    sourceRef: 'Q2 2026/27 covers 1 July to 30 September; deadline seeded as 13 Nov 2026',
    confidence: 'verify',
    todoVerify: true,
    localNote: 'Confirm against the ASP data collection web page.',
  },
  {
    id: 'asp.nmds.q3',
    process: 'asp',
    unit: 'calendar-days',
    amount: 43,
    kind: 'deadline',
    warnDays: 14,
    source: 'ASP National Minimum Dataset single guidance document, July 2025; ASP data collection web page',
    sourceRef: 'Q3 2026/27 covers 1 October to 31 December; deadline seeded as 12 Feb 2027',
    confidence: 'verify',
    todoVerify: true,
    localNote: 'Confirm against the ASP data collection web page.',
  },
  {
    id: 'asp.nmds.q4',
    process: 'asp',
    unit: 'calendar-days',
    amount: 44,
    kind: 'deadline',
    warnDays: 14,
    source: 'ASP National Minimum Dataset single guidance document, July 2025; ASP data collection web page',
    sourceRef: 'Q4 2026/27 covers 1 January to 31 March; deadline seeded as 14 May 2027',
    confidence: 'verify',
    todoVerify: true,
    localNote: 'Confirm against the ASP data collection web page.',
  },
  {
    // The three ASP protection orders and their statutory durations, from the NMDS Annex 2 glossary
    // (which restates the 2007 Act and the July 2022 Code of Practice). Applications are made by
    // the council, except a banning order, which the adult or another person entitled to occupy the
    // place may also apply for; an order may be applied for at any point in the process.
    id: 'asp.order.banning.maximum',
    process: 'asp',
    unit: 'months',
    amount: 6,
    kind: 'deadline',
    warnDays: 14,
    source: 'Adult Support and Protection (Scotland) Act 2007; ASP National Minimum Dataset 2024-25 Annex 2 glossary',
    sourceRef: 'A banning or temporary banning order may last a period not exceeding 6 months. Serious harm must be evidenced. In urgency the council may apply to a justice of the peace rather than a sheriff',
    confidence: 'high',
  },
  {
    id: 'asp.order.assessment.validity',
    process: 'asp',
    unit: 'calendar-days',
    amount: 7,
    kind: 'deadline',
    warnDays: 2,
    source: 'Adult Support and Protection (Scotland) Act 2007; ASP National Minimum Dataset 2024-25 Annex 2 glossary',
    sourceRef: 'An assessment order is valid for 7 days',
    confidence: 'high',
  },
  {
    id: 'asp.order.removal.validity',
    process: 'asp',
    unit: 'calendar-days',
    amount: 7,
    kind: 'deadline',
    warnDays: 2,
    source: 'Adult Support and Protection (Scotland) Act 2007; ASP National Minimum Dataset 2024-25 Annex 2 glossary',
    sourceRef: 'A removal order lasts a maximum of 7 days after the day the person is removed',
    confidence: 'high',
  },
  {
    id: 'asp.order.removal.executeBy',
    process: 'asp',
    unit: 'hours',
    amount: 72,
    kind: 'deadline',
    warnDays: 1,
    source: 'Adult Support and Protection (Scotland) Act 2007; ASP National Minimum Dataset 2024-25 Annex 2 glossary',
    sourceRef: 'The removal must take place within 72 hours of the order being granted',
    confidence: 'high',
  },
  {
    id: 'asp.plan.review',
    process: 'asp',
    unit: 'months',
    amount: 3,
    kind: 'review',
    warnDays: 14,
    source: 'Local procedures',
    sourceRef: 'South Lanarkshire and Dumfries and Galloway review at 3 months then three monthly',
    confidence: 'local',
    todoVerify: true,
  },
  {
    id: 'marac.research.return',
    process: 'marac',
    unit: 'working-days',
    amount: 5,
    kind: 'deadline',
    warnDays: 2,
    source: 'Local MARAC Operating Protocol (SafeLives sets no national deadline)',
    sourceRef: 'SafeLives: case list circulated about 8 working days before the meeting; the return window is local',
    confidence: 'local',
    localNote: 'Clydeshore MARAC Operating Protocol: returns 5 working days before the meeting',
    todoVerify: true,
  },
  {
    id: 'marac.flag.expiry',
    process: 'marac',
    unit: 'months',
    amount: 12,
    kind: 'expiry',
    warnDays: 30,
    source: 'SafeLives MARAC practice',
    sourceRef: 'Flag on agency records for 12 months from the last referral',
    confidence: 'high',
  },
  {
    id: 'marac.repeat.window',
    process: 'marac',
    unit: 'months',
    amount: 12,
    kind: 'expiry',
    warnDays: 0,
    source: 'SafeLives MARAC definitions',
    sourceRef: 'A repeat is a further referral within 12 months of the last referral',
    confidence: 'high',
  },
  {
    id: 'mappa.level2.review',
    process: 'mappa',
    unit: 'weeks',
    amount: 12,
    kind: 'review',
    warnDays: 14,
    source: 'MAPPA National Guidance 2022 (refreshed 31 March 2022)',
    sourceRef: 'Level 2 cases reviewed no less than once every 12 weeks',
    confidence: 'high',
  },
  {
    id: 'mappa.level3.review',
    process: 'mappa',
    unit: 'weeks',
    amount: 6,
    kind: 'review',
    warnDays: 10,
    source: 'MAPPA National Guidance 2022 (refreshed 31 March 2022)',
    sourceRef: 'Level 3 cases reviewed no less than once every 6 weeks',
    confidence: 'high',
  },
  {
    id: 'awi.mho.report',
    process: 'awi',
    unit: 'calendar-days',
    amount: 21,
    kind: 'deadline',
    warnDays: 7,
    source: 'Adults with Incapacity (Scotland) Act 2000 s57(4)',
    sourceRef: 'Report within 21 days of the date of notice',
    confidence: 'high',
  },
  {
    id: 'awi.interim.warning',
    process: 'awi',
    unit: 'months',
    amount: 3,
    kind: 'warning',
    warnDays: 14,
    source: 'Adults with Incapacity (Scotland) Act 2000 s57 as amended by ASP Act 2007 s60',
    sourceRef: 'Interim orders run for 3 months by default and cannot exceed 6 months in total (s57). Adults with Incapacity Reform: Expert Working Group minutes, April 2026 (gov.scot, published June 2026) record the concern about prolonged interim orders',
    confidence: 'high',
  },
  {
    id: 'awi.interim.maximum',
    process: 'awi',
    unit: 'months',
    amount: 6,
    kind: 'expiry',
    warnDays: 21,
    source: 'Adults with Incapacity (Scotland) Act 2000 s57 as amended',
    sourceRef: 'Total interim period cannot exceed 6 months',
    confidence: 'high',
  },
];

/** Clock name, read from the catalogue at call time. */
export function clockRuleLabel(id: string): string {
  return tKey(`domain.clockRules.${keySegment(id)}.label`);
}

/** What starts the clock, read from the catalogue at call time. */
export function clockRuleTrigger(id: string): string {
  return tKey(`domain.clockRules.${keySegment(id)}.trigger`);
}

/** Plain-language description of the rule for Help and Admin, read from the catalogue at call time. */
export function clockRuleDescription(id: string): string {
  return tKey(`domain.clockRules.${keySegment(id)}.description`);
}

export const CLOCK_RULES: ClockRule[] = RULES;

export function findClockRule(rules: ClockRule[], id: string): ClockRule | undefined {
  return rules.find((r) => r.id === id);
}
