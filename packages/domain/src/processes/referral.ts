import type { Process } from '../schemas/process';

/**
 * Correcting the referral or concern a case was opened on (D-245).
 *
 * The referral is a record of what somebody said, and a record of what somebody said can be wrong:
 * a date taken down in a phone call, a source agency guessed at, a summary that named the wrong
 * street. The engine's forward-only rule is about stages, not about facts, so this is a correction
 * of the opening record rather than a transition: the same fields the opening form wrote, written
 * again with a reason, through the pipeline, so the version history keeps both readings.
 *
 * What it will not do is change who the case is about, who the perpetrator is, or anything a
 * decision has since rested on. Those are the fields listed here as fixed: the subject is a merge
 * or a recorded-in-error, and the perpetrator is the case-role register (D-223). Everything else on
 * the opening record is text, a date or a coded value, and a practitioner may put it right.
 */
export type ReferralField = { id: string; label: string; kind: 'text' | 'textarea' | 'date-time' | 'agency' };

export interface ReferralCorrection {
  /** The path into the process detail, dotted, e.g. `concern.receivedAt`. */
  field: string;
  value: string;
}

/** The correctable fields of the opening record, per process type, in the order the form shows them. */
export function referralFields(type: Process['type']): ReferralField[] {
  const common = (prefix: string, receivedAt: string): ReferralField[] => [
    { id: `${prefix}.${receivedAt}`, label: receivedAt, kind: 'date-time' },
    { id: `${prefix}.source`, label: 'source', kind: 'text' },
    { id: `${prefix}.sourceAgency`, label: 'sourceAgency', kind: 'agency' },
    { id: `${prefix}.summary`, label: 'summary', kind: 'textarea' },
  ];
  switch (type) {
    case 'asp':
      return [...common('concern', 'receivedAt'), { id: 'concern.sourceReference', label: 'sourceReference', kind: 'text' }];
    case 'cp':
      return [...common('concern', 'receivedAt'), { id: 'concern.sourceReference', label: 'sourceReference', kind: 'text' }];
    case 'awi':
      return [...common('concern', 'raisedAt'), { id: 'concern.decisionInQuestion', label: 'decisionInQuestion', kind: 'text' }];
    case 'marac':
      return [
        { id: 'referral.receivedAt', label: 'receivedAt', kind: 'date-time' },
        { id: 'referral.referrerName', label: 'referrerName', kind: 'text' },
        { id: 'referral.referringAgency', label: 'referringAgency', kind: 'agency' },
        { id: 'referral.summary', label: 'summary', kind: 'textarea' },
      ];
    case 'mappa':
      return [
        { id: 'notification.at', label: 'notifiedAt', kind: 'date-time' },
        { id: 'notification.source', label: 'source', kind: 'text' },
        { id: 'notification.byName', label: 'byName', kind: 'text' },
      ];
  }
}

/** The value a field holds now, as a string, for the form's first render. */
export function referralValue(process: Process, field: string): string {
  const parts = field.split('.');
  let node: unknown = process.detail;
  for (const part of parts) {
    if (node === null || typeof node !== 'object') return '';
    node = (node as Record<string, unknown>)[part];
  }
  // Every correctable field is a string, a date string or a coded value. Anything else is a caller
  // asking for a field that is not on the list, and the empty string refuses it in the form.
  return typeof node === 'string' ? node : typeof node === 'number' || typeof node === 'boolean' ? String(node) : '';
}

/**
 * The corrected detail, or the codes that refuse it. Nothing is written here: the store hands the
 * result to the pipeline, which validates the whole record against the schema, so a bad date or an
 * agency that is not one refuses the write rather than reaching the record.
 */
export function applyReferralCorrections(process: Process, corrections: readonly ReferralCorrection[]): { ok: true; detail: Process['detail'] } | { ok: false; errors: string[] } {
  const allowed = new Set(referralFields(process.type).map((f) => f.id));
  const errors: string[] = [];
  const changed = corrections.filter((c) => c.value !== referralValue(process, c.field));
  if (changed.length === 0) errors.push('referralUnchanged');
  for (const c of changed) if (!allowed.has(c.field)) errors.push('referralFieldNotCorrectable');
  if (errors.length > 0) return { ok: false, errors: [...new Set(errors)] };

  // A deep clone through JSON is safe here: process detail is plain data by construction, which the
  // Zod schemas guarantee, and the pipeline re-parses whatever comes back.
  const detail = JSON.parse(JSON.stringify(process.detail)) as Record<string, unknown>;
  for (const c of changed) {
    const parts = c.field.split('.');
    const last = parts.pop()!;
    let node: Record<string, unknown> = detail;
    for (const part of parts) {
      const next = node[part];
      if (next === null || typeof next !== 'object') {
        node[part] = {};
      }
      node = node[part] as Record<string, unknown>;
    }
    if (c.value === '') delete node[last];
    else node[last] = c.value;
  }
  return { ok: true, detail: detail as Process['detail'] };
}
