import { tKey } from '@mas/messages';
import { keySegment, type ConnectorId } from '../enums';

/**
 * What each connector may write, and the ceiling on it.
 *
 * The honesty of this table is the point. A product that says it writes to ViSOR loses the room, and
 * anybody who has run an integration programme trusts a supplier who says iVPD is notify-only more
 * than one who claims everything writes. So the ceilings are real, they differ by connector, and the
 * reason for each is copy on the connector card rather than a footnote in a specification.
 *
 * The ceiling is not a permission. It is a statement about what the far side would actually accept
 * from a third party product, which is a different and harder question than what its API exposes.
 */
export type WriteCeiling =
  /** Full episode creation, stage changes, allocation, closure. Same controller, the council. */
  | 'full'
  /** Legacy and no longer developed: a scheduled file exchange rather than a live API. */
  | 'batch'
  /** A wellbeing flag and a named-person alert. Never narrative. */
  | 'flag-and-alert'
  /** A coded flag plus a task or document, only after accreditation. Never clinical narrative. */
  | 'coded-flag-accredited'
  /** An alert on the record and nothing else. */
  | 'alert'
  /** A notification into a queue carrying a reference. Not a write into the record. */
  | 'notify'
  /** A referral submitted on its own form. */
  | 'referral'
  /** Nothing goes out. The reference is held and read. */
  | 'none';

export const WRITE_CEILINGS = ['full', 'batch', 'flag-and-alert', 'coded-flag-accredited', 'alert', 'notify', 'referral', 'none'] as const;

export interface WriteCapability {
  ceiling: WriteCeiling;
  /** The fields this connector will accept, in the target system's own names. */
  fields: string[];
  /**
   * Set where the ceiling depends on an approval this project has not obtained or verified. The
   * connector card shows it as an unverified claim rather than as a capability.
   */
  todoVerify?: boolean;
}

/**
 * The capability matrix. Reading down the ceiling column is the argument.
 *
 * ECLIPSE and its peers are full two-way because the controller is the same council. EMIS Web is
 * technically writable through the Partner Programme and only after accreditation covering security,
 * privacy and clinical safety, with a named Clinical Safety Officer and a hazard log, so it is
 * marked for verification rather than claimed. iVPD is notify-only because a third party product
 * writing into a police vulnerable persons database is not a realistic ask, and pretending otherwise
 * damages everything else in the pitch. ViSOR is never.
 */
export const WRITE_CAPABILITIES: Record<ConnectorId, WriteCapability> = {
  eclipse: {
    ceiling: 'full',
    fields: ['Episode.Type', 'Episode.OpenedDate', 'Episode.Stage', 'Episode.AllocatedWorker', 'Episode.CaseReference', 'Episode.ClosedDate', 'Episode.ClosureReason'],
  },
  carefirst: { ceiling: 'batch', fields: ['CASE_REF', 'CASE_STATUS', 'CASE_OPENED', 'CASE_CLOSED'] },
  seemis: { ceiling: 'flag-and-alert', fields: ['Wellbeing.Flag', 'Wellbeing.From', 'NamedPerson.Alert', 'NamedPerson.Contact'] },
  'emis-web': {
    ceiling: 'coded-flag-accredited',
    fields: ['Problem.Code', 'Task.Assignee', 'Task.Summary', 'Document.Title'],
    // The NHS England IM1 pairing route is an England programme. The Scottish route runs through the
    // EMIS Partner Programme and national contracting, which this project has not confirmed.
    todoVerify: true,
  },
  trakcare: { ceiling: 'alert', fields: ['Alert.Type', 'Alert.Text', 'Alert.From', 'Alert.To'] },
  morse: { ceiling: 'alert', fields: ['Alert.Type', 'Alert.Text', 'Alert.From', 'Alert.To'] },
  ivpd: { ceiling: 'notify', fields: ['Notification.Queue', 'Notification.Reference', 'Notification.Summary'] },
  scra: { ceiling: 'referral', fields: ['Referral.Grounds', 'Referral.Child', 'Referral.Reporter', 'Referral.Summary'] },
  visor: { ceiling: 'none', fields: [] },
  opg: { ceiling: 'none', fields: [] },
};

export function writeCeilingLabel(ceiling: WriteCeiling): string {
  return tKey(`connectors.write.ceilingLabels.${keySegment(ceiling)}`);
}

/** Why the ceiling is where it is. The sentence a sceptical integration lead reads first. */
export function writeCeilingReason(ceiling: WriteCeiling): string {
  return tKey(`connectors.write.ceilingWhy.${keySegment(ceiling)}`);
}

