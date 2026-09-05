import { tKey } from '@mas/messages';
import { keySegment, type ConnectorId } from '../enums';
import { acceptsIntent, authorityFor, WRITE_CAPABILITIES, type OutboundIntent } from './write';
import type { InboundChange, OutboundWrite, OutboxState, PayloadField } from '../schemas/outbox';
import type { Process } from '../schemas/process';

/**
 * The outbox: every outbound write, with a delivery state a person can see.
 *
 * A silent write failure is a safety incident. If Person360 believes the inquiry is open in the
 * council's system and the write failed, a worker looking only at that system sees nothing, and the
 * assumption that the other agency knows is precisely the assumption that appears in significant
 * case reviews. So nothing goes out without passing through here, every state is visible, and a
 * failure is surfaced to a person rather than retried into silence.
 *
 * Nothing is sent automatically either. The system proposes, a person authorises, and the
 * authorisation records a purpose and a lawful basis, because that is what it is: a disclosure into
 * another organisation's record.
 */

export function outboxStateLabel(state: OutboxState): string {
  return tKey(`connectors.outbox.states.${keySegment(state)}`);
}

/**
 * True where the record has been confirmed by the far side, which is the only state that justifies
 * telling a practitioner the other agency knows. Everything else displays as not yet confirmed.
 */
export function isConfirmed(write: OutboundWrite): boolean {
  return write.state === 'acknowledged' && write.externalRef !== undefined;
}

/** Needs somebody: a proposal waiting for authorisation, or a failure waiting for a decision. */
export function needsAttention(write: OutboundWrite): boolean {
  return write.state === 'proposed' || write.state === 'failed';
}

/**
 * The idempotency key: stable for the same logical write.
 *
 * Built from what the write is about rather than from a counter or a clock, so the same stage change
 * proposed twice produces the same key. That is what lets a retry replace rather than duplicate, and
 * what lets an inbound echo be recognised as ours: the far side hands the key back and the platform
 * matches it against the write that produced it.
 */
export function idempotencyKey(input: { connectorId: ConnectorId; intent: OutboundIntent; processId?: string; subjectPersonId: string; discriminator?: string }): string {
  const parts = [input.connectorId, input.intent, input.processId ?? input.subjectPersonId];
  if (input.discriminator) parts.push(input.discriminator);
  return parts.join(':');
}

/** The transitions the state machine allows. Everything else is a bug rather than a decision. */
const ALLOWED: Record<OutboxState, OutboxState[]> = {
  proposed: ['authorised', 'cancelled'],
  authorised: ['sent', 'failed', 'cancelled'],
  sent: ['acknowledged', 'failed'],
  acknowledged: [],
  // A failure can be authorised again, which is a retry, or parked as a dead letter, which is a
  // decision somebody made. It cannot quietly become acknowledged.
  failed: ['authorised', 'dead-letter', 'cancelled'],
  'dead-letter': ['authorised', 'cancelled'],
  cancelled: [],
};

export function canTransition(from: OutboxState, to: OutboxState): boolean {
  return ALLOWED[from].includes(to);
}

export interface ProposalInput {
  id: string;
  connectorId: ConnectorId;
  intent: OutboundIntent;
  subjectPersonId: string;
  processId?: string;
  payload: PayloadField[];
  at: string;
  byName: string;
  discriminator?: string;
}

export function proposalRefusals(input: Pick<ProposalInput, 'connectorId' | 'intent' | 'payload'>): string[] {
  const errors: string[] = [];
  if (!acceptsIntent(input.connectorId, input.intent)) errors.push('connectorRefusesIntent');
  if (input.payload.length === 0) errors.push('payloadEmpty');
  // A field the far side does not have is a mapping error, and a mapping error found at the gateway
  // is a failed write nobody can explain. Caught here, where the field names are known.
  const known = new Set(WRITE_CAPABILITIES[input.connectorId].fields);
  if (input.payload.some((f) => !known.has(f.field))) errors.push('payloadUnknownField');
  return errors;
}

