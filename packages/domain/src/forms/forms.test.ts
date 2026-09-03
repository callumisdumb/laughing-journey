import { describe, expect, it } from 'vitest';
import { exclusionPartyLabel } from '../enums';
import { casePartySchema, type CaseParty } from '../schemas/process';
import { capacityAssessmentFormSchema } from './capacity-assessment';
import { DAQ_QUESTIONS, DASH_QUESTIONS, daqFormSchema } from './daq';
import { mappaReferralFormSchema } from './mappa-referral';
import { casePartyFromMustNotReceive, mustNotReceiveEntrySchema, registerUpdateLabel, withMustNotReceive } from './must-not-receive';
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

describe('must not receive', () => {
  const entry = { name: '  Iain Docherty ', party: 'perpetrator-associates' as const, relationship: "perpetrator's brother", reason: 'Works in the housing office and would tell the perpetrator. ' };
  const daqBase = { tool: 'daq' as const, assessedAt: '2026-09-03', answers: Object.fromEntries(DAQ_QUESTIONS.map((q) => [q.id, 'no'])) };
  const mappaBase = { category: 1 as const, levelSought: 2 as const, leadResponsibleAuthority: 'police' as const, riskAssessmentIds: ['ra_1'], reason: 'Active multi-agency management is needed because of accommodation risk and a pending disclosure decision.', imminentRisk: false, victimConsiderations: 'Victim safety through VNS; exclusion zone.', accommodationIssue: true, disclosureConsidered: true, visorReference: 'ViSOR 2022/0451/Z' };

  it('is optional on both forms and defaults to an empty list', () => {
    expect(daqFormSchema.parse(daqBase).mustNotReceive).toEqual([]);
    expect(mappaReferralFormSchema.parse(mappaBase).mustNotReceive).toEqual([]);
  });
  it('trims the answer and limits the parties to those that make sense for the process', () => {
    const daq = daqFormSchema.parse({ ...daqBase, mustNotReceive: [entry] });
    expect(daq.mustNotReceive).toEqual([{ name: 'Iain Docherty', party: 'perpetrator-associates', relationship: "perpetrator's brother", reason: 'Works in the housing office and would tell the perpetrator.' }]);
    expect(daqFormSchema.safeParse({ ...daqBase, mustNotReceive: [{ ...entry, party: 'perpetrator' }] }).success).toBe(true);
    expect(daqFormSchema.safeParse({ ...daqBase, mustNotReceive: [{ ...entry, party: 'victim' }] }).success).toBe(false);
    for (const party of ['victim', 'employer', 'perpetrator-associates', 'public']) {
      expect(mappaReferralFormSchema.safeParse({ ...mappaBase, mustNotReceive: [{ ...entry, party }] }).success).toBe(true);
    }
    expect(mappaReferralFormSchema.safeParse({ ...mappaBase, mustNotReceive: [{ ...entry, party: 'alleged-perpetrator' }] }).success).toBe(false);
  });
  it('needs a name and a reason; the relationship is optional', () => {
    expect(mustNotReceiveEntrySchema.safeParse({ ...entry, name: ' A ' }).success).toBe(false);
    expect(mustNotReceiveEntrySchema.safeParse({ ...entry, reason: 'no' }).success).toBe(false);
    expect(mustNotReceiveEntrySchema.safeParse({ ...entry, relationship: undefined }).success).toBe(true);
    expect(mustNotReceiveEntrySchema.safeParse({ ...entry, relationship: '' }).success).toBe(true);
  });
  it('becomes a manual register entry keyed by the typed name', () => {
    const parsed = mustNotReceiveEntrySchema.parse(entry);
    const party = casePartyFromMustNotReceive(parsed, '2026-09-03', 'the DAQ');
    expect(party).toEqual({ name: 'Iain Docherty', party: 'perpetrator-associates', label: `${exclusionPartyLabel('perpetrator-associates')}: perpetrator's brother (named on the DAQ)`, since: '2026-09-03', source: 'manual', reason: 'Works in the housing office and would tell the perpetrator.' });
    expect(casePartySchema.safeParse(party).success).toBe(true);
    expect(casePartyFromMustNotReceive({ ...parsed, relationship: '' }, '2026-09-03', 'the MAPPA referral').label).toBe(`${exclusionPartyLabel('perpetrator-associates')} (named on the MAPPA referral)`);
  });
  it('merges into the register and replaces a name already recorded for the same party', () => {
    const parsed = mustNotReceiveEntrySchema.parse(entry);
    const existing: CaseParty[] = [
      { personId: 'per_perp', party: 'perpetrator', label: 'Perpetrator (named in the referral)', source: 'referral' },
      { name: 'iain docherty', party: 'perpetrator-associates', label: 'Earlier entry', source: 'manual', reason: 'Old reason' },
    ];
    const update = withMustNotReceive(existing, [parsed, { ...parsed, name: 'Morag Docherty', relationship: undefined }], '2026-09-03', 'the DAQ');
    expect(update.added).toBe(1);
    expect(update.updated).toBe(1);
    expect(update.parties).toHaveLength(3);
    expect(update.parties[1]).toMatchObject({ name: 'Iain Docherty', reason: 'Works in the housing office and would tell the perpetrator.' });
    expect(update.parties[2]).toMatchObject({ name: 'Morag Docherty', party: 'perpetrator-associates', source: 'manual' });
    expect(registerUpdateLabel(update, 'the DAQ')).toBe('Case-role register: 1 entry added, 1 entry updated from the DAQ');
    expect(registerUpdateLabel({ parties: [], added: 2, updated: 0 }, 'the DAQ')).toBe('Case-role register: 2 entries added from the DAQ');
    expect(withMustNotReceive(existing, [], '2026-09-03', 'the DAQ')).toEqual({ parties: existing, added: 0, updated: 0 });
  });
});
