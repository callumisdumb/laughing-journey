import type { Agency, ConnectorHealth, ConnectorId, EventType, InboundChange, OutboundIntent, OutboundWrite, PayloadField, ReconciliationReport, Significance } from '@mas/domain';

export type ConnectorCapability = 'lookupPerson' | 'pullEvents' | 'pushOutcome' | 'registerCheck' | 'flagRecord' | 'proposeWrite' | 'submitWrite' | 'poll' | 'reconcile';

export interface PersonQuery {
  givenName?: string;
  familyName?: string;
  dateOfBirth?: string;
  chi?: string;
  postcode?: string;
}

export interface ExternalPersonMatch {
  externalId: string;
  displayName: string;
  dateOfBirth?: string;
  address?: string;
  confidence: 'exact' | 'probable' | 'possible';
  /** Raw fields as the source system labels them. */
  source: Record<string, string>;
}

export interface SubjectRef {
  personId: string;
  chi?: string;
  externalId?: string;
}

export interface DateWindow {
  from: string;
  to: string;
}

export interface ExternalEvent {
  externalRef: string;
  occurredAt: string;
  hasTime: boolean;
  /** The source system's own vocabulary, field by field. */
  source: Record<string, string>;
  /** The platform mapping applied by the adapter. */
  mapped: {
    eventType: EventType;
    title: string;
    detail: string;
    significance: Significance;
    mappingRule: string;
  };
}

export interface ProcessOutcome {
  processId: string;
  personId: string;
  outcome: string;
  at: string;
}

export interface PushReceipt {
  accepted: boolean;
  receiptRef: string;
  at: string;
  message?: string;
}

export interface RegisterResult {
  register: string;
  checkedAt: string;
  found: boolean;
  entries: Array<{ label: string; value: string }>;
}

export interface RecordFlag {
  kind: 'marac' | 'cp-register' | 'asp' | 'mappa-presence';
  from: string;
  to?: string;
  contact: string;
}

/**
 * What would be written, mapped into the target system's own field names.
 *
 * The mapping is the thing a practitioner authorises, so the adapter produces it rather than a
 * screen: a practitioner authorising a write into a GP record should see what lands there, and a
 * payload composed at the call site is a payload that differs between call sites.
 */
export interface WriteProposal {
  connector: ConnectorId;
  intent: OutboundIntent;
  payload: PayloadField[];
  /** Where the adapter refuses: the ceiling, a missing reference, an unmapped field. */
  refusals: string[];
}

/** An authorised write, on its way out. The authorisation is on the record, not on this. */
export interface AuthorisedWrite {
  write: OutboundWrite;
  /** The payload as ciphertext. The platform relays it; only the gateway can open it. */
  sealedBytes: number;
}

/**
 * What the far side said. `externalRef` is the source system's own identifier, which is the only
 * thing that turns "sent" into "acknowledged".
 */
export interface WriteReceipt {
  accepted: boolean;
  at: string;
  externalRef?: string;
  /** Why it was refused, in the far side's own words, for the outbox to show a person. */
  reason?: string;
}

/** A cursor into a source system's change feed. Opaque to the platform. */
export type Cursor = string;

export interface ConnectorAdapter {
  readonly id: ConnectorId;
  readonly displayName: string;
  readonly systemName: string;
  readonly agency: Agency;
  readonly capabilities: ConnectorCapability[];
  health(): Promise<ConnectorHealth>;
  lookupPerson(query: PersonQuery): Promise<ExternalPersonMatch[]>;
  pullEvents(subject: SubjectRef, window: DateWindow): Promise<ExternalEvent[]>;
  pushOutcome?(outcome: ProcessOutcome): Promise<PushReceipt>;
  registerCheck?(subject: SubjectRef): Promise<RegisterResult>;
  flagRecord?(subject: SubjectRef, flag: RecordFlag): Promise<PushReceipt>;
  /* ---------- The write half. Optional, because most connectors do not have all of it. ---------- */
  /** What would be written, mapped, so a person can see it before authorising it. */
  proposeWrite?(intent: OutboundIntent, payload: PayloadField[]): Promise<WriteProposal>;
  /** Submit an authorised write. The payload is already ciphertext by the time it gets here. */
  submitWrite?(authorised: AuthorisedWrite): Promise<WriteReceipt>;
  /** The source system's own change feed, which is where an inbound proposal and an echo both come from. */
  poll?(since: Cursor): Promise<InboundChange[]>;
  /** What the source says it holds for this subject, against what we believe it holds. */
  reconcile?(subject: SubjectRef): Promise<ReconciliationReport>;
}

/** Product copy for the Connectors screen: how this would connect for real. */
export interface ConnectorNarrative {
  authModel: string;
  direction: 'inbound' | 'outbound' | 'both';
  cadence: string;
  notes: string;
}
