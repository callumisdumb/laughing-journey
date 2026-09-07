/**
 * Small constructors with sensible defaults so scenarios stay readable.
 * Every record is synthetic: true.
 */
import type {
  Action,
  Address,
  Agency,
  AuditEntry,
  ChronologyAnalysis,
  ChronologyEvent,
  ConnectorEvent,
  EventType,
  Household,
  InboundChange,
  LawfulBasisRecord,
  OutboundWrite,
  Meeting,
  Person,
  Plan,
  Relationship,
  RiskAssessment,
  SharingRecord,
  Significance,
  ViewsRecord,
  Visibility,
} from '@mas/domain';
import { classificationOfShare, officialSensitive } from '@mas/domain';
import type { BuildContext } from './context';

export type Partialish<T, K extends keyof T> = Omit<T, K | 'synthetic'> & Partial<Pick<T, K>>;

export function makeAddress(ctx: BuildContext, a: Omit<Address, 'id' | 'synthetic'> & { id?: string }): Address {
  const addr: Address = { id: a.id ?? ctx.ids.next('adr'), synthetic: true, line1: a.line1, line2: a.line2, town: a.town, postcode: a.postcode };
  ctx.data.addresses.push(addr);
  return addr;
}

export function makePerson(
  ctx: BuildContext,
  p: Partialish<Person, 'id' | 'aliases' | 'addressHistory' | 'communicationNeeds' | 'alerts' | 'contact' | 'createdAt' | 'sex' | 'lifeStage'>,
): Person {
  const person: Person = {
    id: p.id ?? ctx.ids.next('per'),
    synthetic: true,
    givenName: p.givenName,
    familyName: p.familyName,
    preferredName: p.preferredName,
    aliases: p.aliases ?? [],
    pronouns: p.pronouns,
    lifeStage: p.lifeStage ?? 'adult',
    dateOfBirth: p.dateOfBirth,
    expectedDeliveryDate: p.expectedDeliveryDate,
    sex: p.sex ?? 'not-recorded',
    chi: p.chi,
    addressHistory: p.addressHistory ?? [],
    householdId: p.householdId,
    communicationNeeds: p.communicationNeeds ?? { needs: [] },
    alerts: p.alerts ?? [],
    contact: p.contact ?? {},
    gpPractice: p.gpPractice,
    school: p.school,
    deceased: p.deceased,
    createdAt: p.createdAt ?? ctx.nowIso,
  };
  ctx.data.people.push(person);
  return person;
}

export function relate(ctx: BuildContext, fromPersonId: string, toPersonId: string, type: Relationship['type'], extra: Partial<Relationship> = {}): Relationship {
  const r: Relationship = { id: ctx.ids.next('rel'), synthetic: true, fromPersonId, toPersonId, type, ...extra };
  ctx.data.relationships.push(r);
  return r;
}

export interface EventInput {
  id?: string;
  subjectIds: string[];
  occurredAt: string;
  hasTime?: boolean;
  approximate?: boolean;
  recordedAt?: string;
  agency: Agency;
  sourceSystem?: ChronologyEvent['sourceSystem'];
  recordedByUserId?: string;
  recordedByName: string;
  eventType: EventType;
  title: string;
  detail: string;
  response?: string;
  outcome?: string;
  significance?: Significance;
  significanceReason?: string;
  linkedPersonIds?: string[];
  linkedProcessIds?: string[];
  visibility?: Visibility;
  lawfulBasisId?: string;
  evidenceRefs?: ChronologyEvent['evidenceRefs'];
}

export function makeEvent(ctx: BuildContext, e: EventInput): ChronologyEvent {
  const recordedAt = e.recordedAt ?? e.occurredAt;
  const ev: ChronologyEvent = {
    id: e.id ?? ctx.ids.next('evt'),
    synthetic: true,
    subjectIds: e.subjectIds,
    occurredAt: e.occurredAt,
    hasTime: e.hasTime ?? (/T\d\d:\d\d/.test(e.occurredAt) && !e.occurredAt.includes('T00:00:00')),
    approximate: e.approximate ?? false,
    recordedAt,
    agency: e.agency,
    sourceSystem: e.sourceSystem ?? 'manual',
    recordedByUserId: e.recordedByUserId,
    recordedByName: e.recordedByName,
    eventType: e.eventType,
    title: e.title,
    detail: e.detail,
    response: e.response,
    outcome: e.outcome,
    significance: e.significance ?? 'moderate',
    significanceReason: e.significanceReason,
    linkedPersonIds: e.linkedPersonIds ?? [],
    linkedProcessIds: e.linkedProcessIds ?? [],
    evidenceRefs: e.evidenceRefs ?? [],
    visibility: e.visibility ?? 'agency-only',
    lawfulBasisId: e.lawfulBasisId,
    versions: [{ at: recordedAt, byUserId: e.recordedByUserId, byName: e.recordedByName, change: 'Recorded' }],
  };
  ctx.data.events.push(ev);
  return ev;
}

