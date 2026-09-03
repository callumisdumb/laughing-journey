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
import { GATEWAY_DEPLOYMENT, encryptAtGateway, platformView, type Gateway } from './gateway';

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
