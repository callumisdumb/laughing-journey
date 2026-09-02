import type { Agency, ConnectorHealth, ConnectorId, EventType, Significance } from '@mas/domain';

export type ConnectorCapability = 'lookupPerson' | 'pullEvents' | 'pushOutcome' | 'registerCheck' | 'flagRecord';

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
}

/** Product copy for the Connectors screen: how this would connect for real. */
export interface ConnectorNarrative {
  authModel: string;
  direction: 'inbound' | 'outbound' | 'both';
  cadence: string;
  notes: string;
}
