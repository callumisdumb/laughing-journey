import type { MeetingType } from '../enums';
import type { ClockTrigger } from '../schemas/process';

/**
 * What holding a meeting does to the statutory clocks: which running clocks it completes and
 * which new clocks it starts. Configuration, not code paths, so a local area can change it.
 */
export interface MeetingTransition {
  completes: string[];
  starts: string[];
}

export const MEETING_TRANSITIONS: Record<MeetingType, MeetingTransition> = {
  ird: { completes: [], starts: ['cp.cppm.initial'] },
  cppm: { completes: ['cp.cppm.initial', 'cp.prebirth.cppm'], starts: ['cp.coregroup.first', 'cp.cppm.review.first'] },
  'pre-birth-cppm': { completes: ['cp.prebirth.cppm', 'cp.cppm.initial'], starts: ['cp.coregroup.first', 'cp.cppm.review.first'] },
  'cppm-review': { completes: ['cp.cppm.review.first', 'cp.cppm.review.subsequent'], starts: ['cp.cppm.review.subsequent'] },
  'core-group': { completes: ['cp.coregroup.first'], starts: [] },
  'asp-inter-agency-discussion': { completes: ['asp.inquiry.decision'], starts: [] },
  'asp-case-conference': { completes: ['asp.caseconference.initial'], starts: ['asp.plan.review'] },
  'asp-review-conference': { completes: ['asp.plan.review'], starts: ['asp.plan.review'] },
  'lsi-planning': { completes: [], starts: [] },
  marac: { completes: ['marac.research.return'], starts: ['marac.flag.expiry', 'marac.repeat.window'] },
  'mappa-level2': { completes: ['mappa.level2.review'], starts: ['mappa.level2.review'] },
  'mappa-level3': { completes: ['mappa.level3.review'], starts: ['mappa.level3.review'] },
  'awi-mdt': { completes: [], starts: [] },
};

export interface TransitionResult {
  clocks: ClockTrigger[];
  completed: string[];
  started: string[];
}

/** Apply the transition for a meeting held at `heldAt` to a process's clock triggers. Pure. */
export function applyMeetingTransition(clocks: ClockTrigger[], meetingType: MeetingType, heldAt: string, newId: (prefix: string) => string, transitions: Record<MeetingType, MeetingTransition> = MEETING_TRANSITIONS): TransitionResult {
  const t = transitions[meetingType];
  const completed: string[] = [];
  const next = clocks.map((c) => {
    if (!c.completedAt && t.completes.includes(c.ruleId)) {
      completed.push(c.ruleId);
      return { ...c, completedAt: heldAt, note: `${c.note ? `${c.note}. ` : ''}Completed by ${meetingType} on ${heldAt.slice(0, 10)}` };
    }
    return c;
  });
  const started: string[] = [];
  for (const ruleId of t.starts) {
    if (next.some((c) => c.ruleId === ruleId && !c.completedAt)) continue;
    next.push({ id: newId('clk'), ruleId, triggeredAt: heldAt, note: `Started by ${meetingType}` });
    started.push(ruleId);
  }
  return { clocks: next, completed, started };
}
