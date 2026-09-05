import type { Meeting, Process } from '@mas/domain';
import type { ComponentType } from 'react';

/** What every outcome form receives: the meeting it closes, the case it decides on, and its own value. */
export interface OutcomeFormProps<I> {
  meeting: Meeting;
  process: Process;
  value: I;
  onChange: (value: I) => void;
}

export interface HeldForm {
  /** The input before anybody has typed, from what the meeting already knows. */
  initial: (meeting: Meeting, process: Process) => unknown;
  Form: ComponentType<OutcomeFormProps<unknown>>;
}

/**
 * The one cast in the registry. A form is written against its own input type and the dialog holds
 * the value as unknown, because the transition it feeds validates the input and the dialog never
 * reads inside it.
 */
export function heldForm<I>(initial: (meeting: Meeting, process: Process) => I, Form: ComponentType<OutcomeFormProps<I>>): HeldForm {
  return { initial, Form: Form as unknown as ComponentType<OutcomeFormProps<unknown>> };
}
