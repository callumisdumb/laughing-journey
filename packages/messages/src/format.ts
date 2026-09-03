/**
 * ICU MessageFormat rendering with a per-message cache. Formatting is bound to en-GB and
 * Europe/London so a date argument renders as dd Mon yyyy without the caller thinking about it.
 */
import { parse, TYPE } from '@formatjs/icu-messageformat-parser';
import { IntlMessageFormat, type FormatXMLElementFn, type PrimitiveType } from 'intl-messageformat';
import { LOCALE, TIME_ZONE } from './catalogue';

export type MessageValues = Record<string, PrimitiveType | FormatXMLElementFn<string>>;

const cache = new Map<string, IntlMessageFormat>();

const FORMATS = {
  date: { short: { day: '2-digit', month: 'short', year: 'numeric', timeZone: TIME_ZONE } },
  time: { short: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TIME_ZONE } },
} as const;

function formatter(message: string): IntlMessageFormat {
  let f = cache.get(message);
  if (!f) {
    f = new IntlMessageFormat(message, LOCALE, FORMATS);
    cache.set(message, f);
  }
  return f;
}

/** Render a message. A message that fails to parse renders as its own text so a typo never blanks a screen. */
export function formatMessage(message: string, values?: MessageValues): string {
  try {
    const result = formatter(message).format(values);
    return Array.isArray(result) ? result.map((part) => String(part)).join('') : String(result);
  } catch {
    return message;
  }
}

/** Render a message whose tags map to React nodes; used by useT().rich. */
export function formatRich<T>(message: string, values?: Record<string, PrimitiveType | T | FormatXMLElementFn<T>>): Array<string | T> {
  try {
    const result = formatter(message).format<T>(values);
    return Array.isArray(result) ? result : [result];
  } catch {
    return [message];
  }
}

/** Validate ICU syntax; returns an error message or undefined. The Admin editor calls this on every keystroke. */
export function validateMessage(message: string): string | undefined {
  try {
    parse(message);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** The argument names a message uses, in order of first appearance. */
export function messageArguments(message: string): string[] {
  const names: string[] = [];
  const walk = (elements: ReturnType<typeof parse>) => {
    for (const el of elements) {
      if ('value' in el && typeof el.value === 'string' && el.type !== TYPE.literal && !names.includes(el.value)) names.push(el.value);
      if ('options' in el && el.options) for (const option of Object.values(el.options)) walk(option.value);
      if ('children' in el && Array.isArray(el.children)) walk(el.children);
    }
  };
  try {
    walk(parse(message));
  } catch {
    /* unparseable: no arguments */
  }
  return names;
}
