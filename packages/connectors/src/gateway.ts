/**
 * The agency-hosted connector gateway: the boundary that makes these integrations approvable.
 *
 * Data arriving from EMIS Web, ECLIPSE, iVPD, SEEMIS and the rest cannot be encrypted client-side,
 * because at the moment of ingest there is no client. That is a real hole in a design whose whole
 * claim is that the platform never sees plaintext, and it needs a real answer rather than a footnote.
 *
 * The answer is to move the encryption to where the data already is. A small component is deployed
 * inside the agency's own network, holding that agency's key. It pulls from the source system, maps
 * to the platform's event taxonomy, encrypts, and pushes ciphertext. The platform never sees
 * plaintext, and the agency never gives the platform credentials to its clinical or policing systems.
 *
 * That second half is what an NHS information governance lead will care about most. The reason these
 * integrations are hard to approve is not usually the data flowing out; it is being asked to hand a
 * supplier a service account on EMIS Web. A gateway inside the health board's network, holding the
 * health board's key, with credentials that never leave it, is a different conversation entirely.
 *
 * In this mockup the boundary is structural rather than deployed: the mock adapters run
 * "gateway-side" and their output goes through `encryptAtGateway` before the mock API sees it. A
 * test asserts the mock API receives only ciphertext, so the data path is right even though there is
 * no network between the two halves.
 */
import { encryptRecord, type EncryptedRecord, type PublicKey } from '@mas/crypto';
import { classificationTag, officialSensitive, type Agency, type ConnectorId } from '@mas/domain';
import type { ExternalEvent } from './adapter';

/** Where a piece of code runs, which is the whole point of this module. */
export type Side = 'gateway' | 'platform';

/**
 * A gateway, as deployed. One per agency, inside that agency's network.
 *
 * `holdsSourceCredentials` is true and says so: the credentials for EMIS Web or iVPD live here and
 * are never sent to the platform. `agencyKey` is the public half of the agency's key pair, which is
 * what inbound events are encrypted to; the private half stays with the agency.
 */
export interface Gateway {
  agency: Agency;
  connectors: ConnectorId[];
  agencyKey: PublicKey;
  holdsSourceCredentials: true;
  /** Where the component runs, for the deployment picture on the Connectors screen. */
  network: string;
}

/** An event as it crosses the boundary: ciphertext, plus the little the platform needs to route it. */
export interface GatewayEnvelope {
  /** Which gateway sent it, so the platform can check it came from where it claims. */
  agency: Agency;
  connector: ConnectorId;
  /** The encrypted event. The platform holds no key that opens it. */
  record: EncryptedRecord;
  /** Bucketed to the day. The platform must know roughly when, not exactly when. */
  receivedOn: string;
}

/**
 * Encrypt an event gateway-side.
 *
 * This runs inside the agency's network in a deployment. The event is encrypted to the agency's own
 * key and to the platform-side principals entitled to receive it, which for a connector event is the
 * inbox of the practitioners the need-to-know rules place on the relevant case. The platform stores
 * the envelope and can route it; it cannot read it.
 */
export function encryptAtGateway(gateway: Gateway, connector: ConnectorId, event: ExternalEvent, recipients: readonly PublicKey[], receivedAt: string): GatewayEnvelope {
  return {
    agency: gateway.agency,
    connector,
    record: encryptRecord(
      {
        // The source system's own reference, which the agency already holds and the platform needs
        // in order to deduplicate. It says nothing about the event.
        id: event.externalRef,
        // Coarse: "connector-event", never the clinical code or the incident type.
        type: 'connector-event',
        classification: classificationTag(officialSensitive(), false),
        generation: 1,
        updatedAt: receivedAt.slice(0, 10),
        linkedIds: [],
      },
      JSON.stringify(event),
      [gateway.agencyKey, ...recipients],
    ),
    receivedOn: receivedAt.slice(0, 10),
  };
}

/**
 * What the platform can see of an envelope: which agency, which connector, roughly when, and how
 * many principals hold a key. Nothing about the event itself.
 *
 * This is the same shape as the "What the host can see" screen shows for records, and for the same
 * reason: the leakage is stated rather than glossed over.
 */
export interface PlatformViewOfEnvelope {
  agency: Agency;
  connector: ConnectorId;
  receivedOn: string;
  keyHolders: number;
  ciphertextBytes: number;
}

export function platformView(envelope: GatewayEnvelope): PlatformViewOfEnvelope {
  return {
    agency: envelope.agency,
    connector: envelope.connector,
    receivedOn: envelope.receivedOn,
    keyHolders: envelope.record.wrappedKeys.length,
    ciphertextBytes: envelope.record.sealed.ciphertext.length,
  };
}

