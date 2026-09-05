import type { MeetingType, ProcessType, Stage } from '../enums';
import { stageLabel } from '../config/labels';
import type { Process } from '../schemas/process';
import type { PermissionDecision } from './eligibility';
import { ASP_TRANSITIONS } from './stages/asp';
import { AWI_TRANSITIONS } from './stages/awi';
import { CP_TRANSITIONS } from './stages/cp';
import { MAPPA_TRANSITIONS } from './stages/mappa';
import { MARAC_TRANSITIONS } from './stages/marac';
import { canRecordTransition, transitionLabel, type AnyTransition, type MissingThing, type TransitionActor, type TransitionContext, type TransitionOutcome } from './stages/shared';

export * from './stages/shared';
export * from './stages/asp';
export * from './stages/cp';
export * from './stages/marac';
export * from './stages/mappa';
export * from './stages/awi';

/**
 * The stage engine's registry and the four questions a screen asks it (D-211).
 *
 * The tables under `./stages` say, per process type, which transitions exist, what each needs the
 * record to hold, who may record it and what it writes. This module answers: which transitions the
 * current stage carries, whether this person may record one, what stands in the way, and what the
 * record looks like after it. Nothing here writes; the store does that through the pipeline.
 */
export const TRANSITIONS: Record<ProcessType, readonly AnyTransition[]> = {
  asp: ASP_TRANSITIONS as unknown as AnyTransition[],
  cp: CP_TRANSITIONS as unknown as AnyTransition[],
  marac: MARAC_TRANSITIONS as unknown as AnyTransition[],
  mappa: MAPPA_TRANSITIONS as unknown as AnyTransition[],
  awi: AWI_TRANSITIONS as unknown as AnyTransition[],
};

export function transitionsFor(type: ProcessType): readonly AnyTransition[] {
  return TRANSITIONS[type];
}

export function transitionById(id: string): AnyTransition | undefined {
  for (const type of Object.keys(TRANSITIONS) as ProcessType[]) {
    const found = TRANSITIONS[type].find((t) => t.id === id);
    if (found) return found;
  }
  return undefined;
}

/** The transitions the case's current stage carries. A closed or transferred case carries none. */
export function transitionsFrom(process: Process): readonly AnyTransition[] {
  if (process.status !== 'open') return [];
  return TRANSITIONS[process.type].filter((t) => t.from.includes(process.stage));
}

export interface TransitionAvailability {
  transition: AnyTransition;
  permission: PermissionDecision;
  /** What the record lacks before this can be recorded, each with the action that creates it. */
  missing: MissingThing[];
  /** Where it leads, as labels, for the stepper and the drawer. */
  leadsTo: string[];
}

/**
 * What happens next: every transition the stage carries, with whether this person may record it and
 * what stands in the way. The stepper draws these as buttons; the drawer lists them as sentences.
 */
export function whatHappensNext(process: Process, actor: Pick<TransitionActor, 'roleId'>): TransitionAvailability[] {
  return transitionsFrom(process).map((transition) => ({
    transition,
    permission: canRecordTransition(actor, transition),
    missing: transition.requires(process as never),
    leadsTo: leadsTo(process, transition),
  }));
}

/**
 * The stages a transition moves the case to from where it is. A transition that records a step
 * without moving lists the same stages on both sides, and from any of them it leads nowhere; the
 * other stages on its list are where it would stay if recorded there, not where it goes.
 */
export function leadsTo(process: Process, transition: AnyTransition): string[] {
  const stays = transition.to.includes(process.stage) && transition.to.every((stage) => transition.from.includes(stage));
  if (stays) return [];
  return transition.to.filter((stage) => stage !== process.stage).map((stage) => stageLabel(process.type, stage));
}

export type StageTransitionResult = { ok: true; outcome: TransitionOutcome } | { ok: false; errors: string[]; missing: MissingThing[]; permission?: PermissionDecision };

/**
 * Record a transition: the stage check, the permission, the requirements and the input's own
 * validation, in that order, and the record after the decision when all four pass. Refusals are
 * total: nothing is returned for the store to write until everything has passed.
 */