export function proposeWrite(input: ProposalInput): OutboundWrite {
  return {
    id: input.id,
    synthetic: true,
    connectorId: input.connectorId,
    intent: input.intent,
    idempotencyKey: idempotencyKey(input),
    origin: 'person360',
    subjectPersonId: input.subjectPersonId,
    processId: input.processId,
    payload: input.payload,
    state: 'proposed',
    proposedAt: input.at,
    proposedByName: input.byName,
    attempts: 0,
  };
}

export interface AuthorisationInput {
  at: string;
  byUserId?: string;
  byName: string;
  purpose: string;
  lawfulBasisId: string;
}

export function authorisationRefusals(write: OutboundWrite, input: AuthorisationInput): string[] {
  const errors: string[] = [];
  if (!canTransition(write.state, 'authorised')) errors.push('outboxNotAuthorisable');
  if (input.purpose.trim().length < 10) errors.push('outboxPurposeRequired');
  if (input.lawfulBasisId.trim() === '') errors.push('outboxLawfulBasisRequired');
  return errors;
}

export function authoriseWrite(write: OutboundWrite, input: AuthorisationInput): OutboundWrite {
  return { ...write, state: 'authorised', authorisation: { ...input, purpose: input.purpose.trim() }, failure: undefined };
}

/** Sent: the ciphertext left the platform. `relayedBytes` is all the platform knows about it. */
export function markSent(write: OutboundWrite, at: string, relayedBytes: number): OutboundWrite {
  return { ...write, state: 'sent', sentAt: at, relayedBytes };
}

/** Acknowledged: the far side confirmed and gave its own identifier. */
export function markAcknowledged(write: OutboundWrite, at: string, externalRef: string): OutboundWrite {
  return { ...write, state: 'acknowledged', acknowledgedAt: at, externalRef };
}

export function markFailed(write: OutboundWrite, at: string, reason: string): OutboundWrite {
  return { ...write, state: 'failed', failure: { at, reason }, attempts: write.attempts + 1 };
}

export function markDeadLetter(write: OutboundWrite): OutboundWrite {
  return { ...write, state: 'dead-letter' };
}

/**
 * What the process screen says about a write, in plain words.
 *
 * "Stage change written to the council social work system, acknowledged 14:32, reference CF-2026-8871"
 * is the line that convinces a social work team leader. Its opposite matters more: a record whose
 * write has not been acknowledged says so, wherever it matters, rather than looking the same as one
 * that has.
 */
export function confirmationKey(write: OutboundWrite): string {
  if (write.state === 'acknowledged') return 'connectors.outbox.confirmed';
  if (write.state === 'failed' || write.state === 'dead-letter') return 'connectors.outbox.failedLine';
  if (write.state === 'sent') return 'connectors.outbox.sentNotConfirmed';
  return 'connectors.outbox.notSent';
}

/**
 * Echo detection: is this inbound change our own write coming back?
 *
 * Write an episode into the council's system and its change feed pushes it back. Ingested as new,
 * that is a duplicate process and, with a feed running, a loop. So the far side returns the
 * idempotency key it was given, and a change carrying one we issued is reconciled against the write
 * that produced it rather than accepted as a proposal.
 *
 * The fallback matters too: a source system that does not return the key is matched on its own
 * reference against a write we have already had acknowledged. Both are cheap; missing either is
 * expensive.
 */
export function echoedWrite(change: InboundChange, outbox: readonly OutboundWrite[]): OutboundWrite | undefined {
  if (change.echoOf) {
    const byKey = outbox.find((w) => w.idempotencyKey === change.echoOf);
    if (byKey) return byKey;
  }
  return outbox.find((w) => w.externalRef !== undefined && w.externalRef === change.externalRef && w.connectorId === change.connectorId);
}

export function isEcho(change: InboundChange, outbox: readonly OutboundWrite[]): boolean {
  return echoedWrite(change, outbox) !== undefined;
}

