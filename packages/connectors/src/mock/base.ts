import type { Agency, ConnectorHealth, ConnectorId, EventType, Significance } from '@mas/domain';
import type { ConnectorAdapter, ConnectorCapability, ConnectorNarrative, DateWindow, ExternalEvent, ExternalPersonMatch, PersonQuery, ProcessOutcome, PushReceipt, RecordFlag, RegisterResult, SubjectRef } from '../adapter';
import { guard, healthFor, markSynced, simulateLatency } from './simulation';

/** One row of a source-to-platform mapping table. Rendered on the Connectors screen and in mapping.md. */
export interface MappingRule {
  id: string;
  sourceField: string;
  sourceValue: string;
  eventType: EventType;
  significance: Significance;
  note: string;
}

/** A fixture event in the source system's own vocabulary, mapped by rule id. */
export interface FixtureEvent {
  personId: string;
  externalRef: string;
  occurredAt: string;
  hasTime: boolean;
  source: Record<string, string>;
  ruleId: string;
  title: string;
  detail: string;
}

export interface FixtureMatch extends ExternalPersonMatch {
  personId: string;
}

export interface MockAdapterSpec {
  id: ConnectorId;
  displayName: string;
  systemName: string;
  agency: Agency;
  capabilities: ConnectorCapability[];
  mapping: MappingRule[];
  narrative: ConnectorNarrative;
  events: FixtureEvent[];
  matches: FixtureMatch[];
  registers?: (subject: SubjectRef) => RegisterResult;
}

export class MockAdapter implements ConnectorAdapter {
  readonly id: ConnectorId;
  readonly displayName: string;
  readonly systemName: string;
  readonly agency: Agency;
  readonly capabilities: ConnectorCapability[];
  readonly mapping: MappingRule[];
  readonly narrative: ConnectorNarrative;
  private readonly spec: MockAdapterSpec;

  constructor(spec: MockAdapterSpec) {
    this.spec = spec;
    this.id = spec.id;
    this.displayName = spec.displayName;
    this.systemName = spec.systemName;
    this.agency = spec.agency;
    this.capabilities = spec.capabilities;
    this.mapping = spec.mapping;
    this.narrative = spec.narrative;
  }

  health(): Promise<ConnectorHealth> {
    return healthFor(this.id, this.displayName, `${this.id}:health`);
  }

  async lookupPerson(query: PersonQuery): Promise<ExternalPersonMatch[]> {
    guard(this.id);
    await simulateLatency(`${this.id}:lookup:${query.familyName ?? ''}`);
    const fam = query.familyName?.toLowerCase();
    const giv = query.givenName?.toLowerCase();
    return this.spec.matches
      .filter((m) => {
        const name = m.displayName.toLowerCase();
        if (query.chi && m.source['CHI'] === query.chi) return true;
        if (fam && !name.includes(fam)) return false;
        if (giv && !name.includes(giv)) return false;
        if (query.dateOfBirth && m.dateOfBirth && m.dateOfBirth !== query.dateOfBirth) return false;
        return Boolean(fam || giv || query.chi);
      })
      .map(({ personId: _personId, ...rest }) => rest);
  }

  async pullEvents(subject: SubjectRef, window: DateWindow): Promise<ExternalEvent[]> {
    guard(this.id);
    await simulateLatency(`${this.id}:pull:${subject.personId}`);
    markSynced(this.id, new Date().toISOString());
    return this.spec.events
      .filter((e) => e.personId === subject.personId && e.occurredAt >= window.from && e.occurredAt <= window.to)
      .map((e) => {
        const rule = this.mapping.find((r) => r.id === e.ruleId);
        if (!rule) throw new Error(`${this.id}: unknown mapping rule ${e.ruleId}`);
        return {
          externalRef: e.externalRef,
          occurredAt: e.occurredAt,
          hasTime: e.hasTime,
          source: e.source,
          mapped: { eventType: rule.eventType, title: e.title, detail: e.detail, significance: rule.significance, mappingRule: rule.id },
        };
      });
  }

  async pushOutcome(outcome: ProcessOutcome): Promise<PushReceipt> {
    if (!this.capabilities.includes('pushOutcome')) throw new Error(`${this.id} cannot receive outcomes`);
    guard(this.id);
    await simulateLatency(`${this.id}:push:${outcome.processId}`);
    return { accepted: true, receiptRef: `${this.id.toUpperCase()}-RCPT-${outcome.processId.slice(-4)}`, at: new Date().toISOString() };
  }

  async registerCheck(subject: SubjectRef): Promise<RegisterResult> {
    if (!this.capabilities.includes('registerCheck') || !this.spec.registers) throw new Error(`${this.id} has no register`);
    guard(this.id);
    await simulateLatency(`${this.id}:register:${subject.personId}`);
    return this.spec.registers(subject);
  }

  async flagRecord(subject: SubjectRef, flag: RecordFlag): Promise<PushReceipt> {
    if (!this.capabilities.includes('flagRecord')) throw new Error(`${this.id} cannot hold flags`);
    guard(this.id);
    await simulateLatency(`${this.id}:flag:${subject.personId}`);
    return { accepted: true, receiptRef: `${this.id.toUpperCase()}-FLAG-${flag.kind}-${subject.personId.slice(-4)}`, at: new Date().toISOString(), message: `${flag.kind} flag placed until ${flag.to ?? 'further notice'}` };
  }
}