/** The deployment picture, for the "how this would connect for real" copy on the Connectors screen. */
export interface DeploymentNote {
  runsAt: Side;
  what: string;
}

export const GATEWAY_DEPLOYMENT: DeploymentNote[] = [
  { runsAt: 'gateway', what: 'Holds the credentials for the source system. They never leave the agency network.' },
  { runsAt: 'gateway', what: 'Pulls records from the source system on the agreed cadence.' },
  { runsAt: 'gateway', what: "Maps them to the platform's event taxonomy, so the mapping is auditable by the agency that owns the data." },
  { runsAt: 'gateway', what: 'Encrypts to the agency key and to the entitled platform principals.' },
  { runsAt: 'gateway', what: 'Pushes ciphertext over mutual TLS.' },
  { runsAt: 'platform', what: 'Stores the envelope and routes it to the right inboxes from the wrapped key list.' },
  { runsAt: 'platform', what: 'Cannot read the event: it holds no key that opens one.' },
];

/* ---------- Outbound: the same boundary, in the other direction ---------- */

/**
 * An outbound write as it crosses the boundary: ciphertext, plus the little the platform needs to
 * route it.
 *
 * Bidirectionality must not become the hole in the encryption story. The inbound design has the
 * agency gateway encrypting before anything reaches the platform; if the outbound path composed its
 * payload platform-side, the platform would hold plaintext for exactly the records it claims never
 * to see. So the payload is composed client-side by the entitled user, encrypted to the target
 * gateway's public key, and relayed by the platform as ciphertext. The gateway decrypts and writes.
 *
 * The platform can route it and cannot read it, which is the same sentence as the inbound side and
 * is what makes the claim survive the feature.
 */
export interface OutboundEnvelope {
  /** Which gateway it is for, so the platform can route it. */
  agency: Agency;
  connector: ConnectorId;
  /** The encrypted payload. The platform holds no key that opens it. */
  record: EncryptedRecord;
  /**
   * The idempotency key, deliberately outside the ciphertext.
   *
   * The platform has to be able to match an acknowledgement, and a duplicate suppressed only at the
   * far side is a duplicate that has already been written. The key names no person and describes no
   * event: it is a connector, an intent and a record id, which the platform already holds.
   */
  idempotencyKey: string;
  /** Bucketed to the day, as inbound is. The platform must know roughly when, not exactly when. */
  submittedOn: string;
}

/**
 * Compose and encrypt an outbound write, client-side.
 *
 * `payload` is a JSON string the caller has already built from records it can read, which is the
 * point: the caller is the entitled user's browser, holding keys the platform does not have. This
 * function is the last place the payload exists in the clear.
 */
export function encryptForGateway(
  target: { agency: Agency; agencyKey: PublicKey },
  connector: ConnectorId,
  input: { id: string; idempotencyKey: string; payload: string; submittedAt: string },
): OutboundEnvelope {
  return {
    agency: target.agency,
    connector,
    idempotencyKey: input.idempotencyKey,
    record: encryptRecord(
      {
        id: input.id,
        // Coarse, as inbound is: "outbound-write", never the intent's own subject or its fields.
        type: 'outbound-write',
        classification: classificationTag(officialSensitive(), false),
        generation: 1,
        updatedAt: input.submittedAt.slice(0, 10),
        linkedIds: [],
      },
      input.payload,
      [target.agencyKey],
    ),
    submittedOn: input.submittedAt.slice(0, 10),
  };
}

/** What the platform can see of an outbound envelope. As with inbound, the leakage is stated. */
export interface PlatformViewOfOutbound {
  agency: Agency;
  connector: ConnectorId;
  submittedOn: string;
  idempotencyKey: string;
  ciphertextBytes: number;
}

export function platformViewOutbound(envelope: OutboundEnvelope): PlatformViewOfOutbound {
  return {
    agency: envelope.agency,
    connector: envelope.connector,
    submittedOn: envelope.submittedOn,
    idempotencyKey: envelope.idempotencyKey,
    ciphertextBytes: envelope.record.sealed.ciphertext.length,
  };
}

export const OUTBOUND_DEPLOYMENT: DeploymentNote[] = [
  { runsAt: 'platform', what: "The payload is composed in the entitled user's browser, from records only they can decrypt." },
  { runsAt: 'platform', what: "It is encrypted to the target gateway's public key before it leaves the browser." },
  { runsAt: 'platform', what: 'The platform relays the ciphertext and records the delivery state. It cannot read the payload.' },
  { runsAt: 'gateway', what: 'The gateway decrypts with the agency key and writes to the source system with the agency\'s own credentials.' },
  { runsAt: 'gateway', what: "It returns the source system's own identifier, which is what the platform records as an acknowledgement." },
];
