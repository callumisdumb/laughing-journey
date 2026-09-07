import type { NeedToKnowRow } from '../schemas/config';

const LB_MARAC = 'Local MARAC Operating Protocol and information sharing agreement; UK GDPR 6(1)(e) and 9(2)(g) with DPA 2018 Sch 1 Pt 2 para 18; DPA 2018 s10 for offence data';
const RESEARCH_FIELDS = ['victim name and date of birth', 'perpetrator name and date of birth', 'children names and dates of birth'];

function research(id: string, agency: NeedToKnowRow['audience']['agency'], role: NeedToKnowRow['audience']['role'], label: string, condition?: string, conditionLabel?: string): NeedToKnowRow {
  return { id, process: 'marac', stage: 'research', audience: { agency, role, label }, detailLevel: 'fields', fields: RESEARCH_FIELDS, channel: 'in-app', trigger: 'Research request sent', condition, conditionLabel, lawfulBasisHint: LB_MARAC + '; names and dates of birth only, for record searching' };
}

export const MARAC_ROWS: NeedToKnowRow[] = [
  { id: 'marac.referral.coordinator', process: 'marac', stage: 'referral', audience: { agency: 'social-work', role: 'marac-coordinator', label: 'MARAC Coordinator' }, detailLevel: 'full', channel: 'in-app', trigger: 'Referral received', lawfulBasisHint: LB_MARAC },
  { id: 'marac.referral.idaa', process: 'marac', stage: 'referral', audience: { agency: 'third-sector', role: 'idaa', label: 'IDAA' }, detailLevel: 'full', channel: 'in-app', trigger: 'Referral received', lawfulBasisHint: LB_MARAC },
  { id: 'marac.referral.referrer', process: 'marac', stage: 'referral', audience: { agency: 'referrer', role: 'any', label: 'Referring agency' }, detailLevel: 'full', channel: 'in-app', trigger: 'Referral received', lawfulBasisHint: LB_MARAC },
  research('marac.research.police', 'police', 'domestic-abuse-officer', 'Police domestic abuse unit'),
  research('marac.research.csw', 'social-work', 'social-worker-children', "Children's social work"),
  research('marac.research.asw', 'social-work', 'social-worker-adults', 'Adult social work'),
  research('marac.research.jsw', 'social-work', 'justice-social-worker', 'Justice social work'),
  research('marac.research.gp', 'health', 'gp', 'Health (GP link)'),
  research('marac.research.hv', 'health', 'health-visitor', 'Health visiting'),
  research('marac.research.midwife', 'health', 'midwife', 'Midwifery', 'pregnant', 'If the victim is pregnant'),
  research('marac.research.mh', 'health', 'cmhn', 'Mental health'),
  research('marac.research.housing', 'housing', 'housing-officer', 'Housing'),
  research('marac.research.education', 'education', 'education-cp-lead', 'Education', 'children', 'If there are school-age children'),
  research('marac.research.wa', 'third-sector', 'womens-aid-worker', "Women's Aid"),
  research('marac.research.sps', 'sps', 'prison-social-worker', 'SPS (perpetrator in custody)', 'perpetratorInCustody', 'If the perpetrator is in custody'),
  { id: 'marac.actionplan.idaa', process: 'marac', stage: 'action-plan', audience: { agency: 'third-sector', role: 'idaa', label: 'IDAA (victim feedback)' }, detailLevel: 'full', channel: 'in-app', trigger: 'Action plan agreed', lawfulBasisHint: LB_MARAC },
  { id: 'marac.actionplan.csw', process: 'marac', stage: 'action-plan', audience: { agency: 'social-work', role: 'social-worker-children', label: "Children's social work (consider IRD)" }, detailLevel: 'summary', channel: 'in-app', trigger: 'Action plan agreed', condition: 'children', conditionLabel: 'If there are children', lawfulBasisHint: LB_MARAC + '; National Guidance for Child Protection 2021' },
  { id: 'marac.actionplan.mappa', process: 'marac', stage: 'action-plan', audience: { agency: 'social-work', role: 'mappa-coordinator', label: 'MAPPA Coordinator (perpetrator is MAPPA)' }, detailLevel: 'summary', channel: 'in-app', trigger: 'Action plan agreed', condition: 'perpetratorMappa', conditionLabel: 'If the perpetrator is managed under MAPPA', lawfulBasisHint: LB_MARAC + '; Management of Offenders etc. (Scotland) Act 2005 s10' },
  { id: 'marac.actionplan.matac', process: 'marac', stage: 'action-plan', audience: { agency: 'police', role: 'domestic-abuse-officer', label: 'MATAC (perpetrator focus)' }, detailLevel: 'summary', channel: 'in-app', trigger: 'Action plan agreed', condition: 'matacConsidered', conditionLabel: 'If MATAC is considered', lawfulBasisHint: LB_MARAC },
  { id: 'marac.actionplan.healthflag', process: 'marac', stage: 'action-plan', audience: { agency: 'health', role: 'gp', label: 'Health (MARAC flag)' }, detailLevel: 'fields', fields: ['MARAC flag', 'flag expiry (12 months)'], channel: 'connector-push', trigger: 'Case heard', lawfulBasisHint: LB_MARAC + '; flag only, no detail' },
  { id: 'marac.actionplan.housingflag', process: 'marac', stage: 'action-plan', audience: { agency: 'housing', role: 'housing-officer', label: 'Housing (MARAC flag)' }, detailLevel: 'fields', fields: ['MARAC flag', 'flag expiry (12 months)'], channel: 'connector-push', trigger: 'Case heard', lawfulBasisHint: LB_MARAC + '; flag only, no detail' },
  { id: 'marac.feedback.idaa', process: 'marac', stage: 'feedback', audience: { agency: 'third-sector', role: 'idaa', label: 'IDAA (victim feedback)' }, detailLevel: 'full', channel: 'in-app', trigger: 'Actions tracked', lawfulBasisHint: LB_MARAC },
  { id: 'marac.transfer.receiving', process: 'marac', stage: 'transferred', audience: { agency: 'social-work', role: 'marac-coordinator', label: 'Receiving MARAC Coordinator' }, detailLevel: 'full', channel: 'secure-email-digest', trigger: 'Transfer agreed', lawfulBasisHint: LB_MARAC },
];