export function makeAnalysis(ctx: BuildContext, a: Partialish<ChronologyAnalysis, 'id'>): ChronologyAnalysis {
  const an: ChronologyAnalysis = { ...a, id: a.id ?? ctx.ids.next('ana'), synthetic: true };
  ctx.data.analyses.push(an);
  return an;
}

export function makeMeeting(ctx: BuildContext, m: Partialish<Meeting, 'id' | 'agenda' | 'preMeetingRequests' | 'pack' | 'informationShared' | 'decisions' | 'actionIds' | 'viewsRecordIds' | 'distribution' | 'invitees' | 'minute'>): Meeting {
  const mt: Meeting = {
    ...m,
    id: m.id ?? ctx.ids.next('mtg'),
    synthetic: true,
    invitees: m.invitees ?? [],
    agenda: m.agenda ?? [],
    preMeetingRequests: m.preMeetingRequests ?? [],
    pack: m.pack ?? [],
    informationShared: m.informationShared ?? [],
    decisions: m.decisions ?? [],
    actionIds: m.actionIds ?? [],
    viewsRecordIds: m.viewsRecordIds ?? [],
    minute: m.minute ?? { status: 'not-started' },
    distribution: m.distribution ?? [],
  };
  ctx.data.meetings.push(mt);
  return mt;
}

export function makeAction(ctx: BuildContext, a: Partialish<Action, 'id' | 'status' | 'createdAt' | 'createdByName'>): Action {
  const ac: Action = {
    ...a,
    id: a.id ?? ctx.ids.next('act'),
    synthetic: true,
    status: a.status ?? 'open',
    createdAt: a.createdAt ?? ctx.nowIso,
    createdByName: a.createdByName ?? 'System',
  };
  ctx.data.actions.push(ac);
  return ac;
}

export function makePlan(ctx: BuildContext, p: Partialish<Plan, 'id' | 'status'>): Plan {
  const pl: Plan = { ...p, id: p.id ?? ctx.ids.next('pln'), synthetic: true, status: p.status ?? 'active' };
  ctx.data.plans.push(pl);
  return pl;
}

export function makeRisk(ctx: BuildContext, r: Partialish<RiskAssessment, 'id' | 'evidenceRefs'>): RiskAssessment {
  const ra: RiskAssessment = { ...r, id: r.id ?? ctx.ids.next('ra'), synthetic: true, evidenceRefs: r.evidenceRefs ?? [] };
  ctx.data.riskAssessments.push(ra);
  return ra;
}

export function makeViews(ctx: BuildContext, v: Partialish<ViewsRecord, 'id'>): ViewsRecord {
  const vr: ViewsRecord = { ...v, id: v.id ?? ctx.ids.next('vw'), synthetic: true };
  ctx.data.viewsRecords.push(vr);
  return vr;
}

export function makeLawfulBasis(
  ctx: BuildContext,
  lb: Partialish<LawfulBasisRecord, 'id' | 'createdAt' | 'article10Criminal' | 'consentStatus' | 'classification' | 'accessRestriction'>,
): LawfulBasisRecord {
  const rec: LawfulBasisRecord = {
    ...lb,
    id: lb.id ?? ctx.ids.next('lb'),
    synthetic: true,
    createdAt: lb.createdAt ?? ctx.nowIso,
    article10Criminal: lb.article10Criminal ?? 'not applicable',
    // Every lawful basis in this product concerns case content, so Official-Sensitive is the floor.
    classification: lb.classification ?? officialSensitive(),
    accessRestriction: lb.accessRestriction ?? 'none',
    consentStatus: lb.consentStatus ?? 'not-required',
  };
  ctx.data.lawfulBases.push(rec);
  return rec;
}

