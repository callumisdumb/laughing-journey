import type { FieldErrors } from 'react-hook-form';

/**
 * Flattens a react-hook-form error tree into the list of messages the dialog shows as a summary.
 *
 * Per-field messages alone are not enough on a long statutory form. The three-point test is taller
 * than a 700px viewport, so a keyboard user who submits and is refused has no way of knowing why
 * without scrolling the body looking for red. The summary sits at the top of the scrolling region,
 * takes focus, and says what is wrong in one place.
 *
 * Errors nest, because the schemas do: `a.reasoning` on the three-point test is an object holding an
 * object holding a message. So this walks rather than reading one level.
 */
export function formErrorSummary(errors: FieldErrors): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const walk = (node: unknown) => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const record = node as Record<string, unknown>;
    const message = record.message;
    if (typeof message === 'string' && message.length > 0) {
      if (!seen.has(message)) {
        seen.add(message);
        out.push(message);
      }
      return;
    }
    for (const value of Object.values(record)) walk(value);
  };

  walk(errors);
  return out;
}