export function applyTransition(process: Process, transition: AnyTransition, input: unknown, ctx: TransitionContext): StageTransitionResult {
  if (process.status !== 'open') return { ok: false, errors: ['processNotOpen'], missing: [] };
  if (transition.process !== process.type) return { ok: false, errors: ['transitionWrongProcess'], missing: [] };
  if (!transition.from.includes(process.stage)) return { ok: false, errors: ['transitionNotFromThisStage'], missing: [] };
  const permission = canRecordTransition(ctx.actor, transition);
  if (!permission.allowed) return { ok: false, errors: ['transitionNotYourRole'], missing: [], permission };
  const missing = transition.requires(process);
  if (missing.length > 0) return { ok: false, errors: missing.map((m) => m.code), missing };
  const errors = transition.validate(input as never, process);
  if (errors.length > 0) return { ok: false, errors, missing: [] };
  return { ok: true, outcome: transition.apply(process, input as never, ctx) };
}

export type ScheduleRoute =
  | { kind: 'transition'; transition: AnyTransition }
  | { kind: 'plain' }
  | { kind: 'refused'; code: 'meetingWrongStage'; transition: AnyTransition; stages: Stage[] };

/**
 * How a meeting of a type is scheduled on a case (D-213). Through the transition whose table
 * schedules the type from the case's current stage, where there is one. As a plain meeting write
 * where the engine awaits the type at this stage (a held transition fires from it, so a second IRD
 * or a reconvened CPPM is scheduled without moving anything) or has no view of the type at all (a
 * core group, an inter-agency discussion, an AWI multidisciplinary meeting). And refused, naming the
 * stages the table schedules it from, where the type is the engine's but the case is elsewhere: a
 * case conference on a concern that has not been screened is not a meeting, it is a stage skipped.
 */
export function scheduleRoute(process: Process, type: MeetingType): ScheduleRoute {
  const table = TRANSITIONS[process.type];
  const schedulers = table.filter((t) => t.schedules?.includes(type));
  const fromHere = schedulers.find((t) => t.from.includes(process.stage));
  if (fromHere) return { kind: 'transition', transition: fromHere };
  if (table.some((t) => t.firedBy?.includes(type) && t.from.includes(process.stage))) return { kind: 'plain' };
  const first = schedulers[0];
  if (!first) return { kind: 'plain' };
  return { kind: 'refused', code: 'meetingWrongStage', transition: first, stages: [...new Set(schedulers.flatMap((t) => [...t.from]))] };
}

/** The transition a meeting of this type fires when it is held, from the case's current stage. */
export function heldTransitionFor(process: Process, type: MeetingType): AnyTransition | undefined {
  return TRANSITIONS[process.type].find((t) => t.firedBy?.includes(type) && t.from.includes(process.stage));
}

/** The transitions a meeting type fires from any stage, for the sentence that says where the case has to be. */
export function heldTransitionsFor(processType: ProcessType, type: MeetingType): readonly AnyTransition[] {
  return TRANSITIONS[processType].filter((t) => t.firedBy?.includes(type));
}

/** The meeting types a case type holds, in the order they usually happen. */
export const MEETING_TYPES_BY_PROCESS: Record<ProcessType, readonly MeetingType[]> = {
  asp: ['asp-inter-agency-discussion', 'asp-case-conference', 'asp-review-conference', 'lsi-planning'],
  cp: ['ird', 'cppm', 'pre-birth-cppm', 'core-group', 'cppm-review'],
  marac: ['marac'],
  mappa: ['mappa-level2', 'mappa-level3'],
  awi: ['awi-mdt'],
};

/** Every stage a type can reach through the engine, in table order: the stepper's spine. */
export function reachableStages(type: ProcessType): Stage[] {
  const out: Stage[] = [];
  for (const transition of TRANSITIONS[type]) for (const stage of transition.to) if (!out.includes(stage)) out.push(stage);
  return out;
}

export { transitionLabel };
