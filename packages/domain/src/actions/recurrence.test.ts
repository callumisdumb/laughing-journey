import { describe, expect, it } from 'vitest';
import type { Action } from '../schemas/action-plan';
import { nextOccurrence, seriesPosition } from './recurrence';

const action = (over: Partial<Action> = {}): Action => ({ id: 'act_1', synthetic: true, processId: 'prc_1', title: 'Weekly visit', ownerName: 'A Worker', ownerAgency: 'social-work', due: '2026-09-07', status: 'open', createdAt: '2026-09-01T09:00:00Z', createdByName: 'A Worker', ...over }) as Action;
const at = '2026-09-10T14:00:00Z';
let n = 0;
const newId = (p: string) => `${p}_next${(n += 1)}`;

describe('nextOccurrence', () => {
  it('returns nothing for an action that does not repeat', () => {
    expect(nextOccurrence(action(), newId, at)).toBeNull();
  });

  it('counts from the due date, not the day it was completed, so a late weekly stays weekly', () => {
    const next = nextOccurrence(action({ recurrence: { every: 1, unit: 'weeks' } }), newId, at);
    expect(next?.due).toBe('2026-09-14');
    expect(next?.status).toBe('open');
    expect(next?.completedAt).toBeUndefined();
    expect(next?.recurrence?.previousActionId).toBe('act_1');
    expect(next?.id).not.toBe('act_1');
  });

  it('counts days and months as asked', () => {
    expect(nextOccurrence(action({ recurrence: { every: 10, unit: 'days' } }), newId, at)?.due).toBe('2026-09-17');
    expect(nextOccurrence(action({ recurrence: { every: 3, unit: 'months' } }), newId, at)?.due).toBe('2026-12-07');
  });

  it('stops at the end date rather than running for ever', () => {
    expect(nextOccurrence(action({ recurrence: { every: 1, unit: 'weeks', until: '2026-09-30' } }), newId, at)?.due).toBe('2026-09-14');
    expect(nextOccurrence(action({ due: '2026-09-28', recurrence: { every: 1, unit: 'weeks', until: '2026-09-30' } }), newId, at)).toBeNull();
  });

  it('carries the owner, the case and the title into the next one', () => {
    const next = nextOccurrence(action({ externalOwner: { name: 'A Landlord', organisation: 'Shore Lettings', chasedByName: 'A Worker' }, recurrence: { every: 2, unit: 'weeks' } }), newId, at);
    expect(next?.externalOwner?.organisation).toBe('Shore Lettings');
    expect(next?.title).toBe('Weekly visit');
    expect(next?.processId).toBe('prc_1');
  });
});

describe('seriesPosition', () => {
  it('says whether an action is in a series, and whether it is the first or the last', () => {
    expect(seriesPosition(action())).toEqual({ of: false, first: false, last: false });
    expect(seriesPosition(action({ recurrence: { every: 1, unit: 'weeks' } }))).toEqual({ of: true, first: true, last: false });
    expect(seriesPosition(action({ recurrence: { every: 1, unit: 'weeks', previousActionId: 'act_0' } }))).toEqual({ of: true, first: false, last: false });
    expect(seriesPosition(action({ due: '2026-09-30', recurrence: { every: 1, unit: 'weeks', until: '2026-09-30' } }))).toEqual({ of: true, first: true, last: true });
  });
});
