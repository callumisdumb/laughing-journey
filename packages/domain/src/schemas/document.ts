import { z } from 'zod';
import { classificationSchema, correctable, idSchema, isoDateTime, syntheticSchema } from './common';

/**
 * A file attached to a record.
 *
 * The file itself is held as a data URI on the record, which is what a mockup with no backend can
 * hold; a deployment puts the bytes in an object store behind the same classification and keeps
 * this record as the pointer. The caps are small on purpose: the overlay that persists changes is
 * browser storage, and a record that carries megabytes is a record the product cannot save.
 *
 * The classification is derived from the parent when the file is attached and marked on the file
 * name when it is downloaded, so a minute that leaves the product as a PDF leaves marked. Nothing
 * scans the file: that is a production requirement, named in the dialog and the handover, not a
 * feature the mockup pretends to have (D-243).
 */
export const DOCUMENT_PARENT_KINDS = ['person', 'process', 'meeting', 'event'] as const;
export type DocumentParentKind = (typeof DOCUMENT_PARENT_KINDS)[number];

/** Bytes. One file, and everything attached to one record. */
export const DOCUMENT_LIMITS = { file: 1_000_000, record: 4_000_000 } as const;

export const documentSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  parent: z.object({ kind: z.enum(DOCUMENT_PARENT_KINDS), id: idSchema }),
  /** The case the parent belongs to, where it belongs to one; decides who may read the file. */
  processId: idSchema.optional(),
  name: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(100),
  /** Bytes, as decoded from the data URI. */
  size: z.number().int().positive().max(DOCUMENT_LIMITS.file),
  dataUri: z.string().startsWith('data:'),
  note: z.string().max(500).optional(),
  classification: classificationSchema,
  addedAt: isoDateTime,
  addedByUserId: idSchema.optional(),
  addedByName: z.string(),
  ...correctable,
});
export type Document = z.infer<typeof documentSchema>;
