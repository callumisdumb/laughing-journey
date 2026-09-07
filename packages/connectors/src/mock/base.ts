import { acceptsIntent, proposalRefusals, reconcile, WRITE_CAPABILITIES, type Agency, type ConnectorHealth, type ConnectorId, type EventType, type OutboundIntent, type PayloadField, type ReconciliationReport, type Significance } from '@mas/domain';
import { t, tKey } from '@mas/messages';
import type { AuthorisedWrite, ConnectorAdapter, ConnectorCapability, ConnectorNarrative, DateWindow, ExternalEvent, ExternalPersonMatch, PersonQuery, ProcessOutcome, PushReceipt, RecordFlag, RegisterResult, SubjectRef, WriteProposal, WriteReceipt } from '../adapter';
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

/** A mapping rule as the adapter spec states it: the note a person reads comes from the catalogue, keyed on the rule id. */
export type MappingRuleSpec = Omit<MappingRule, 'note'>;

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

/**
 * Ids, capabilities, mapping rules and fixture data. Every string a person reads (the display and
 * system names, the narrative, the mapping notes) lives in the catalogue under connectors.adapters
 * and connectors.ruleNotes, keyed on these ids.
 */
export interface MockAdapterSpec {
  id: ConnectorId;
  agency: Agency;
  capabilities: ConnectorCapability[];
  /** Which way the real connection would flow; the rest of the narrative is catalogue copy. */
  direction: ConnectorNarrative['direction'];
  mapping: MappingRuleSpec[];
  events: FixtureEvent[];
  matches: FixtureMatch[];
  registers?: (subject: SubjectRef) => RegisterResult;
  /**
   * What this source system says it holds for a subject, in its own field names.
   *
   * The reconciliation screen compares this against what Person360 believes the source holds, so the
   * fixture is deliberately allowed to disagree: a reconciliation screen with nothing to reconcile
   * demonstrates nothing, and every real two-way integration lives or dies on this screen.
   */
  held?: Record<string, Record<string, string>>;
}

/** `emis-web` to `emisWeb`, `emis.consultation.safeguarding-context` to `emisConsultationSafeguardingContext`: a catalogue key segment from an id. */
export function messageSegment(id: string): string {
  return id
    .split(/[.-]/)
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

export class MockAdapter implements ConnectorAdapter {
  readonly id: ConnectorId;
  readonly agency: Agency;
  readonly capabilities: ConnectorCapability[];
  private readonly spec: MockAdapterSpec;
  private readonly segment: string;

  constructor(spec: MockAdapterSpec) {
    this.spec = spec;
    this.id = spec.id;
    this.agency = spec.agency;
    this.capabilities = spec.capabilities;
    this.segment = messageSegment(spec.id);
  }

  /** Copy is read when it is asked for, not when the module loads, so an Admin override applies. */
  get displayName(): string {
    return tKey(`connectors.adapters.${this.segment}.displayName`);
  }

  get systemName(): string {
    return tKey(`connectors.adapters.${this.segment}.systemName`);
  }

  get narrative(): ConnectorNarrative {
    return {
      authModel: tKey(`connectors.adapters.${this.segment}.authModel`),
      direction: this.spec.direction,
      cadence: tKey(`connectors.adapters.${this.segment}.cadence`),
      notes: tKey(`connectors.adapters.${this.segment}.notes`),
    };
  }

  get mapping(): MappingRule[] {
    return this.spec.mapping.map((rule) => ({ ...rule, note: tKey(`connectors.ruleNotes.${messageSegment(rule.id)}`) }));
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
        const rule = this.spec.mapping.find((r) => r.id === e.ruleId);
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

  /**
   * What would be written, mapped, with the refusals a person needs to see before authorising.
   *
   * The adapter refuses rather than the screen, because the ceiling is a fact about the far side and
   * a screen that decided for itself would be a second answer to the same question.
   */
  async proposeWrite(intent: OutboundIntent, payload: PayloadField[]): Promise<WriteProposal> {
    guard(this.id);
    await simulateLatency(`${this.id}:propose:${intent}`);
    return { connector: this.id, intent, payload, refusals: proposalRefusals({ connectorId: this.id, intent, payload }) };
  }

  /**
   * Submit an authorised write. What arrives here is a byte count, not a payload.
   *
   * That is the encryption boundary holding in the outbound direction: the payload was composed in
   * the entitled user's browser and encrypted to this gateway's key before the platform saw it, so
   * the mock API is handed ciphertext and a length. `adapters.test.ts` asserts it.
   */
  async submitWrite(authorised: AuthorisedWrite): Promise<WriteReceipt> {
    guard(this.id);
    if (!acceptsIntent(this.id, authorised.write.intent)) {
      return { accepted: false, at: new Date().toISOString(), reason: t('connectors.write.refused', { system: this.systemName, ceiling: WRITE_CAPABILITIES[this.id].ceiling }) };
    }
    await simulateLatency(`${this.id}:submit:${authorised.write.idempotencyKey}`);
    // The far side's own identifier, derived from the idempotency key so the same logical write
    // returns the same reference. That is what makes a retry a retry rather than a second episode.
    const suffix = authorised.write.idempotencyKey.split(':').at(-1)?.slice(-4).toUpperCase() ?? '0000';
    return { accepted: true, at: new Date().toISOString(), externalRef: `${this.id.toUpperCase()}-${suffix}` };
  }

  /** What the source says it holds, against what we believe it holds. */
  async reconcile(subject: SubjectRef): Promise<ReconciliationReport> {
    guard(this.id);
    await simulateLatency(`${this.id}:reconcile:${subject.personId}`);
    return reconcile({
      connectorId: this.id,
      subjectPersonId: subject.personId,
      externalRef: subject.externalId,
      checkedAt: new Date().toISOString(),
      ours: {},
      theirs: this.spec.held?.[subject.personId] ?? {},
    });
  }

  /** What this source system says it holds, for the reconciliation screen to compare against. */
  held(subject: SubjectRef): Record<string, string> {
    return this.spec.held?.[subject.personId] ?? {};
  }

  /** Every subject this system holds something for, which is what the simulator seeds itself from. */
  heldAll(): Record<string, Record<string, string>> {
    return this.spec.held ?? {};
  }

  async flagRecord(subject: SubjectRef, flag: RecordFlag): Promise<PushReceipt> {
    if (!this.capabilities.includes('flagRecord')) throw new Error(`${this.id} cannot hold flags`);
    guard(this.id);
    await simulateLatency(`${this.id}:flag:${subject.personId}`);
    return { accepted: true, receiptRef: `${this.id.toUpperCase()}-FLAG-${flag.kind}-${subject.personId.slice(-4)}`, at: new Date().toISOString(), message: t('connectors.flags.placed', { kind: flag.kind, until: flag.to ?? t('connectors.flags.furtherNotice') }) };
  }
}
