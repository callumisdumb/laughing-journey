#!/usr/bin/env node
/**
 * Refresh the national holiday fixture from the gov.uk feed. A maintainer runs this; nothing else.
 *
 * The application must never fetch the feed (brief section 2, D-192). This script is the only thing
 * in the repository that touches the network, it is run by a person, reviewed as a diff and
 * committed. CI does not run it on a schedule and the build does not depend on it having been run.
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
 * Usage: pnpm holidays:sync [--apply-changes]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const FEED = 'https://www.gov.uk/bank-holidays.json';
const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '../../packages/domain/src/config/bank-holidays.json');
const applyChanges = process.argv.includes('--apply-changes');

const committed = JSON.parse(readFileSync(target, 'utf8'));

const res = await fetch(FEED);
if (!res.ok) throw new Error(`gov.uk responded ${res.status}`);
let feed;
try {
  feed = await res.json();
} catch {
  throw new Error('gov.uk did not return valid JSON');
}
if (!feed.scotland?.events) throw new Error('feed has no scotland division; refusing to write');

/** The feed's own shape, normalised. `bunting` is dropped, `notes` is kept. */
const incoming = feed.scotland.events.map((e) => ({ date: e.date, title: e.title, notes: e.notes ?? '' }));
const byDate = new Map(committed.holidays.map((h) => [h.date, h]));

const added = [];
const changed = [];
for (const holiday of incoming) {
  const existing = byDate.get(holiday.date);
  if (!existing) {
    added.push(holiday);
    continue;
  }
  if (existing.title !== holiday.title || existing.notes !== holiday.notes) changed.push({ was: existing, now: holiday });
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
  const at = new Date().toISOString().slice(0, 10);
  for (const change of changed) corrections.push({ at, date: change.now.date, was: `${change.was.title}${change.was.notes ? ` (${change.was.notes})` : ''}`, now: `${change.now.title}${change.now.notes ? ` (${change.now.notes})` : ''}` });
}

const out = {
  source: FEED,
  division: 'scotland',
  fetchedAt: new Date().toISOString().slice(0, 10),
  coversFrom: holidays[0]?.date.slice(0, 4) ? `${holidays[0].date.slice(0, 4)}-01-01` : committed.coversFrom,
  coversTo: holidays.at(-1)?.date ?? committed.coversTo,
  holidays,
  corrections,
};

console.log(`holidays:sync: ${holidays.length} Scottish holidays, ${out.coversFrom} to ${out.coversTo}`);
if (added.length > 0) {
  console.log(`  ${added.length} new:`);
  for (const holiday of added) console.log(`    ${holiday.date} ${holiday.title}${holiday.notes ? ` (${holiday.notes})` : ''}`);
}
for (const holiday of vanished) console.log(`  gone from the feed but kept: ${holiday.date} ${holiday.title}. A person decides whether this is a correction or a feed error.`);
for (const change of changed) console.log(`  changed: ${change.now.date} was "${change.was.title}${change.was.notes ? `, ${change.was.notes}` : ''}" and is now "${change.now.title}${change.now.notes ? `, ${change.now.notes}` : ''}"`);
if (changed.length > 0 && !applyChanges) {
  console.error(`\n${changed.length} already-committed date${changed.length === 1 ? '' : 's'} changed. A changed historical holiday changes a due date somebody may have worked to.`);
  console.error('Nothing has been written. Review the diff above, then rerun with --apply-changes to accept it.');
  process.exit(1);
}

writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote ${target}`);
if (added.length === 0 && changed.length === 0) console.log('  (no change to the list; fetchedAt updated)');
