#!/usr/bin/env node
/**
 * Refresh the bank holiday fixture from the gov.uk feed. Keeps the Scotland division only.
 * Usage: pnpm holidays:sync (needs network access to www.gov.uk).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '../../packages/domain/src/config/bank-holidays.json');
const res = await fetch('https://www.gov.uk/bank-holidays.json');
if (!res.ok) throw new Error(`gov.uk responded ${res.status}`);
const feed = await res.json();
if (!feed.scotland?.events) throw new Error('feed has no scotland division');
const out = { scotland: { division: 'scotland', events: feed.scotland.events } };
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
console.log(`wrote ${feed.scotland.events.length} Scottish events to ${target}`);
