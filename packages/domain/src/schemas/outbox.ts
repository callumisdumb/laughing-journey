import { z } from 'zod';
import { CONNECTOR_IDS } from '../enums';
import { OUTBOUND_INTENTS } from '../connectors/write';
import { idSchema, isoDateTime, syntheticSchema } from './common';

/**
 * One field of an outbound payload: the target system's name for it, the value, and where it came
 * from. The third is what makes the preview a preview rather than a promise.
 *
 * A practitioner authorising a write into a GP record should see what lands there, in the words that
 * system uses, next to the Person360 value it was mapped from. That is good governance and it is
 * also the difference between a mapping somebody can check and a mapping they have to trust.
 */
export const payloadFieldSchema = z.object({
  /** The field name in the target system. */
  field: z.string(),
  /** The value that will land there. */
  value: z.string(),
  /** The Person360 field it was mapped from, so the reader can check the mapping. */
  from: z.string(),
});
export type PayloadField = z.infer<typeof payloadFieldSchema>;

/**
 * The delivery states, in order, and why each exists.
 *
 * `proposed` is what the write pipeline queues: nothing has been authorised, so nothing is going
 * anywhere. `authorised` carries a named person, a purpose and a lawful basis, because an outbound
 * write into a clinical, policing or social work record without a named human author will not pass
 * any information governance review. `sent` means the ciphertext left; `acknowledged` means the far
 * side confirmed and gave its own identifier, which is the only state that justifies telling a
 * practitioner the other agency knows. `failed` is surfaced to a person, never retried into silence.
 * `dead-letter` is a failure somebody has looked at and parked, which is a decision rather than a
 * queue that grew.
 */
export const OUTBOX_STATES = ['proposed', 'authorised', 'sent', 'acknowledged', 'failed', 'dead-letter', 'cancelled'] as const;
export type OutboxState = (typeof OUTBOX_STATES)[number];

export const outboundWriteSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  connectorId: z.enum(CONNECTOR_IDS),
  intent: z.enum(OUTBOUND_INTENTS),
  /**
   * Stable for the same logical write, so a retry is not a duplicate and an inbound echo can be
   * recognised. Built from the record and the intent rather than randomly, which is the whole point.
   */
  idempotencyKey: z.string().min(8),
  /** Person360 wrote this. An inbound change carrying this origin is reconciled, never ingested. */
  origin: z.literal('person360'),
  subjectPersonId: idSchema,
  processId: idSchema.optional(),
  payload: z.array(payloadFieldSchema).min(1),
  state: z.enum(OUTBOX_STATES),
  proposedAt: isoDateTime,
  proposedByName: z.string(),
  /** Set when a person authorises it. Carries a purpose and a lawful basis, exactly as a share does. */
  authorisation: z
    .object({
      at: isoDateTime,
      byUserId: idSchema.optional(),
      byName: z.string(),
      purpose: z.string().min(10),
      lawfulBasisId: z.string(),
    })
    .optional(),
  sentAt: isoDateTime.optional(),
  /** The far side's own identifier, which is what "acknowledged" actually means. */
  acknowledgedAt: isoDateTime.optional(),
  externalRef: z.string().optional(),
  /**
   * The current failure, cleared when it is authorised again. `attempts` is not cleared, because a
   * connector that fails every time is a connector somebody needs to see failing every time, and a
   * retry that forgets it is the fourth attempt hides exactly that.
   */
  failure: z.object({ at: isoDateTime, reason: z.string() }).optional(),
  attempts: z.number().int().nonnegative(),
  /**
   * How many bytes of ciphertext the platform relayed. The platform relays and cannot read, so this
   * is the only thing it knows about the payload, and the server view screen says so.
   */
  relayedBytes: z.number().int().nonnegative().optional(),
});
export type OutboundWrite = z.infer<typeof outboundWriteSchema>;

/**
 * A change arriving from a source system's own feed, before anything is done with it.
 *
 * Separate from `ConnectorEvent`, which is a chronology event awaiting promotion. This is a change
 * to a case: an episode opened, a stage moved, a case closed. Accepting one creates or updates a
 * process; declining one is audited and, where the connector supports it, written back.
 */
export const INBOUND_KINDS = ['process-proposal', 'stage-change', 'closure', 'echo'] as const;
export type InboundKind = (typeof INBOUND_KINDS)[number];

export const inboundChangeSchema = z.object({
  id: idSchema,
  synthetic: syntheticSchema,
  connectorId: z.enum(CONNECTOR_IDS),
  kind: z.enum(INBOUND_KINDS),
  receivedAt: isoDateTime,
  /** The source system's own identifier for the thing that changed. */
  externalRef: z.string(),
  /**
   * The idempotency key of the outbound write this echoes, where it echoes one.
   *
   * This is the whole echo defence. Person360 writes an episode into ECLIPSE; ECLIPSE's change feed
   * pushes it back; without this the platform creates a second process and, with a feed running,
   * possibly a loop. With it the change is recognised as our own and reconciled against the record
   * that produced it.
   */
  echoOf: z.string().optional(),
  subjectPersonId: idSchema.optional(),
  /** Who the source system says this is about, for matching where no person record links yet. */
  subjectHint: z.object({ displayName: z.string(), dateOfBirth: z.string().optional(), externalId: z.string() }),
  payload: z.array(payloadFieldSchema),
  status: z.enum(['pending', 'accepted', 'declined', 'reconciled']),
  reviewedAt: isoDateTime.optional(),
  reviewedByName: z.string().optional(),
  declineReason: z.string().optional(),
  /** The process the acceptance created or the reconciliation matched. */
  processId: idSchema.optional(),
});
export type InboundChange = z.infer<typeof inboundChangeSchema>;
