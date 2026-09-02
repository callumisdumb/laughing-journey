import { describe, expect, it } from 'vitest';
import type { ChronologyEvent } from '../schemas/chronology';
import { LENS_IDS, applyLens } from './lenses';

function ev(id: string, date: string, eventType: ChronologyEvent['eventType'], significance: ChronologyEvent['significance'] = 'moderate'): ChronologyEvent {
  return { id, synthetic: true, subjectIds: ['p'], occurredAt: `${date}T12:00:00+01:00`, hasTime: false, approximate: false, recordedAt: `${date}T12:00:00+01:00`, agency: 'police', sourceSystem: 'manual', recordedByName: 'x', eventType, title: `${eventType} ${id}`, detail: '', significance, linkedPersonIds: [], linkedProcessIds: [], evidenceRefs: [], visibility: 'integrated', versions: [] };
}
const now = new Date('2026-09-02T09:00:00+01:00');

describe('lenses', () => {
  it('every lens returns a prompt framing', () => {
    for (const id of LENS_IDS) expect(applyLens(id, [], now).finding).toContain('prompt for professional analysis');
  });
  it('escalation needs three rising police reports', () => {
    const rising = [ev('a', '2020-11-21', 'police.concern-report', 'moderate'), ev('b', '2023-09-02', 'police.concern-report', 'high'), ev('c', '2025-03-08', 'police.incident', 'high')];
    const r = applyLens('escalation', rising, now);
    expect(r.active).toBe(true);
    expect(r.eventIds).toEqual(['a', 'b', 'c']);
    expect(r.spans.length).toBe(1);
    const falling = [ev('a', '2020-01-01', 'police.concern-report', 'high'), ev('b', '2021-01-01', 'police.concern-report', 'low'), ev('c', '2022-01-01', 'police.concern-report', 'moderate')];
    expect(applyLens('escalation', falling, now).spans.length).toBe(0);
    expect(applyLens('escalation', rising.slice(0, 2), now).active).toBe(false);
  });
  it('missed contacts clusters within 120 days', () => {
    const events = [ev('m1', '2021-01-10', 'health.missed-appointment'), ev('m2', '2021-03-01', 'education.concern'), ev('m3', '2024-06-01', 'health.missed-appointment'), ev('att', '2024-07-01', 'education.attendance', 'low')];
    const r = applyLens('missed-contacts', events, now);
    expect(r.eventIds.sort()).toEqual(['m1', 'm2']);
    expect(r.spans.length).toBe(1);
    expect(applyLens('missed-contacts', [ev('m3', '2024-06-01', 'health.missed-appointment')], now).active).toBe(false);
  });
  it('moves within 36 months', () => {
    const r = applyLens('moves', [ev('mv1', '2022-02-10', 'move.address'), ev('mv2', '2024-01-19', 'move.address'), ev('mv3', '2010-01-01', 'move.address')], now);
    expect(r.eventIds.sort()).toEqual(['mv1', 'mv2']);
    expect(applyLens('moves', [ev('mv3', '2010-01-01', 'move.address')], now).active).toBe(false);
  });
  it('gaps of 180 days and a tail gap', () => {
    const r = applyLens('gaps', [ev('a', '2024-01-01', 'social-work.visit'), ev('b', '2025-01-01', 'social-work.visit'), ev('c', '2025-02-01', 'social-work.visit')], now);
    expect(r.spans.length).toBe(2);
    expect(r.spans[1]?.label).toContain('since the last recorded contact');
    expect(applyLens('gaps', [ev('a', '2026-08-01', 'social-work.visit'), ev('b', '2026-08-20', 'social-work.visit')], now).active).toBe(false);
    expect(applyLens('gaps', [], now).active).toBe(false);
  });
  it('household changes', () => {
    expect(applyLens('household', [ev('h', '2024-06-01', 'household.change')], now).eventIds).toEqual(['h']);
    expect(applyLens('household', [], now).active).toBe(false);
  });
  it('release alignment highlights the 30 days after', () => {
    const events = [ev('bail', '2026-05-23', 'police.bail-condition', 'high'), ev('after', '2026-06-10', 'social-work.visit'), ev('later', '2026-08-01', 'social-work.visit')];
    const r = applyLens('release-alignment', events, now);
    expect(r.eventIds.sort()).toEqual(['after', 'bail']);
    expect(r.spans.length).toBe(1);
    expect(applyLens('release-alignment', [ev('x', '2026-01-01', 'social-work.visit')], now).active).toBe(false);
  });
});
