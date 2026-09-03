import { z } from 'zod';
import { MARAC_MUST_NOT_RECEIVE_PARTIES, mustNotReceiveListSchema } from './must-not-receive';

/**
 * Domestic abuse risk questions. The SafeLives DASH checklist has 24 questions; the Police Scotland
 * DAQ adds three child-focused questions (27). The wording here is a plain-language paraphrase for the
 * mockup, not the published instruments. Fourteen or more "yes" answers indicates high risk; professional
 * judgement can refer below that threshold. Form version marac.referral 2024.1.
 */
export const DASH_QUESTIONS: Array<{ id: string; text: string }> = [
  { id: 'q1', text: 'Has the current incident resulted in injury?' },
  { id: 'q2', text: 'Are you very frightened?' },
  { id: 'q3', text: 'What are you afraid of? Is it further injury or violence?' },
  { id: 'q4', text: 'Do you feel isolated from family or friends?' },
  { id: 'q5', text: 'Are you feeling depressed or having suicidal thoughts?' },
  { id: 'q6', text: 'Have you separated or tried to separate in the past year?' },
  { id: 'q7', text: 'Is there conflict over child contact?' },
  { id: 'q8', text: 'Does the person constantly text, call, contact, follow, stalk or harass you?' },
  { id: 'q9', text: 'Are you pregnant or have you recently had a baby?' },
  { id: 'q10', text: 'Is the abuse happening more often?' },
  { id: 'q11', text: 'Is the abuse getting worse?' },
  { id: 'q12', text: 'Does the person try to control everything you do or are they excessively jealous?' },
  { id: 'q13', text: 'Has the person ever used weapons or objects to hurt you?' },
  { id: 'q14', text: 'Has the person ever threatened to kill you or someone else and you believed them?' },
  { id: 'q15', text: 'Has the person ever attempted to strangle, choke, suffocate or drown you?' },
  { id: 'q16', text: 'Does the person do or say things of a sexual nature that make you feel bad or physically hurt you?' },
  { id: 'q17', text: 'Is there any other person who has threatened you or who you are afraid of?' },
  { id: 'q18', text: 'Do you know if the person has hurt anyone else?' },
  { id: 'q19', text: 'Has the person ever mistreated an animal or the family pet?' },
  { id: 'q20', text: 'Are there any financial issues, for example are you dependent on the person for money?' },
  { id: 'q21', text: 'Has the person had problems in the past year with drugs, alcohol or mental health?' },
  { id: 'q22', text: 'Has the person ever threatened or attempted suicide?' },
  { id: 'q23', text: 'Has the person ever breached bail or an injunction, or formal agreements about contact?' },
  { id: 'q24', text: 'Do you know if the person has ever been in trouble with the police or has a criminal history?' },
];

export const DAQ_CHILD_QUESTIONS: Array<{ id: string; text: string }> = [
  { id: 'q25', text: 'Were any children present during, or exposed to, the incident?' },
  { id: 'q26', text: 'Has the person ever threatened to hurt the children or to take them away?' },
  { id: 'q27', text: 'Are there concerns about the children\'s safety or wellbeing arising from the abuse?' },
];

export const DAQ_QUESTIONS = [...DASH_QUESTIONS, ...DAQ_CHILD_QUESTIONS];
export const HIGH_RISK_THRESHOLD = 14;

export const daqFormSchema = z
  .object({
    tool: z.enum(['dash', 'daq']),
    assessedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date'),
    answers: z.record(z.string(), z.enum(['yes', 'no', 'unknown'])),
    professionalJudgement: z.string().max(1200).optional(),
    referBelowThreshold: z.boolean().optional(),
    /** Anyone else who must not receive information about this case; each entry feeds the case-role register. */
    mustNotReceive: mustNotReceiveListSchema(MARAC_MUST_NOT_RECEIVE_PARTIES),
  })
  .superRefine((v, ctx) => {
    const expected = v.tool === 'daq' ? DAQ_QUESTIONS : DASH_QUESTIONS;
    for (const q of expected) if (!v.answers[q.id]) ctx.addIssue({ code: 'custom', path: ['answers', q.id], message: 'Answer every question' });
    const yes = expected.filter((q) => v.answers[q.id] === 'yes').length;
    if (yes < HIGH_RISK_THRESHOLD && v.referBelowThreshold && !v.professionalJudgement?.trim()) ctx.addIssue({ code: 'custom', path: ['professionalJudgement'], message: 'A referral below 14 yes answers needs your professional judgement' });
  })
  .transform((v) => {
    const expected = v.tool === 'daq' ? DAQ_QUESTIONS : DASH_QUESTIONS;
    const score = expected.filter((q) => v.answers[q.id] === 'yes').length;
    return { ...v, score, maxScore: expected.length, highRisk: score >= HIGH_RISK_THRESHOLD, refer: score >= HIGH_RISK_THRESHOLD || Boolean(v.referBelowThreshold) };
  });

export type DaqForm = z.input<typeof daqFormSchema>;
export type DaqResult = z.output<typeof daqFormSchema>;
