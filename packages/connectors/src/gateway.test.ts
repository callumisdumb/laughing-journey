/**
 * The gateway boundary: the platform receives ciphertext, and that is asserted rather than asserted
 * in a comment.
 *
 * The claim this module makes is the one an NHS information governance lead will test hardest: that
 * the platform never sees a clinical record in the clear, and never holds credentials to EMIS Web.
 * So the test opens the envelope from both sides and checks what each can actually read.
 */
import { CryptoError, generateKeyPair, openRecord, toBase64Url } from '@mas/crypto';
import { describe, expect, it } from 'vitest';
import type { ExternalEvent } from './adapter';
import { GATEWAY_DEPLOYMENT, OUTBOUND_DEPLOYMENT, encryptAtGateway, encryptForGateway, platformView, platformViewOutbound, type Gateway } from './gateway';

const health = generateKeyPair('agency', 'p:agy:health');
const practitioner = generateKeyPair('user', 'p:usr:janet');
const platform = generateKeyPair('user', 'p:usr:platform-operator');

const gateway: Gateway = {
  agency: 'health',
  connectors: ['emis-web'],
  agencyKey: health.publicKey,
  holdsSourceCredentials: true,
  network: 'NHS Clydeshore internal network',
};

const event: ExternalEvent = {
  externalRef: 'EMIS-2026-0993',
  occurredAt: '2026-08-14T11:20:00+01:00',
  hasTime: true,
  source: { code: 'XaKZP', term: 'Adult safeguarding concern', practice: 'Auchentorran Medical Practice' },
  mapped: { eventType: 'health.attendance', title: 'Safeguarding concern recorded', detail: 'Concern coded at a routine appointment.', significance: 'moderate', mappingRule: 'emis.safeguarding.code' },
};

describe('the connector gateway', () => {
  const envelope = encryptAtGateway(gateway, 'emis-web', event, [practitioner.publicKey], '2026-08-14T11:25:00+01:00');

  it('hands the platform ciphertext and nothing else', () => {
    const dump = JSON.stringify(envelope, (_key: string, value: unknown) => (value instanceof Uint8Array ? toBase64Url(value) : value));
    // The clinical code, the term and the practice name are what an operator must never see.
    expect(dump).not.toContain('XaKZP');
    expect(dump).not.toContain('Adult safeguarding concern');
    expect(dump).not.toContain('Auchentorran Medical Practice');
  });

  it('opens for the agency that sent it and for the entitled practitioner', () => {
    expect(JSON.parse(openRecord(envelope.record, health.privateKey, health.publicKey))).toEqual(event);
    expect(JSON.parse(openRecord(envelope.record, practitioner.privateKey, practitioner.publicKey))).toEqual(event);
  });

  it('does not open for the platform operator', () => {
    expect(() => openRecord(envelope.record, platform.privateKey, platform.publicKey)).toThrow(CryptoError);
  });

  it('shows the platform only what it needs to route the envelope', () => {
    const view = platformView(envelope);
    expect(Object.keys(view).sort()).toEqual(['agency', 'ciphertextBytes', 'connector', 'keyHolders', 'receivedOn']);
    // Bucketed to the day: the platform must know roughly when, not exactly when.
    expect(view.receivedOn).toBe('2026-08-14');
    expect(view.keyHolders).toBe(2);
  });

  it('keeps the source credentials on the agency side, which is what makes this approvable', () => {
    // The hard part of these integrations is not the data flowing out; it is being asked to hand a
    // supplier a service account on a clinical system.
    expect(gateway.holdsSourceCredentials).toBe(true);
    const platformSteps = GATEWAY_DEPLOYMENT.filter((note) => note.runsAt === 'platform');
    expect(platformSteps.some((note) => note.what.includes('credentials'))).toBe(false);
    expect(GATEWAY_DEPLOYMENT.some((note) => note.runsAt === 'gateway' && note.what.includes('never leave the agency network'))).toBe(true);
  });
});

/**
 * The same boundary, outbound, which is where bidirectionality usually becomes the hole in the
 * story.
 *
 * If the outbound payload were composed platform-side, the platform would hold plaintext for exactly
 * the records it claims never to see, and everything the inbound test proves would be undone by the
 * feature that came after it. So the payload is composed in the entitled user's browser, encrypted
 * to the target gateway's key, and relayed as ciphertext. This asserts it, mirroring the inbound one.
 */
describe('the gateway boundary, outbound', () => {
  const council = generateKeyPair('agency', 'p:agy:social-work');
  const payload = JSON.stringify([
    { field: 'Episode.Type', value: 'ASP', from: 'process.type' },
    { field: 'Episode.CaseReference', value: 'ASP-2026-0217', from: 'process.reference' },
    { field: 'Episode.AllocatedWorker', value: 'Moira Gilmour', from: 'process.leadUserId' },
  ]);
  const envelope = encryptForGateway(
    { agency: 'social-work', agencyKey: council.publicKey },
    'eclipse',
    { id: 'out_1', idempotencyKey: 'eclipse:open-process:prc_asp_marion', payload, submittedAt: '2026-09-04T10:05:00+01:00' },
  );

  it('relays ciphertext, so the platform never sees the payload it is carrying', () => {
    const dump = JSON.stringify(envelope, (_key: string, value: unknown) => (value instanceof Uint8Array ? toBase64Url(value) : value));
    expect(dump).not.toContain('ASP-2026-0217');
    expect(dump).not.toContain('Moira Gilmour');
    expect(dump).not.toContain('Episode.AllocatedWorker');
  });

  it('opens for the gateway that will write it, and for nobody else', () => {
    expect(openRecord(envelope.record, council.privateKey, council.publicKey)).toBe(payload);
    expect(() => openRecord(envelope.record, platform.privateKey, platform.publicKey)).toThrow(CryptoError);
    // Not even the health gateway, which is a different agency holding a different key.
    expect(() => openRecord(envelope.record, health.privateKey, health.publicKey)).toThrow(CryptoError);
  });

  it('keeps the idempotency key outside the ciphertext, and nothing else with it', () => {
    // The platform has to match an acknowledgement, and a duplicate suppressed only at the far side
    // is a duplicate that has already been written. The key names no person and describes no event.
    const view = platformViewOutbound(envelope);
    expect(Object.keys(view).sort()).toEqual(['agency', 'ciphertextBytes', 'connector', 'idempotencyKey', 'submittedOn']);
    expect(view.idempotencyKey).toBe('eclipse:open-process:prc_asp_marion');
    expect(view.submittedOn).toBe('2026-09-04');
  });

  it('says where each half of the outbound path runs', () => {
    // The composition and the encryption happen before the platform; the write happens after it.
    expect(OUTBOUND_DEPLOYMENT.filter((n) => n.runsAt === 'gateway')).toHaveLength(2);
    expect(OUTBOUND_DEPLOYMENT.some((n) => n.what.includes("agency's own credentials"))).toBe(true);
  });
});