export function canWrite(connectorId: ConnectorId): boolean {
  return WRITE_CAPABILITIES[connectorId].ceiling !== 'none';
}

/** What a write to this connector would be: an episode, a flag, an alert, a notification, a referral. */
export const OUTBOUND_INTENTS = ['open-process', 'stage-change', 'close-process', 'flag', 'alert', 'notify', 'referral'] as const;
export type OutboundIntent = (typeof OUTBOUND_INTENTS)[number];

export function outboundIntentLabel(intent: OutboundIntent): string {
  return tKey(`connectors.write.intents.${keySegment(intent)}`);
}

/**
 * The intents each ceiling permits.
 *
 * A ceiling of `alert` accepts an alert and refuses an episode, which is the point of having a
 * ceiling rather than a boolean. The refusal is a fact about the far side, so it lives here rather
 * than in a screen: a new screen written by somebody who has not read this cannot get it wrong.
 */
const INTENTS_BY_CEILING: Record<WriteCeiling, OutboundIntent[]> = {
  full: ['open-process', 'stage-change', 'close-process', 'flag'],
  batch: ['open-process', 'close-process'],
  'flag-and-alert': ['flag', 'alert'],
  'coded-flag-accredited': ['flag'],
  alert: ['alert'],
  notify: ['notify'],
  referral: ['referral'],
  none: [],
};

export function intentsFor(connectorId: ConnectorId): OutboundIntent[] {
  return INTENTS_BY_CEILING[WRITE_CAPABILITIES[connectorId].ceiling];
}

export function acceptsIntent(connectorId: ConnectorId, intent: OutboundIntent): boolean {
  return intentsFor(connectorId).includes(intent);
}

/** The connectors that would accept this intent, which is what a proposal is offered for. */
export function connectorsForIntent(intent: OutboundIntent, ids: readonly ConnectorId[]): ConnectorId[] {
  return ids.filter((id) => acceptsIntent(id, intent));
}

/**
 * Field-level authority: who owns a field when both sides have changed it.
 *
 * Never last-write-wins, which in safeguarding means the most recent click beats the more informed
 * one. The source system is authoritative for the facts it owns, and Person360 is authoritative for
 * multi-agency process state. Where both sides have changed a field either owns, the conflict goes
 * to a person with both values, both timestamps and both authors.
 */
export type Authority = 'source' | 'person360' | 'either';

export interface FieldAuthority {
  /** The field in the target system's own name, which is what a reconciliation screen shows. */
  field: string;
  authority: Authority;
}

/**
 * The ownership table, per connector.
 *
 * The pattern is the same everywhere and worth stating: demographics, clinical facts and the source
 * system's own identifiers belong to the source; the multi-agency process, its stage and who else is
 * involved belong here, because no single source system knows about the others.
 */
export const FIELD_AUTHORITY: Partial<Record<ConnectorId, FieldAuthority[]>> = {
  eclipse: [
    { field: 'Client.Name', authority: 'source' },
    { field: 'Client.DateOfBirth', authority: 'source' },
    { field: 'Client.Address', authority: 'source' },
    { field: 'Episode.CaseReference', authority: 'source' },
    { field: 'Episode.AllocatedWorker', authority: 'either' },
    { field: 'Episode.Stage', authority: 'person360' },
    { field: 'Episode.Type', authority: 'person360' },
    { field: 'Episode.ClosureReason', authority: 'person360' },
  ],
  'emis-web': [
    { field: 'Patient.Name', authority: 'source' },
    { field: 'Patient.CHI', authority: 'source' },
    { field: 'Practice', authority: 'source' },
    { field: 'Problem.Code', authority: 'person360' },
  ],
  seemis: [
    { field: 'Pupil.Name', authority: 'source' },
    { field: 'Pupil.School', authority: 'source' },
    { field: 'Wellbeing.Flag', authority: 'person360' },
    { field: 'NamedPerson.Alert', authority: 'person360' },
  ],
};

export function authorityFor(connectorId: ConnectorId, field: string): Authority {
  return FIELD_AUTHORITY[connectorId]?.find((f) => f.field === field)?.authority ?? 'either';
}

export function authorityLabel(authority: Authority): string {
  // The product name is a catalogue entry, so a rebrand is one edit. Reading it here means the
  // label says "Person360 owns this field" rather than printing the placeholder, which is what a
  // key read with no arguments does and what the reconciliation screen was showing.
  return tKey(`connectors.write.authority.${keySegment(authority)}`, { product: tKey('product.name') });
}
