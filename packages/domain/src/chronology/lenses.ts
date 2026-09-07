/**
 * Pattern lenses: mockup-level heuristics over a chronology. They are prompts for
 * professional analysis, never conclusions, and every result says so. The wording of
 * every label, finding and span lives in the message catalogue under `domain.lenses`.
 */
import { t, tKey } from '@mas/messages';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { keySegment } from '../enums';
import type { ChronologyEvent } from '../schemas/chronology';

export const LENS_IDS = ['escalation', 'missed-contacts', 'moves', 'gaps', 'household', 'release-alignment'] as const;
export type LensId = (typeof LENS_IDS)[number];

export interface LensSpan {
  from: string;
  to: string;
  label: string;
}

export interface LensResult {
  id: LensId;
  label: string;
  /** What the lens looks for, in plain language. */
  looksFor: string;
  /** What it found, or why it found nothing. Always framed as a prompt. */
  finding: string;
  eventIds: string[];
  spans: LensSpan[];
  /** True when the lens has something to show. */
  active: boolean;
}

/** The lens name, read from the catalogue at call time. */
export function lensLabel(id: LensId): string {
  return tKey(`domain.lenses.${keySegment(id)}.label`);
}

/** What the lens looks for, in plain language, read from the catalogue at call time. */
export function lensLooksFor(id: LensId): string {
  return tKey(`domain.lenses.${keySegment(id)}.looksFor`);
}


/** A finding or span label for a lens: `domain.lenses.<id>.<item>` with its arguments. */
function lensText(id: LensId, item: string, values?: Parameters<typeof tKey>[1]): string {
  return tKey(`domain.lenses.${keySegment(id)}.${item}`, values);
}

const SIG_RANK = { low: 1, moderate: 2, high: 3 } as const;

function sorted(events: ChronologyEvent[]): ChronologyEvent[] {
  return [...events].sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1));
}

function days(a: string, b: string): number {
  return Math.abs(differenceInCalendarDays(parseISO(b), parseISO(a)));
}

function day(iso: string): string {
  return iso.slice(0, 10);
}

function result(id: LensId, eventIds: string[], spans: LensSpan[], finding: string): LensResult {
  return { id, label: lensLabel(id), looksFor: lensLooksFor(id), finding: `${finding} ${t('domain.lenses.prompt')}`, eventIds, spans, active: eventIds.length > 0 || spans.length > 0 };
}

export function escalationLens(events: ChronologyEvent[]): LensResult {
  const police = sorted(events.filter((e) => e.eventType === 'police.concern-report' || e.eventType === 'police.incident'));
  if (police.length < 3) return result('escalation', [], [], lensText('escalation', 'findingFew', { count: police.length }));
  let nonDecreasing = true;
  for (let i = 1; i < police.length; i += 1) {
    if (SIG_RANK[police[i]!.significance] < SIG_RANK[police[i - 1]!.significance]) nonDecreasing = false;
  }
  const first = police[0]!;
  const last = police[police.length - 1]!;
  const values = { count: police.length, from: day(first.occurredAt), to: day(last.occurredAt) };
  if (!nonDecreasing) return result('escalation', police.map((e) => e.id), [], lensText('escalation', 'findingMixed', values));
  return result('escalation', police.map((e) => e.id), [{ from: first.occurredAt, to: last.occurredAt, label: lensText('escalation', 'spanRising') }], lensText('escalation', 'findingRising', values));
}

export function missedContactsLens(events: ChronologyEvent[]): LensResult {
  const candidates = sorted(events.filter((e) => e.eventType === 'health.missed-appointment' || e.eventType === 'education.concern' || (e.eventType === 'education.attendance' && e.significance !== 'low')));
  const ids = new Set<string>();
  const spans: LensSpan[] = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const a = candidates[i]!;
    const cluster = candidates.filter((b) => b.occurredAt >= a.occurredAt && days(a.occurredAt, b.occurredAt) <= 120);
    if (cluster.length >= 2) {
      for (const c of cluster) ids.add(c.id);
      const end = cluster[cluster.length - 1]!;
      if (!spans.some((s) => s.from <= a.occurredAt && s.to >= end.occurredAt)) spans.push({ from: a.occurredAt, to: end.occurredAt, label: lensText('missed-contacts', 'span', { count: cluster.length }) });
    }
  }
  if (ids.size === 0) return result('missed-contacts', [], [], lensText('missed-contacts', 'findingNone'));
  return result('missed-contacts', [...ids], spans, lensText('missed-contacts', 'findingClusters', { count: ids.size, clusters: spans.length }));
}

