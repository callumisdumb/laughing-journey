#!/usr/bin/env node
/**
 * Refresh the national holiday fixture from the gov.uk feed. A maintainer runs this; nothing else.
 *
 * The application must never fetch the feed (brief section 2, D-192). This script is the only thing
 * in the repository that touches the network, it is run by a person, reviewed as a diff and
 * committed. CI does not run it on a schedule and the build does not depend on it having been run.
 *
 * Two ways in. `pnpm holidays:sync` fetches the feed. `pnpm holidays:sync --from <path>` reads a
 * captured response instead, which is the only way it can run somewhere the feed is unreachable and
 * a reasonable way to run it anywhere, because the capture is then reviewed as a file. Either way
 * the response is written verbatim to `bank-holidays.raw.json` before anything is derived from it,
 * so the raw file is always the provenance of the normalised one (D-202).
 *
 * It merges rather than replaces, because the feed is a rolling window: it gains future years and
 * drops old ones. A sync that overwrote the fixture with a feed that no longer carried 2025 would
 * silently change every historical working-day computation in the product, including ones a
 * practitioner has already worked to.
 *
 * Three kinds of change, handled differently, and none of them silently:
 *   New dates            merged, and listed.
 *   Dates that vanished  kept, and reported. A holiday disappearing is either a feed correction or
 *                        a feed error and this script cannot tell which, so a person decides.
 *   Changed dates        refused unless --apply-changes. Gov.uk has corrected the feed before, and
 *                        a changed historical holiday changes a due date somebody has acted on.
 *                        Applying writes a dated note into the fixture saying what changed.
 *
 * Usage: pnpm holidays:sync [--from <path>] [--captured-at YYYY-MM-DD] [--apply-changes]
 *   --from <path>          derive from a captured response rather than fetching
 *   --captured-at <date>   the date the capture was taken, recorded as fetchedAt (defaults to today)
 *   --apply-changes        accept changes to already-committed dates, with a note in the corrections log
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const FEED = 'https://www.gov.uk/bank-holidays.json';
const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '../../packages/domain/src/config/bank-holidays.json');
const rawTarget = resolve(here, '../../packages/domain/src/config/bank-holidays.raw.json');

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply-changes');
const option = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const value = args[i + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} needs a value`);
  return value;
};
const from = option('--from');
const capturedAt = option('--captured-at');
if (capturedAt && !/^\d{4}-\d{2}-\d{2}$/.test(capturedAt)) throw new Error('--captured-at must be YYYY-MM-DD');

const committed = JSON.parse(readFileSync(target, 'utf8'));

// The response, verbatim: from the file named, or from the feed. Kept as text so the raw file is
// the bytes gov.uk sent and not this script's idea of how to print them.
let text;
if (from) {
  text = readFileSync(resolve(process.cwd(), from), 'utf8');
  console.log(`holidays:sync: reading the captured response at ${from}`);
} else {
  const res = await fetch(FEED);
  if (!res.ok) throw new Error(`gov.uk responded ${res.status}`);
  text = await res.text();
}
let feed;
try {
  feed = JSON.parse(text);
} catch {
  throw new Error(from ? `${from} is not valid JSON` : 'gov.uk did not return valid JSON');
}
if (!feed.scotland?.events) throw new Error('feed has no scotland division; refusing to write');

// The provenance first, before anything is derived from it, and byte for byte.
if (resolve(process.cwd(), from ?? '') !== rawTarget) writeFileSync(rawTarget, text);

/** The feed's own shape, normalised. `bunting` is dropped, `notes` is kept. */
const incoming = feed.scotland.events.map((e) => ({ date: e.date, title: e.title, notes: e.notes ?? '' }));
const byDate = new Map(committed.holidays.map((h) => [h.date, h]));

/**
 * What counts as the same holiday. The first fixture was typed by hand with straight apostrophes
 * and the feed uses curly ones; that is typography, not a correction, and the feed's spelling is
 * taken quietly because the feed is the provenance. A note the fixture carries that the feed does
 * not is a maintainer's annotation and is kept, like a vanished date, rather than lost or logged.
 * Anything else that differs on a committed date is a change, and a change is refused.
 */
const plain = (s) => (s ?? '').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();

