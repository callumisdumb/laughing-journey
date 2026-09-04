import { tKey } from '@mas/messages';
import {
  ASP_INQUIRY_ACTIONS,
  CP_DEREGISTRATION_REASONS,
  aspInquiryActionLabel,
  cpDeregistrationReasonLabel,
  keySegment,
  type AspInquiryAction,
  type CpDeregistrationReason,
  type ProcessType,
  type Stage,
} from '../enums';
import { mappaExitKindLabel } from '../config/labels';
import type { ClockTrigger, Process } from '../schemas/process';

/**
 * Closing a process, which is not a status change.
 *
 * It stops the clocks and records why they stopped; it writes the closure reason from the correct
 * list, which differs by process because the national returns differ; it moves the process to its
 * own closing stage and writes the stage-history entry; and it fills in the type-specific closure
 * fields the return actually reads. The notifications, the chronology milestone and the audit entry
 * are the write pipeline's job, because they are the same for every write.
 *
 * The reason lists are the point of this module. Child protection de-registration reasons come from
 * Children's Social Work Statistics: Child Protection, and the ASP actions taken come from the ASP
 * data workbook. Both are already in the product as field sets pinned to their source. MARAC and AWI
 * have no national closure list that this project has found, so they get a local one, marked as
 * local in the interface and as `TODO(verify)` here, rather than a fabricated national one.
 */

/** MAPPA leaves rather than closes, and the three ways out are already in the schema. */
export const MAPPA_EXIT_KINDS = ['level-down', 'deregistration', 'transfer'] as const;
export type MappaExitKind = (typeof MAPPA_EXIT_KINDS)[number];

/**
 * TODO(verify): local closure reasons for MARAC and AWI.
 *
 * SafeLives publishes a repeat-referral definition and a case-closure practice note rather than a
 * coded return list, and the Adults with Incapacity return counts orders rather than case closures.
 * These are the reasons a partnership would recognise, offered as configuration and labelled in the
 * interface as locally agreed rather than statutory, so nobody reads a national return into them.
 * See docs/RESEARCH.md and docs/DECISIONS.md.
 */
export const LOCAL_CLOSURE_REASONS = [
  'risk-reduced',
  'support-in-place',
  'person-moved-away',
  'person-died',
  'declined-further-involvement',
  'transferred-to-another-area',
  'other-reason',
] as const;
export type LocalClosureReason = (typeof LOCAL_CLOSURE_REASONS)[number];

export function localClosureReasonLabel(reason: LocalClosureReason): string {
  return tKey(`domain.localClosureReasons.${keySegment(reason)}`);
}

/** One offered closure reason: its id, its label, and whether it comes from a national return. */
export interface ClosureReason {
  id: string;
  label: string;
  /** True where the list is a national return's own list rather than a locally agreed one. */
  statutory: boolean;
}

/** The closure reasons offered for a process, from the list that process's return actually uses. */
export function closureReasonsFor(type: ProcessType): ClosureReason[] {
  switch (type) {
    case 'cp':
      return CP_DEREGISTRATION_REASONS.map((id) => ({ id, label: cpDeregistrationReasonLabel(id), statutory: true }));
    case 'asp':
      return ASP_INQUIRY_ACTIONS.map((id) => ({ id, label: aspInquiryActionLabel(id), statutory: true }));
    case 'mappa':
      return MAPPA_EXIT_KINDS.map((id) => ({ id, label: mappaExitKindLabel(id), statutory: true }));
    case 'marac':
    case 'awi':
      return LOCAL_CLOSURE_REASONS.map((id) => ({ id, label: localClosureReasonLabel(id), statutory: false }));
  }
}

/** The stage a closed process sits at. MAPPA exits rather than closing, and its stage says so. */
export const CLOSING_STAGE: Record<ProcessType, Stage> = {
  asp: 'closed',
  cp: 'closed',
  marac: 'closed',
  mappa: 'exit',
  awi: 'closed',
};

export interface CloseInput {
  /** An id from `closureReasonsFor(process.type)`. */
  reasonId: string;
  /** The sentence that goes on the record, which the list alone never says enough. */
  note: string;
  at: string;
  byUserId?: string;
  byName: string;
}

export interface CloseResult {
  process: Process;
  /** The clocks the closure stopped, so the screen can say what stopped counting. */
  stopped: ClockTrigger[];
}

/** The clocks a closure stops: everything still running. A met deadline is already complete. */
export function runningClocks(process: Process): ClockTrigger[] {
  return process.clocks.filter((clock) => !clock.completedAt);
}

export function closeRefusals(process: Process, input: CloseInput): string[] {
  const errors: string[] = [];
  if (process.status === 'closed') errors.push('processAlreadyClosed');
  if (!closureReasonsFor(process.type).some((r) => r.id === input.reasonId)) errors.push('closureReasonRequired');
  if (input.note.trim().length < 10) errors.push('closureNoteRequired');
  return errors;
}