export function makeShare(ctx: BuildContext, s: Partialish<SharingRecord, 'id' | 'status' | 'createdAt' | 'channel' | 'classification' | 'accessRestriction'>): SharingRecord {
  // Copied from the process at the moment of the share, never resolved later: the record has to say
  // what went out under what marking even if the source is raised afterwards.
  const source = ctx.data.processes.find((p) => p.id === s.processId);
  const carried = source ? classificationOfShare(source) : { classification: officialSensitive(), accessRestriction: 'none' as const };
  const rec: SharingRecord = {
    ...s,
    id: s.id ?? ctx.ids.next('shr'),
    synthetic: true,
    status: s.status ?? 'sent',
    createdAt: s.createdAt ?? ctx.nowIso,
    channel: s.channel ?? 'in-app',
    classification: s.classification ?? carried.classification,
    accessRestriction: s.accessRestriction ?? carried.accessRestriction,
  };
  ctx.data.sharingRecords.push(rec);
  return rec;
}

export function makeConnectorEvent(ctx: BuildContext, c: Partialish<ConnectorEvent, 'id' | 'status'>): ConnectorEvent {
  const rec: ConnectorEvent = { ...c, id: c.id ?? ctx.ids.next('cev'), synthetic: true, status: c.status ?? 'pending' };
  ctx.data.connectorEvents.push(rec);
  return rec;
}

/**
 * An outbound write, at whatever delivery state the scenario needs it in.
 *
 * The seed carries one of each interesting state on purpose: an acknowledged write, so the
 * confirmation line has something to say; one waiting for authorisation, because that is the state
 * the demo authorises; and a failure, because a product that only ever shows the happy path is a
 * product nobody believes about the unhappy one.
 */
export function makeOutbound(ctx: BuildContext, o: Partialish<OutboundWrite, 'id' | 'synthetic' | 'origin' | 'attempts' | 'proposedAt'>): OutboundWrite {
  const rec: OutboundWrite = {
    ...o,
    id: o.id ?? ctx.ids.next('out'),
    synthetic: true,
    origin: 'person360',
    attempts: o.attempts ?? 0,
    proposedAt: o.proposedAt ?? ctx.nowIso,
  };
  ctx.data.outbox.push(rec);
  return rec;
}

/** A change waiting in the inbound queue: a case opened in a partner system, or our own write back. */
export function makeInbound(ctx: BuildContext, c: Partialish<InboundChange, 'id' | 'synthetic' | 'status' | 'receivedAt'>): InboundChange {
  const rec: InboundChange = {
    ...c,
    id: c.id ?? ctx.ids.next('inb'),
    synthetic: true,
    status: c.status ?? 'pending',
    receivedAt: c.receivedAt ?? ctx.nowIso,
  };
  ctx.data.inbound.push(rec);
  return rec;
}

export function makeAudit(ctx: BuildContext, a: Partialish<AuditEntry, 'id' | 'restricted'>): AuditEntry {
  const rec: AuditEntry = { ...a, id: a.id ?? ctx.ids.next('aud'), synthetic: true, restricted: a.restricted ?? false };
  ctx.data.audit.push(rec);
  return rec;
}

/**
 * A household with dated memberships, which is the only kind there is.
 *
 * Each member's start date comes from their own address history for this address where they have
 * one, because that is the date the seed already asserts they moved in, and a household membership
 * that disagreed with the address history would be two answers to one question. Where a person has
 * no period for the address, the household's own start date is used.
 */
export function makeHousehold(
  ctx: BuildContext,
  h: { id?: string; addressId: string; label?: string; from: string; memberIds: string[] },
): Household {
  const members = h.memberIds.map((personId) => {
    const person = ctx.data.people.find((p) => p.id === personId);
    const period = person?.addressHistory.find((a) => a.addressId === h.addressId);
    return { personId, from: period?.from ?? h.from, to: period?.to };
  });
  const household: Household = { id: h.id ?? ctx.ids.next('hh'), synthetic: true, addressId: h.addressId, members, label: h.label };
  ctx.data.households.push(household);
  return household;
}

/** Synthetic CHI: ddmmyy + 3 digits + check digit. Never a real number. */
export function syntheticChi(ctx: BuildContext, dateOfBirth: string, sex: Person['sex']): string {
  const [y, m, d] = dateOfBirth.split('-');
  const serial = ctx.rng.int(100, 999);
  const ninth = sex === 'male' ? ctx.rng.pick([1, 3, 5, 7, 9]) : ctx.rng.pick([0, 2, 4, 6, 8]);
  return `${d}${m}${(y ?? '').slice(2)}${String(serial).slice(0, 2)}${ninth}${ctx.rng.int(0, 9)}`;
}

/** Offset-aware ISO date-time for a Europe/London local time (BST from late March to late October). */
export function at(date: string, time = '09:00'): string {
  const month = Number(date.slice(5, 7));
  const bst = month >= 4 && month <= 10;
  return `${date}T${time}:00${bst ? '+01:00' : '+00:00'}`;
}
