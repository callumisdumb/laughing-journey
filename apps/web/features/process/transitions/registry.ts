import type { Process, User } from '@mas/domain';
import type { ComponentType } from 'react';

/** What a form's first value may draw on beside the case: who is recording it. */
export interface TransitionFormContext {
  user: User | null;
}

/** What every transition form receives: the case it decides on and its own value. */
export interface TransitionFormProps<I> {
  process: Process;
  value: I;
  onChange: (value: I) => void;
}

export interface TransitionForm {
  /** The input before anybody has typed, from what the case already knows. */
  initial: (process: Process, ctx: TransitionFormContext) => unknown;
  Form: ComponentType<TransitionFormProps<unknown>>;
}

/**
 * The one cast in the registry. A form is written against its own input type and the dialog holds
 * the value as unknown, because the transition validates the input and the dialog never reads
 * inside it.
 */
export function transitionForm<I>(initial: (process: Process, ctx: TransitionFormContext) => I, Form: ComponentType<TransitionFormProps<I>>): TransitionForm {
  return { initial, Form: Form as unknown as ComponentType<TransitionFormProps<unknown>> };
}
