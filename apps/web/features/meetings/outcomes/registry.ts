import type { Meeting, Process, User } from '@mas/domain';
import type { ComponentType } from 'react';

/** What every outcome form receives: the meeting it closes, the case it decides on, and its own value. */
export interface OutcomeFormProps<I> {
  meeting: Meeting;
  process: Process;
  value: I;
  onChange: (value: I) => void;
}

/** What a form's first value may draw on beside the meeting and the case: who is closing it, and when. */
export interface OutcomeFormContext {
  user: User | null;
  now: Date;
}

export interface HeldForm {
  /** The input before anybody has typed, from what the meeting already knows. */
  initial: (meeting: Meeting, process: Process, ctx: OutcomeFormContext) => unknown;
  Form: ComponentType<OutcomeFormProps<unknown>>;
}

/**
 * The one cast in the registry. A form is written against its own input type and the dialog holds
 * the value as unknown, because the transition it feeds validates the input and the dialog never
 * reads inside it.
 */
export function heldForm<I>(initial: (meeting: Meeting, process: Process, ctx: OutcomeFormContext) => I, Form: ComponentType<OutcomeFormProps<I>>): HeldForm {
  return { initial, Form: Form as unknown as ComponentType<OutcomeFormProps<unknown>> };
}