/**
 * One divergence between what Person360 believes the source holds and what the source says.
 *
 * `authority` decides what the screen offers. Where the source owns the field, the divergence is
 * ours to take. Where Person360 owns it, the source is behind and the fix is another write. Where
 * either owns it and both have changed, it is a conflict and a person chooses, with both values,
 * both timestamps and both authors in front of them.
 */
export interface Divergence {
  field: string;
  ours: string;
  theirs: string;
  authority: ReturnType<typeof authorityFor>;
  /** True where both sides changed a field either owns, which is the case a person must decide. */
  conflict: boolean;
}

export interface ReconciliationReport {
  connectorId: ConnectorId;
  subjectPersonId: string;
  externalRef?: string;
  checkedAt: string;
  divergences: Divergence[];
}

/**
 * Compare what we hold against what the source says, field by field.
 *
 * Both sides are given as field maps in the target system's own names, because that is the only
 * vocabulary both halves share and it is the vocabulary the screen has to show. A field present on
 * one side and absent on the other is a divergence: an absent value is a value.
 */
export function reconcile(input: {
  connectorId: ConnectorId;
  subjectPersonId: string;
  externalRef?: string;
  checkedAt: string;
  ours: Record<string, string>;
  theirs: Record<string, string>;
  /** Fields both sides have edited since the last reconciliation, which is what makes a conflict. */
  bothChanged?: readonly string[];
}): ReconciliationReport {
  const changed = new Set(input.bothChanged ?? []);
  const divergences: Divergence[] = [];
  for (const field of new Set([...Object.keys(input.ours), ...Object.keys(input.theirs)])) {
    const ours = input.ours[field] ?? '';
    const theirs = input.theirs[field] ?? '';
    if (ours === theirs) continue;
    const authority = authorityFor(input.connectorId, field);
    divergences.push({ field, ours, theirs, authority, conflict: authority === 'either' && changed.has(field) });
  }
  return { connectorId: input.connectorId, subjectPersonId: input.subjectPersonId, externalRef: input.externalRef, checkedAt: input.checkedAt, divergences };
}

/** Divergences a person has to decide, as against ones the authority table already answers. */
export function conflicts(report: ReconciliationReport): Divergence[] {
  return report.divergences.filter((d) => d.conflict);
}

/**
 * The payload for opening a case in a social work system, mapped into its own field names.
 *
 * Kept beside the outbox rather than in a screen because the mapping is the thing a practitioner is
 * asked to authorise, and a mapping composed at a call site is a mapping that differs between call
 * sites. The `from` on each field names where the value came from, so the preview can be checked.
 */
export function episodePayload(process: Process, allocatedTo: string): PayloadField[] {
  return [
    { field: 'Episode.Type', value: process.type.toUpperCase(), from: 'process.type' },
    { field: 'Episode.OpenedDate', value: process.openedAt.slice(0, 10), from: 'process.openedAt' },
    { field: 'Episode.Stage', value: process.stage, from: 'process.stage' },
    { field: 'Episode.AllocatedWorker', value: allocatedTo, from: 'process.leadUserId' },
    { field: 'Episode.CaseReference', value: process.reference, from: 'process.reference' },
  ];
}

/** The payload for a stage change: the reference the far side knows it by, and the new stage. */
export function stagePayload(process: Process): PayloadField[] {
  return [
    { field: 'Episode.CaseReference', value: process.reference, from: 'process.reference' },
    { field: 'Episode.Stage', value: process.stage, from: 'process.stage' },
  ];
}

/** The payload for a closure: the reference, the date and the coded reason the return reads. */
export function closurePayload(process: Process): PayloadField[] {
  return [
    { field: 'Episode.CaseReference', value: process.reference, from: 'process.reference' },
    { field: 'Episode.ClosedDate', value: (process.closedAt ?? '').slice(0, 10), from: 'process.closedAt' },
    { field: 'Episode.ClosureReason', value: process.closureReason ?? '', from: 'process.closureReason' },
  ];
}
