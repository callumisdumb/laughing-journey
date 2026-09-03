import { describe, expect, it } from 'vitest';
import { capacityAssessmentFormSchema } from './capacity-assessment';
import { DAQ_QUESTIONS, DASH_QUESTIONS, daqFormSchema } from './daq';
import { mappaReferralFormSchema } from './mappa-referral';
import { threePointTestFormSchema } from './three-point-test';

describe('three-point test', () => {
  const limb = { met: 'yes' as const, reasoning: 'Twenty characters or more of reasoning here.' };
  it('is met only when all three limbs are met', () => {
    const base = { assessedAt: '2026-08-21', harmTypes: ['financial' as const], immediateSafety: 'No immediate danger; nephew not present.' };
    expect(threePointTestFormSchema.parse({ ...base, a: limb, b: limb, c: limb }).outcome).toBe('met');
    expect(threePointTestFormSchema.parse({ ...base, a: limb, b: limb, c: { ...limb, met: 'unclear' } }).outcome).toBe('unclear');
    expect(threePointTestFormSchema.parse({ ...base, a: { ...limb, met: 'no' }, b: limb, c: limb }).outcome).toBe('not-met');
  });
  it('requires reasoning per limb', () => {
    expect(threePointTestFormSchema.safeParse({ assessedAt: '2026-08-21', harmTypes: ['financial'], immediateSafety: 'Safe for now, nothing more.', a: { met: 'yes', reasoning: 'short' }, b: limb, c: limb }).success).toBe(false);
  });
});

describe('DASH and DAQ', () => {
  it('has 24 and 27 questions', () => {
    expect(DASH_QUESTIONS.length).toBe(24);
    expect(DAQ_QUESTIONS.length).toBe(27);
  });
  it('scores yes answers and flags high risk at 14', () => {
    const answers = Object.fromEntries(DAQ_QUESTIONS.map((q, i) => [q.id, i < 17 ? 'yes' : 'no']));
    const r = daqFormSchema.parse({ tool: 'daq', assessedAt: '2026-08-22', answers });
    expect(r.score).toBe(17);
    expect(r.maxScore).toBe(27);
    expect(r.highRisk).toBe(true);
    expect(r.refer).toBe(true);
  });
  it('requires every question and judgement for a referral below threshold', () => {
    const answers = Object.fromEntries(DASH_QUESTIONS.map((q, i) => [q.id, i < 5 ? 'yes' : 'no']));
    expect(daqFormSchema.safeParse({ tool: 'dash', assessedAt: '2026-08-22', answers: { q1: 'yes' } }).success).toBe(false);
    expect(daqFormSchema.safeParse({ tool: 'dash', assessedAt: '2026-08-22', answers, referBelowThreshold: true }).success).toBe(false);
    const ok = daqFormSchema.parse({ tool: 'dash', assessedAt: '2026-08-22', answers, referBelowThreshold: true, professionalJudgement: 'Escalating pattern despite the score.' });
    expect(ok.refer).toBe(true);
    expect(ok.highRisk).toBe(false);
  });
});

describe('MAPPA referral', () => {
  const base = { category: 1 as const, levelSought: 2 as const, leadResponsibleAuthority: 'police' as const, riskAssessmentIds: ['ra_1'], reason: 'Active multi-agency management is needed because of accommodation risk and a pending disclosure decision.', imminentRisk: false, victimConsiderations: 'Victim safety through VNS; exclusion zone.', accommodationIssue: true, disclosureConsidered: true, visorReference: 'ViSOR 2022/0451/Z' };
  it('accepts a Level 2 referral with a risk assessment', () => {
    expect(mappaReferralFormSchema.safeParse(base).success).toBe(true);
  });
  it('rejects a referral without a risk assessment', () => {
    expect(mappaReferralFormSchema.safeParse({ ...base, riskAssessmentIds: [] }).success).toBe(false);
  });
  it('requires imminent risk for Level 3', () => {
    expect(mappaReferralFormSchema.safeParse({ ...base, levelSought: 3 }).success).toBe(false);
    expect(mappaReferralFormSchema.safeParse({ ...base, levelSought: 3, imminentRisk: true }).success).toBe(true);
  });
});

describe('capacity assessment', () => {
  const base = { decision: 'Whether to move to residential care', assessedAt: '2026-08-04', assessorName: 'Dr Ruth Cameron', assessorRole: 'Consultant geriatrician', understands: 'yes' as const, retains: 'yes' as const, weighs: 'yes' as const, communicates: 'yes' as const, acts: 'yes' as const, evidence: 'Able to describe the options, the risks of going home and the alternatives, and to hold them over a conversation.', outcome: 'has-capacity' as const, wishesConsidered: 'Wants to go home to her own bed.' };
  it('accepts a consistent assessment', () => {
    expect(capacityAssessmentFormSchema.safeParse(base).success).toBe(true);
  });
  it('flags an inconsistent lacks-capacity outcome', () => {
    expect(capacityAssessmentFormSchema.safeParse({ ...base, outcome: 'lacks-capacity' }).success).toBe(false);
    expect(capacityAssessmentFormSchema.safeParse({ ...base, retains: 'no', outcome: 'lacks-capacity' }).success).toBe(true);
  });
});
