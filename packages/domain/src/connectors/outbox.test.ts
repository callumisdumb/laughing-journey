import { describe, expect, it } from 'vitest';
import {
  authoriseWrite,
  authorisationRefusals,
  canTransition,
  conflicts,
  echoedWrite,
  idempotencyKey,
  isConfirmed,
  isEcho,
  markAcknowledged,
  markDeadLetter,
  markFailed,
  markSent,
  needsAttention,
  proposalRefusals,
  proposeWrite,
  reconcile,
} from './outbox';
import { acceptsIntent, canWrite, intentsFor, WRITE_CAPABILITIES } from './write';
import type { InboundChange, OutboundWrite } from '../schemas/outbox';

const BASE = {
  id: 'out_1',
  connectorId: 'eclipse' as const,
  intent: 'open-process' as const,
  subjectPersonId: 'per_aiden_boyle',
  processId: 'prc_cp_aiden',
  payload: [{ field: 'Episode.Type', value: 'CP', from: 'process.type' }],
  at: '2026-09-04T10:00:00+01:00',
  byName: 'Janet Kerr',
};

const AUTH = { at: '2026-09-04T10:05:00+01:00', byName: 'Janet Kerr', purpose: 'So the episode exists in the council system and is not double entered.', lawfulBasisId: 'lb_cp_duty' };

describe('the capability matrix, which is not symmetrical', () => {
  it('refuses to claim a write where none is realistic', () => {
    // A third party product writing into a police vulnerable persons database is not a realistic
    // ask, and a supplier who says so is trusted more than one who claims everything writes.
    expect(WRITE_CAPABILITIES.ivpd.ceiling).toBe('notify');
    expect(acceptsIntent('ivpd', 'open-process')).toBe(false);
    expect(acceptsIntent('ivpd', 'notify')).toBe(true);
    // ViSOR is never. The reference is held and read.
    expect(canWrite('visor')).toBe(false);
    expect(intentsFor('visor')).toEqual([]);
    expect(canWrite('opg')).toBe(false);
  });

  it('marks the ceiling that depends on an accreditation nobody here has obtained', () => {
    expect(WRITE_CAPABILITIES['emis-web'].ceiling).toBe('coded-flag-accredited');
    expect(WRITE_CAPABILITIES['emis-web'].todoVerify).toBe(true);
    // A coded flag, never clinical narrative authored by a non-clinician.
    expect(intentsFor('emis-web')).toEqual(['flag']);
  });

  it('gives the flagship connector the full range and the legacy one a batch', () => {
    expect(intentsFor('eclipse')).toContain('open-process');
    expect(intentsFor('eclipse')).toContain('close-process');
    expect(WRITE_CAPABILITIES.carefirst.ceiling).toBe('batch');
    expect(acceptsIntent('carefirst', 'stage-change')).toBe(false);
  });
});

describe('proposing a write', () => {
  it('refuses an intent the connector would not accept, and a field it does not have', () => {
    expect(proposalRefusals({ connectorId: 'visor', intent: 'open-process', payload: BASE.payload })).toContain('connectorRefusesIntent');
    expect(proposalRefusals({ connectorId: 'eclipse', intent: 'open-process', payload: [] })).toContain('payloadEmpty');
    // A mapping error found at the gateway is a failed write nobody can explain. Caught here.
    expect(proposalRefusals({ connectorId: 'eclipse', intent: 'open-process', payload: [{ field: 'Episode.Invented', value: 'x', from: 'y' }] })).toContain('payloadUnknownField');
    expect(proposalRefusals(BASE)).toEqual([]);
  });

  it('opens proposed, with nothing authorised and nothing sent', () => {
    const write = proposeWrite(BASE);
    expect(write.state).toBe('proposed');
    expect(write.authorisation).toBeUndefined();
    expect(write.sentAt).toBeUndefined();
    expect(needsAttention(write)).toBe(true);
    expect(isConfirmed(write)).toBe(false);
  });

  it('builds an idempotency key from what the write is about, not from a clock', () => {
    expect(proposeWrite(BASE).idempotencyKey).toBe(proposeWrite({ ...BASE, id: 'out_2', at: '2026-10-01T09:00:00+01:00' }).idempotencyKey);
    expect(idempotencyKey({ ...BASE, intent: 'close-process' })).not.toBe(idempotencyKey(BASE));
  });
});

describe('authorising a write', () => {
  it('requires a named purpose and a lawful basis, because that is what a disclosure is', () => {
    const write = proposeWrite(BASE);
    expect(authorisationRefusals(write, { ...AUTH, purpose: 'because' })).toContain('outboxPurposeRequired');
    expect(authorisationRefusals(write, { ...AUTH, lawfulBasisId: '' })).toContain('outboxLawfulBasisRequired');
    expect(authorisationRefusals(write, AUTH)).toEqual([]);
  });

  it('records who authorised it, and clears a previous failure so a retry is a retry', () => {
    const failed = markFailed(authoriseWrite(proposeWrite(BASE), AUTH), BASE.at, 'Gateway timed out');
    const again = authoriseWrite(failed, AUTH);
    expect(again.state).toBe('authorised');
    expect(again.failure).toBeUndefined();
    expect(again.authorisation?.byName).toBe('Janet Kerr');
  });
});

