import { classificationFor } from '../classification/fromConfig';
import type { Config } from '../schemas/config';
import { classificationRank, markingFilePrefix, type Classification } from '../classification/classify';
import { DOCUMENT_LIMITS, type Document, type DocumentParentKind } from '../schemas/document';
import type { Meeting } from '../schemas/meeting';
import type { ChronologyEvent } from '../schemas/chronology';
import type { Process } from '../schemas/process';

/** Official, unmarked: what a file attached to a record with no case behind it carries. */
export const OFFICIAL_UNMARKED: Classification = { level: 'official', sensitive: false, handling: [] };

/**
 * Why a file may not be attached, as codes the write pipeline's callers word. The size limits are
 * the record's own (D-243): one file, and everything on one record, because the store is a browser.
 */
export function documentRefusals(input: { name: string; size: number; mimeType: string; totalOnRecord: number }): string[] {
  const errors: string[] = [];
  if (input.name.trim() === '') errors.push('documentNameRequired');
  if (input.size <= 0) errors.push('documentEmpty');
  if (input.size > DOCUMENT_LIMITS.file) errors.push('documentTooLarge');
  if (input.size > 0 && input.size <= DOCUMENT_LIMITS.file && input.totalOnRecord + input.size > DOCUMENT_LIMITS.record) errors.push('documentRecordFull');
  if (input.mimeType.trim() === '') errors.push('documentTypeRequired');
  return errors;
}

/** The bytes attached to one record already, which is what the record cap is measured against. */
export function bytesOnRecord(documents: readonly Document[], parent: { kind: DocumentParentKind; id: string }): number {
  return documents.filter((d) => d.parent.kind === parent.kind && d.parent.id === parent.id && !d.recordedInError).reduce((n, d) => n + d.size, 0);
}

/** A file leaves the product with its marking in the name. Official leaves as it came. */
export function markedFileName(classification: Classification, name: string): string {
  return `${markingFilePrefix(classification)}${name}`;
}

/**
 * The classification a file takes from what it is attached to: a case's own; a meeting's case; the
 * highest of the cases a chronology event is linked to; the highest of the cases a person is the
 * subject of. Nothing behind it, and it is Official.
 */
export function documentClassification(config: Config, parent: { kind: DocumentParentKind; id: string }, data: { processes: readonly Process[]; meetings: readonly Meeting[]; events: readonly ChronologyEvent[]; actions?: readonly { id: string; processId: string }[] }): Classification {
  const highest = (processes: readonly Process[]): Classification => processes.map((p) => classificationFor(config, p)).reduce((best, c) => (classificationRank(c) > classificationRank(best) ? c : best), OFFICIAL_UNMARKED);
  switch (parent.kind) {
    case 'process':
      return highest(data.processes.filter((p) => p.id === parent.id));
    case 'meeting': {
      const meeting = data.meetings.find((m) => m.id === parent.id);
      return highest(data.processes.filter((p) => p.id === meeting?.processId));
    }
    case 'event': {
      const event = data.events.find((e) => e.id === parent.id);
      return highest(data.processes.filter((p) => event?.linkedProcessIds.includes(p.id)));
    }
    case 'action': {
      const action = data.actions?.find((a) => a.id === parent.id);
      return highest(data.processes.filter((p) => p.id === action?.processId));
    }
    case 'person':
      return highest(data.processes.filter((p) => p.subjectIds.includes(parent.id)));
  }
}

/** The case a file belongs to for access purposes, from its parent; a person's file belongs to no one case. */
export function documentProcessId(parent: { kind: DocumentParentKind; id: string }, data: { meetings: readonly Meeting[]; events: readonly ChronologyEvent[]; actions?: readonly { id: string; processId: string }[] }): string | undefined {
  if (parent.kind === 'process') return parent.id;
  if (parent.kind === 'meeting') return data.meetings.find((m) => m.id === parent.id)?.processId;
  if (parent.kind === 'event') return data.events.find((e) => e.id === parent.id)?.linkedProcessIds[0];
  if (parent.kind === 'action') return data.actions?.find((a) => a.id === parent.id)?.processId;
  return undefined;
}
