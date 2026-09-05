import { t, tKey } from '@mas/messages';
import { z } from 'zod';
import { MARAC_MUST_NOT_RECEIVE_PARTIES, mustNotReceiveListSchema } from './must-not-receive';

/**
 * Domestic abuse risk questions. The SafeLives DASH checklist has 24 questions; the Police Scotland
 * DAQ adds three child-focused questions (27). The question text is a plain-language paraphrase for the
 * mockup, not the published instruments, and lives in the catalogue under forms.daq.questions, one key
 * per id; daqQuestionText reads it. Fourteen or more "yes" answers indicates high risk; professional
 * judgement can refer below that threshold. Form version marac.referral 2024.1.
 */
const question = (id: string): { id: string } => ({ id });

export const DASH_QUESTIONS: Array<{ id: string }> = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11', 'q12', 'q13', 'q14', 'q15', 'q16', 'q17', 'q18', 'q19', 'q20', 'q21', 'q22', 'q23', 'q24'].map(question);

export const DAQ_CHILD_QUESTIONS: Array<{ id: string }> = ['q25', 'q26', 'q27'].map(question);

export const DAQ_QUESTIONS = [...DASH_QUESTIONS, ...DAQ_CHILD_QUESTIONS];
export const HIGH_RISK_THRESHOLD = 14;

/** The text of a DASH or DAQ question by id, from the catalogue. */
export function daqQuestionText(id: string): string {
  return tKey(`forms.daq.questions.${id}`);
}

export const daqFormSchema = z
  .object({
    tool: z.enum(['dash', 'daq']),
    assessedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: () => t('errors.forms.enterDate') }),
    answers: z.record(z.string(), z.enum(['yes', 'no', 'unknown'])),
    professionalJudgement: z.string().max(1200).optional(),
    referBelowThreshold: z.boolean().optional(),
    /** Anyone else who must not receive information about this case; each entry feeds the case-role register. */
    mustNotReceive: mustNotReceiveListSchema(MARAC_MUST_NOT_RECEIVE_PARTIES),
  })
  .superRefine((v, ctx) => {
    const expected = v.tool === 'daq' ? DAQ_QUESTIONS : DASH_QUESTIONS;
    for (const q of expected) if (!v.answers[q.id]) ctx.addIssue({ code: 'custom', path: ['answers', q.id], message: t('errors.daq.answerEvery') });
    const yes = expected.filter((q) => v.answers[q.id] === 'yes').length;
    if (yes < HIGH_RISK_THRESHOLD && v.referBelowThreshold && !v.professionalJudgement?.trim()) ctx.addIssue({ code: 'custom', path: ['professionalJudgement'], message: t('errors.daq.judgementBelowThreshold', { threshold: HIGH_RISK_THRESHOLD }) });
  })
  .transform((v) => {
    const expected = v.tool === 'daq' ? DAQ_QUESTIONS : DASH_QUESTIONS;
    const score = expected.filter((q) => v.answers[q.id] === 'yes').length;
    return { ...v, score, maxScore: expected.length, highRisk: score >= HIGH_RISK_THRESHOLD, refer: score >= HIGH_RISK_THRESHOLD || Boolean(v.referBelowThreshold) };
  });

export type DaqForm = z.input<typeof daqFormSchema>;
export type DaqResult = z.output<typeof daqFormSchema>;
