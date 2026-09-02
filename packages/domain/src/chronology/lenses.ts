/**
 * Pattern lenses: mockup-level heuristics over a chronology. They are prompts for
 * professional analysis, never conclusions, and every result says so.
 */
import { differenceInCalendarDays, parseISO } from 'date-fns';
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

export const LENS_LABELS: Record<LensId, { label: string; looksFor: string }> = {
  escalation: { label: 'Escalation of police incidents', looksFor: 'Three or more police concern reports or incidents where significance rises or holds over time.' },
  'missed-contacts': { label: 'Clusters of missed contacts', looksFor: 'Two or more missed health or education contacts, low attendance or wellbeing concerns within 120 days.' },
  moves: { label: 'Repeated moves', looksFor: 'Two or more address moves within 36 months.' },
  gaps: { label: 'Gaps in agency contact', looksFor: 'Periods of 180 days or more with no event from any agency.' },
  household: { label: 'Changes in household composition', looksFor: 'People joining or leaving the household, births and partner changes.' },
  'release-alignment': { label: 'Alignment with release or bail dates', looksFor: 'Events in the 30 days after a release from custody, a bail condition or a licence change.' },
};

const PROMPT = 'This is a prompt for professional analysis, not a conclusion. Record any judgement as an analysis note linked to the events.';

const SIG_RANK = { low: 1, moderate: 2, high: 3 } as const;

function sorted(events: ChronologyEvent[]): ChronologyEvent[] {
  return [...events].sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1));
}

function days(a: string, b: string): number {
  return Math.abs(differenceInCalendarDays(parseISO(b), parseISO(a)));
}

function result(id: LensId, eventIds: string[], spans: LensSpan[], finding: string): LensResult {
  const meta = LENS_LABELS[id];
  return { id, label: meta.label, looksFor: meta.looksFor, finding: `${finding} ${PROMPT}`, eventIds, spans, active: eventIds.length > 0 || spans.length > 0 };
}

export function escalationLens(events: ChronologyEvent[]): LensResult {
  const police = sorted(events.filter((e) => e.eventType === 'police.concern-report' || e.eventType === 'police.incident'));
  if (police.length < 3) return result('escalation', [], [], `Fewer than three police concern reports or incidents (${police.length} found), so no pattern is shown.`);
  let nonDecreasing = true;
  for (let i = 1; i < police.length; i += 1) {
    if (SIG_RANK[police[i]!.significance] < SIG_RANK[police[i - 1]!.significance]) nonDecreasing = false;
  }
  const first = police[0]!;
  const last = police[police.length - 1]!;
  if (!nonDecreasing) return result('escalation', police.map((e) => e.id), [], `${police.length} police reports between ${first.occurredAt.slice(0, 10)} and ${last.occurredAt.slice(0, 10)}, with significance rising and falling rather than climbing.`);
  return result('escalation', police.map((e) => e.id), [{ from: first.occurredAt, to: last.occurredAt, label: 'Police reports rising in significance' }], `${police.length} police reports between ${first.occurredAt.slice(0, 10)} and ${last.occurredAt.slice(0, 10)}; each is as significant as, or more significant than, the one before.`);
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
      if (!spans.some((s) => s.from <= a.occurredAt && s.to >= end.occurredAt)) spans.push({ from: a.occurredAt, to: end.occurredAt, label: `${cluster.length} missed or low contacts` });
    }
  }
  if (ids.size === 0) return result('missed-contacts', [], [], 'No cluster of missed health or education contacts within 120 days.');
  return result('missed-contacts', [...ids], spans, `${ids.size} missed or low contacts fall into ${spans.length} ${spans.length === 1 ? 'cluster' : 'clusters'}. Check what else was happening at home in those weeks.`);
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
  if (ids.size === 0) return result('moves', [], [], `${moves.length} ${moves.length === 1 ? 'move' : 'moves'} recorded, none within 36 months of another.`);
  return result('moves', [...ids], [], `${ids.size} moves within 36 months of each other. Consider the effect on school, health visiting and support networks.`);
}

export function gapsLens(events: ChronologyEvent[], now: Date): LensResult {
  const all = sorted(events);
  const spans: LensSpan[] = [];
  for (let i = 1; i < all.length; i += 1) {
    const gap = days(all[i - 1]!.occurredAt, all[i]!.occurredAt);
    if (gap >= 180) spans.push({ from: all[i - 1]!.occurredAt, to: all[i]!.occurredAt, label: `${Math.round(gap / 30.44)} months with no recorded contact` });
  }
  const last = all[all.length - 1];
  if (last) {
    const tail = differenceInCalendarDays(now, parseISO(last.occurredAt));
    if (tail >= 180) spans.push({ from: last.occurredAt, to: now.toISOString(), label: `${Math.round(tail / 30.44)} months since the last recorded contact` });
  }
  if (spans.length === 0) return result('gaps', [], [], 'No period of 180 days or more without an event from any agency.');
  return result('gaps', [], spans, `${spans.length} ${spans.length === 1 ? 'gap' : 'gaps'} of six months or more. A gap can mean stability or that nobody was looking.`);
}

export function householdLens(events: ChronologyEvent[]): LensResult {
  const changes = sorted(events.filter((e) => e.eventType === 'household.change' || e.eventType === 'family.birth' || e.eventType === 'family.change'));
  if (changes.length === 0) return result('household', [], [], 'No household changes recorded.');
  return result('household', changes.map((e) => e.id), [], `${changes.length} ${changes.length === 1 ? 'change' : 'changes'} in who lives in the home. Compare against the missed contacts and police lenses.`);
}

export function releaseAlignmentLens(events: ChronologyEvent[]): LensResult {
  const triggers = sorted(events.filter((e) => e.eventType === 'police.release' || e.eventType === 'police.bail-condition' || e.eventType === 'legal.licence'));
  if (triggers.length === 0) return result('release-alignment', [], [], 'No release, bail or licence events to align against.');
  const ids = new Set<string>();
  const spans: LensSpan[] = [];
  for (const t of triggers) {
    ids.add(t.id);
    const after = events.filter((e) => e.id !== t.id && e.occurredAt >= t.occurredAt && days(t.occurredAt, e.occurredAt) <= 30);
    for (const e of after) ids.add(e.id);
    spans.push({ from: t.occurredAt, to: parseISO(t.occurredAt).getTime() + 30 * 86400000 > 0 ? new Date(parseISO(t.occurredAt).getTime() + 30 * 86400000).toISOString() : t.occurredAt, label: `30 days after ${t.title}` });
  }
  return result('release-alignment', [...ids], spans, `${triggers.length} release, bail or licence ${triggers.length === 1 ? 'event' : 'events'}; ${ids.size - triggers.length} other events fall in the 30 days after.`);
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