export function movesLens(events: ChronologyEvent[]): LensResult {
  const moves = sorted(events.filter((e) => e.eventType === 'move.address'));
  const ids = new Set<string>();
  for (let i = 1; i < moves.length; i += 1) {
    if (days(moves[i - 1]!.occurredAt, moves[i]!.occurredAt) <= 36 * 30.44) {
      ids.add(moves[i - 1]!.id);
      ids.add(moves[i]!.id);
    }
  }
  if (ids.size === 0) return result('moves', [], [], lensText('moves', 'findingNone', { count: moves.length }));
  return result('moves', [...ids], [], lensText('moves', 'findingRepeated', { count: ids.size }));
}

export function gapsLens(events: ChronologyEvent[], now: Date): LensResult {
  const all = sorted(events);
  const spans: LensSpan[] = [];
  for (let i = 1; i < all.length; i += 1) {
    const gap = days(all[i - 1]!.occurredAt, all[i]!.occurredAt);
    if (gap >= 180) spans.push({ from: all[i - 1]!.occurredAt, to: all[i]!.occurredAt, label: lensText('gaps', 'spanBetween', { months: Math.round(gap / 30.44) }) });
  }
  const last = all[all.length - 1];
  if (last) {
    const tail = differenceInCalendarDays(now, parseISO(last.occurredAt));
    if (tail >= 180) spans.push({ from: last.occurredAt, to: now.toISOString(), label: lensText('gaps', 'spanTail', { months: Math.round(tail / 30.44) }) });
  }
  if (spans.length === 0) return result('gaps', [], [], lensText('gaps', 'findingNone'));
  return result('gaps', [], spans, lensText('gaps', 'findingGaps', { count: spans.length }));
}

export function householdLens(events: ChronologyEvent[]): LensResult {
  const changes = sorted(events.filter((e) => e.eventType === 'household.change' || e.eventType === 'family.birth' || e.eventType === 'family.change'));
  if (changes.length === 0) return result('household', [], [], lensText('household', 'findingNone'));
  return result('household', changes.map((e) => e.id), [], lensText('household', 'findingChanges', { count: changes.length }));
}

export function releaseAlignmentLens(events: ChronologyEvent[]): LensResult {
  const triggers = sorted(events.filter((e) => e.eventType === 'police.release' || e.eventType === 'police.bail-condition' || e.eventType === 'legal.licence'));
  if (triggers.length === 0) return result('release-alignment', [], [], lensText('release-alignment', 'findingNone'));
  const ids = new Set<string>();
  const spans: LensSpan[] = [];
  for (const trigger of triggers) {
    ids.add(trigger.id);
    const after = events.filter((e) => e.id !== trigger.id && e.occurredAt >= trigger.occurredAt && days(trigger.occurredAt, e.occurredAt) <= 30);
    for (const e of after) ids.add(e.id);
    spans.push({ from: trigger.occurredAt, to: parseISO(trigger.occurredAt).getTime() + 30 * 86400000 > 0 ? new Date(parseISO(trigger.occurredAt).getTime() + 30 * 86400000).toISOString() : trigger.occurredAt, label: lensText('release-alignment', 'span', { title: trigger.title }) });
  }
  return result('release-alignment', [...ids], spans, lensText('release-alignment', 'findingAligned', { count: triggers.length, others: ids.size - triggers.length }));
}

export function applyLens(id: LensId, events: ChronologyEvent[], now: Date): LensResult {
  switch (id) {
    case 'escalation':
      return escalationLens(events);
    case 'missed-contacts':
      return missedContactsLens(events);
    case 'moves':
      return movesLens(events);
    case 'gaps':
      return gapsLens(events, now);
    case 'household':
      return householdLens(events);
    case 'release-alignment':
      return releaseAlignmentLens(events);
  }
}