const added = [];
const changed = [];
const aligned = [];
const annotated = [];
for (const holiday of incoming) {
  const existing = byDate.get(holiday.date);
  if (!existing) {
    added.push(holiday);
    continue;
  }
  const sameTitle = plain(existing.title) === plain(holiday.title);
  const sameNotes = plain(existing.notes) === plain(holiday.notes);
  if (sameTitle && sameNotes) {
    if (existing.title !== holiday.title || existing.notes !== holiday.notes) {
      aligned.push({ was: existing, now: holiday });
      byDate.set(holiday.date, holiday);
    }
    continue;
  }
  if (sameTitle && plain(holiday.notes) === '' && plain(existing.notes) !== '') {
    annotated.push(existing);
    byDate.set(holiday.date, { ...holiday, title: holiday.title, notes: existing.notes });
    continue;
  }
  changed.push({ was: existing, now: holiday });
}

// A year the feed still carries, missing a date the fixture has. Never removed here.
const feedYears = new Set(incoming.map((h) => h.date.slice(0, 4)));
const incomingDates = new Set(incoming.map((h) => h.date));
const vanished = committed.holidays.filter((h) => feedYears.has(h.date.slice(0, 4)) && !incomingDates.has(h.date));

for (const holiday of added) byDate.set(holiday.date, holiday);
if (changed.length > 0 && applyChanges) {
  for (const change of changed) byDate.set(change.now.date, change.now);
}

const holidays = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
if (holidays.length < committed.holidays.length) throw new Error('the merged list is shorter than the committed one; refusing to write');

const corrections = [...(committed.corrections ?? [])];
if (changed.length > 0 && applyChanges) {
  const at = capturedAt ?? new Date().toISOString().slice(0, 10);
  for (const change of changed) corrections.push({ at, date: change.now.date, was: `${change.was.title}${change.was.notes ? ` (${change.was.notes})` : ''}`, now: `${change.now.title}${change.now.notes ? ` (${change.now.notes})` : ''}` });
}

// The feed publishes whole calendar years, so a year it lists is covered from its first day to its
// last, holidays or not. Coverage is the span of years, not the span of holidays: the last week of
// December has no holiday after Boxing Day and is a perfectly ordinary set of working days.
const firstYear = holidays[0]?.date.slice(0, 4);
const lastYear = holidays.at(-1)?.date.slice(0, 4);
const out = {
  source: FEED,
  division: 'scotland',
  fetchedAt: capturedAt ?? new Date().toISOString().slice(0, 10),
  coversFrom: firstYear ? `${firstYear}-01-01` : committed.coversFrom,
  coversTo: lastYear ? `${lastYear}-12-31` : committed.coversTo,
  holidays,
  corrections,
};

console.log(`holidays:sync: ${holidays.length} Scottish holidays, ${out.coversFrom} to ${out.coversTo}`);
if (added.length > 0) {
  console.log(`  ${added.length} new:`);
  for (const holiday of added) console.log(`    ${holiday.date} ${holiday.title}${holiday.notes ? ` (${holiday.notes})` : ''}`);
}
for (const holiday of vanished) console.log(`  gone from the feed but kept: ${holiday.date} ${holiday.title}. A person decides whether this is a correction or a feed error.`);
for (const entry of aligned) console.log(`  typography aligned with the feed: ${entry.now.date} "${entry.was.title}" is written "${entry.now.title}"`);
for (const holiday of annotated) console.log(`  note kept: ${holiday.date} ${holiday.title} carries a maintainer's note the feed does not: "${holiday.notes}"`);
for (const change of changed) console.log(`  changed: ${change.now.date} was "${change.was.title}${change.was.notes ? `, ${change.was.notes}` : ''}" and is now "${change.now.title}${change.now.notes ? `, ${change.now.notes}` : ''}"`);
if (changed.length > 0 && !applyChanges) {
  console.error(`\n${changed.length} already-committed date${changed.length === 1 ? '' : 's'} changed. A changed historical holiday changes a due date somebody may have worked to.`);
  console.error('Nothing has been written to the normalised fixture. Review the diff above, then rerun with --apply-changes to accept it.');
  process.exit(1);
}

writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote ${target}`);
console.log(`raw response at ${rawTarget}`);
if (added.length === 0 && changed.length === 0) console.log('  (no change to the list; fetchedAt updated)');