describe('the delivery states', () => {
  it('never lets a failure quietly become an acknowledgement', () => {
    expect(canTransition('failed', 'acknowledged')).toBe(false);
    expect(canTransition('failed', 'authorised')).toBe(true);
    expect(canTransition('failed', 'dead-letter')).toBe(true);
    // Nothing leaves without an authorisation.
    expect(canTransition('proposed', 'sent')).toBe(false);
    expect(canTransition('acknowledged', 'sent')).toBe(false);
  });

  it('confirms only on an acknowledgement carrying the far side\'s own identifier', () => {
    const sent = markSent(authoriseWrite(proposeWrite(BASE), AUTH), BASE.at, 412);
    expect(sent.relayedBytes).toBe(412);
    // Sent is not confirmed. A record whose write has not been acknowledged says so.
    expect(isConfirmed(sent)).toBe(false);
    const done = markAcknowledged(sent, '2026-09-04T14:32:00+01:00', 'CF-2026-8871');
    expect(isConfirmed(done)).toBe(true);
    expect(done.externalRef).toBe('CF-2026-8871');
    expect(needsAttention(done)).toBe(false);
  });

  it('counts the attempts on a failure and surfaces it rather than retrying into silence', () => {
    const once = markFailed(authoriseWrite(proposeWrite(BASE), AUTH), BASE.at, 'Gateway timed out');
    const twice = markFailed(authoriseWrite(once, AUTH), BASE.at, 'Gateway timed out');
    expect(twice.attempts).toBe(2);
    // The count survives the retry, so a connector that fails every time is seen to.
    expect(authoriseWrite(twice, AUTH).attempts).toBe(2);
    expect(needsAttention(twice)).toBe(true);
    expect(markDeadLetter(twice).state).toBe('dead-letter');
  });
});

describe('echo', () => {
  const change = (over: Partial<InboundChange> = {}): InboundChange => ({
    id: 'in_1',
    synthetic: true,
    connectorId: 'eclipse',
    kind: 'process-proposal',
    receivedAt: '2026-09-04T15:00:00+01:00',
    externalRef: 'CF-2026-8871',
    subjectHint: { displayName: 'BOYLE, Aiden', externalId: 'ECL-119203' },
    payload: [],
    status: 'pending',
    ...over,
  });

  const acknowledged: OutboundWrite = markAcknowledged(markSent(authoriseWrite(proposeWrite(BASE), AUTH), BASE.at, 412), BASE.at, 'CF-2026-8871');

  it('recognises our own write coming back, by the key we issued', () => {
    expect(isEcho(change({ echoOf: acknowledged.idempotencyKey }), [acknowledged])).toBe(true);
    expect(echoedWrite(change({ echoOf: acknowledged.idempotencyKey }), [acknowledged])?.id).toBe('out_1');
  });

  it('recognises it by the reference too, for a source system that does not return the key', () => {
    expect(isEcho(change(), [acknowledged])).toBe(true);
  });

  it('does not mistake a genuine new episode for an echo', () => {
    expect(isEcho(change({ externalRef: 'CF-2026-9999' }), [acknowledged])).toBe(false);
    // Nor one from a different connector that happens to share a reference format.
    expect(isEcho(change({ connectorId: 'carefirst' }), [acknowledged])).toBe(false);
  });
});

describe('reconciliation', () => {
  const ours = { 'Client.Name': 'Aiden Boyle', 'Episode.Stage': 'core-group', 'Episode.AllocatedWorker': 'Janet Kerr' };

  it('says nothing where the two sides agree', () => {
    expect(reconcile({ connectorId: 'eclipse', subjectPersonId: 'per_aiden_boyle', checkedAt: BASE.at, ours, theirs: ours }).divergences).toEqual([]);
  });

  it('names who owns each divergent field rather than resolving it', () => {
    const report = reconcile({
      connectorId: 'eclipse',
      subjectPersonId: 'per_aiden_boyle',
      checkedAt: BASE.at,
      ours,
      theirs: { ...ours, 'Client.Name': 'Aiden Boyle-Kerr', 'Episode.Stage': 'cppm' },
    });
    const name = report.divergences.find((d) => d.field === 'Client.Name')!;
    const stage = report.divergences.find((d) => d.field === 'Episode.Stage')!;
    // Demographics belong to the source. Multi-agency process state belongs here.
    expect(name.authority).toBe('source');
    expect(stage.authority).toBe('person360');
    expect(report.divergences.every((d) => !d.conflict)).toBe(true);
  });

  it('raises a conflict only where both sides changed a field either owns', () => {
    const report = reconcile({
      connectorId: 'eclipse',
      subjectPersonId: 'per_aiden_boyle',
      checkedAt: BASE.at,
      ours,
      theirs: { ...ours, 'Episode.AllocatedWorker': 'Moira Gilmour' },
      bothChanged: ['Episode.AllocatedWorker'],
    });
    expect(conflicts(report)).toHaveLength(1);
    expect(conflicts(report)[0]).toMatchObject({ field: 'Episode.AllocatedWorker', ours: 'Janet Kerr', theirs: 'Moira Gilmour', authority: 'either' });
  });

  it('treats an absent value as a value, because it is one', () => {
    const report = reconcile({ connectorId: 'eclipse', subjectPersonId: 'per_aiden_boyle', checkedAt: BASE.at, ours, theirs: { 'Client.Name': 'Aiden Boyle' } });
    expect(report.divergences.map((d) => d.field).sort()).toEqual(['Episode.AllocatedWorker', 'Episode.Stage']);
    expect(report.divergences.every((d) => d.theirs === '')).toBe(true);
  });
});
