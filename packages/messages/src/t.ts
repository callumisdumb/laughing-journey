/**
 * Plain `t()` for code outside React: clocks, connectors, print packs, the desktop bridge. It reads
 * the same merged messages the provider serves, so an Admin override applies here too.
 */
import { formatMessage, type MessageValues } from './format';
import { getMessage } from './overrides';
import type { MessageArgs, MessageKey } from './keys.generated';

export type ArgsFor<K extends MessageKey> = MessageArgs[K];

/** `[args]` when the message takes arguments, `[]` when it does not, so a missing argument is a compile error. */
export type TArgs<K extends MessageKey> = MessageArgs[K] extends Record<string, never> ? [] : [args: MessageArgs[K]];

export function t<K extends MessageKey>(key: K, ...rest: TArgs<K>): string {
  const message = getMessage(key);
  if (message === undefined) return key;
  return formatMessage(message, rest[0]);
}

/** Look a key up without type checking; the Admin editor and dynamic label maps use it. */
export function tKey(key: string, values?: MessageValues): string {
  const message = getMessage(key);
  return message === undefined ? key : formatMessage(message, values);
}

export function hasMessage(key: string): key is MessageKey {
  return getMessage(key) !== undefined;
}
