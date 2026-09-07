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
     * The four quarterly NMDS submission deadlines for 2026-27.
     *
     * The guidance does not print them: its worked example names "August 12th" for Q1 and says the
     * current dates live on the ASP data collection web page. That page (iriss.org.uk/aspdataset,
     * "Quarterly data return dates for 2026/27", read live on 06 Sep 2026) gives 14.08.26, 13.11.26,
     * 12.02.27 and 14.05.27, with anticipated reporting to Adult Protection Committees in February
     * 2027 after Q2 and August 2027 after Q4, and returns go to ASPData@gov.scot (docs/RESEARCH.md
     * 9.1). The page also says an update to the guidance document is pending for summer 2026, so
     * the dates and the guidance edition are checked against it each year.
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
    source: 'ASP data collection web page (iriss.org.uk/aspdataset), Quarterly data return dates for 2026/27, read live 06 Sep 2026',
    sourceRef: 'Quarter 1: data collection period 01.04.26 to 30.06.26 inclusive, return deadline 14.08.26, anticipated reporting to APCs not applicable',
    confidence: 'high',
  },
  {
    id: 'asp.nmds.q2',
    process: 'asp',
    unit: 'calendar-days',
    amount: 44,
    kind: 'deadline',
    warnDays: 14,
    source: 'ASP data collection web page (iriss.org.uk/aspdataset), Quarterly data return dates for 2026/27, read live 06 Sep 2026',
    sourceRef: 'Quarter 2: data collection period 01.07.26 to 30.09.26 inclusive, return deadline 13.11.26, anticipated reporting to APCs February 2027',
    confidence: 'high',
  },
  {
    id: 'asp.nmds.q3',
    process: 'asp',
    unit: 'calendar-days',
    amount: 43,
    kind: 'deadline',
    warnDays: 14,
    source: 'ASP data collection web page (iriss.org.uk/aspdataset), Quarterly data return dates for 2026/27, read live 06 Sep 2026',
    sourceRef: 'Quarter 3: data collection period 01.10.26 to 31.12.26 inclusive, return deadline 12.02.27, anticipated reporting to APCs not applicable',
    confidence: 'high',
  },
  {
    id: 'asp.nmds.q4',
    process: 'asp',
    unit: 'calendar-days',
    amount: 44,
    kind: 'deadline',
    warnDays: 14,
    source: 'ASP data collection web page (iriss.org.uk/aspdataset), Quarterly data return dates for 2026/27, read live 06 Sep 2026',
    sourceRef: 'Quarter 4: data collection period 01.01.27 to 31.03.27 inclusive, return deadline 14.05.27, anticipated reporting to APCs August 2027',
    confidence: 'high',
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
    /**
     * Level 1 is managed by the lead responsible authority without a meeting, which is why the
     * national guidance sets no interval for it: it names review intervals for levels 2 and 3 and
     * leaves level 1 to local arrangements. A case that never meets and never counts down is a case
     * nobody looks at again, so the product carries a local interval and marks it as local (D-251).
     * TODO(verify): the Clydeshore equivalent's own MAPPA operating procedures set this figure.
     */
    id: 'mappa.level1.review',
    process: 'mappa',
    unit: 'months',
    amount: 12,
    kind: 'review',
    warnDays: 28,
    source: 'Local: no national interval exists for level 1, which the MAPPA National Guidance 2022 leaves to local arrangements',
    sourceRef: 'Seeded at 12 months as the interval a partnership would recognise; confirm against the area procedures (docs/RESEARCH.md 9.4)',
    confidence: 'local',
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
    /**
     * An order with an expiry runs out on it, and an adult whose guardianship lapses has no
     * guardian: the renewal application has to be made before that day, not discovered after it.
     * The rule is the order's own date rather than an interval, so it is triggered with the expiry
     * as its instant and counted back from, so the clock is due 90 days before the order runs out.
     * Completed by a renewal or a recall (D-252).
     */
    id: 'awi.order.renewal.due',
    process: 'awi',
    unit: 'calendar-days',
    amount: 90,
    direction: 'before',
    kind: 'deadline',
    warnDays: 30,
    source: 'Adults with Incapacity (Scotland) Act 2000 s58 and s60: an order runs for the period the sheriff specifies',
    sourceRef: 'The expiry is the order\'s own. The 90 day lead time is the product\'s, so a renewal is prepared rather than discovered late; confirm the area\'s own lead time (docs/RESEARCH.md 9.5)',
    confidence: 'local',
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
