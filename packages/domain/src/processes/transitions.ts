import type { ProcessType, Stage } from '../enums';
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
    leadsTo: transition.to.filter((stage) => stage !== process.stage).map((stage) => stageLabel(process.type, stage)),
  }));
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

/** Every stage a type can reach through the engine, in table order: the stepper's spine. */
export function reachableStages(type: ProcessType): Stage[] {
  const out: Stage[] = [];
  for (const transition of TRANSITIONS[type]) for (const stage of transition.to) if (!out.includes(stage)) out.push(stage);
  return out;
}

export { transitionLabel };