/**
 * The closed process, with the type-specific fields the return reads filled in.
 *
 * The reason id is written into the process's own detail as well as into `closureReason`, because
 * `closureReason` is a string for every type and the return needs the coded value. A closure that
 * only wrote prose would leave the quarterly figure to be reconstructed from it.
 */
export function closeProcess(process: Process, input: CloseInput): CloseResult {
  const stopped = runningClocks(process);
  const stoppedIds = new Set(stopped.map((c) => c.id));
  const clocks = process.clocks.map((clock) =>
    stoppedIds.has(clock.id) ? { ...clock, completedAt: input.at, stoppedByClosure: true } : clock,
  );

  const base = {
    ...process,
    status: 'closed' as const,
    closedAt: input.at,
    closureReason: `${input.reasonId}: ${input.note.trim()}`,
    stage: CLOSING_STAGE[process.type],
    stageHistory: [
      ...process.stageHistory,
      { stage: CLOSING_STAGE[process.type], at: input.at, byUserId: input.byUserId, byName: input.byName, note: input.note.trim() },
    ],
    clocks,
  };

  // Switched on the type so the compiler pairs each detail with its own process, rather than a cast
  // claiming a pairing nobody checked. Same reasoning as `buildOpeningProcess` (D-139).
  switch (base.type) {
    case 'asp':
      return {
        stopped,
        process: {
          ...base,
          type: 'asp',
          detail: {
            ...base.detail,
            closure: { at: input.at, reason: input.note.trim() },
            inquiry: base.detail.inquiry ? { ...base.detail.inquiry, action: input.reasonId as AspInquiryAction } : base.detail.inquiry,
          },
        },
      };
    case 'cp': {
      // De-registration only applies where the child was registered. A case that closes at the
      // concern or investigation stage never reached the register, so there is nothing to
      // de-register and writing a de-registration reason onto an absent register would put a child
      // into the national de-registration count who was never in the registration count.
      const register = base.detail.register;
      return {
        stopped,
        process: {
          ...base,
          type: 'cp',
          detail: register
            ? {
                ...base.detail,
                register: {
                  ...register,
                  deregisteredAt: input.at.slice(0, 10),
                  deregistrationReason: input.reasonId as CpDeregistrationReason,
                  deregistrationNote: input.note.trim(),
                },
              }
            : base.detail,
        },
      };
    }
    case 'mappa':
      return {
        stopped,
        process: {
          ...base,
          type: 'mappa',
          detail: { ...base.detail, exit: { at: input.at.slice(0, 10), kind: input.reasonId as MappaExitKind, note: input.note.trim() } },
        },
      };
    case 'marac':
      return { stopped, process: { ...base, type: 'marac' } };
    case 'awi':
      return { stopped, process: { ...base, type: 'awi' } };
  }
}

export interface ReopenInput {
  reason: string;
  at: string;
  byUserId?: string;
  byName: string;
  /** The stage the case returns to. Defaults to the stage it was at before the closure. */
  stage?: Stage;
}

/**
 * The stage a reopened case returns to: the last one before the closing entry.
 *
 * Reopening at the closing stage would leave a case that says it is closed and is open, and
 * reopening at the first stage would throw away everything that has happened. The stage history is
 * the record of where it actually was.
 */
export function stageBeforeClosure(process: Process): Stage {
  const entries = process.stageHistory;
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    if (entries[i]!.stage !== CLOSING_STAGE[process.type]) return entries[i]!.stage;
  }
  return process.stage;
}

export function reopenRefusals(process: Process, input: ReopenInput): string[] {
  const errors: string[] = [];
  if (process.status !== 'closed') errors.push('processNotClosed');
  if (input.reason.trim().length < 10) errors.push('reopenReasonRequired');
  return errors;
}

/**
 * The reopened process, with the clocks the closure stopped running again.
 *
 * A clock the closure stopped resumes against its original trigger instant rather than restarting
 * from today, because the deadline did not move: the case was shut for a fortnight and the statutory
 * period was running the whole time. A clock that was complete before the closure stays complete,
 * which is what `stoppedByClosure` is for. Restarting everything would fabricate slack that does not
 * exist; restarting nothing would let a deadline disappear because somebody closed a case early.
 */
export function reopenProcess(process: Process, input: ReopenInput): { process: Process; resumed: ClockTrigger[] } {
  const resumed = process.clocks.filter((clock) => clock.stoppedByClosure);
  const resumedIds = new Set(resumed.map((c) => c.id));
  const stage = input.stage ?? stageBeforeClosure(process);
  const clocks = process.clocks.map((clock) =>
    resumedIds.has(clock.id) ? { ...clock, completedAt: undefined, stoppedByClosure: undefined } : clock,
  );
  return {
    resumed,
    process: {
      ...process,
      status: 'open',
      closedAt: undefined,
      closureReason: undefined,
      stage,
      stageHistory: [...process.stageHistory, { stage, at: input.at, byUserId: input.byUserId, byName: input.byName, note: input.reason.trim() }],
      clocks,
    },
  };
}
