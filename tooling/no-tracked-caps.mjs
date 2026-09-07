/**
 * No tracked capitals, and no capitals at all, outside the classification marking.
 *
 * `docs/DESIGN.md` section 3: sentence case everywhere, no all-caps, no letter-spacing tricks. The
 * person record's eyebrow was set in letter-spaced uppercase and ten more rules had followed it, so
 * the rule is a check rather than a sentence. Every rule block in the source CSS that sets
 * `text-transform: uppercase` fails, tracked or not, unless it is in the one file allowed to, which
 * is the print marking that the Government Security Classification requires in capitals (D-232).
 * The runtime half of this lives in `layout.spec.ts`, which walks the rendered record for computed
 * `text-transform: uppercase` and allows only `[data-marking]`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const ROOTS = ['apps/web', 'packages/ui'];
const SKIP = new Set(['node_modules', '.next', 'out', 'dist', 'coverage', 'release', 'test-results']);
const ALLOWED = new Set(['packages/ui/src/primitives/Classification.module.css']);

function* cssFiles(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* cssFiles(path);
    else if (entry.endsWith('.css')) yield path;
  }
}

const problems = [];
let checked = 0;
for (const root of ROOTS) {
  for (const file of cssFiles(join(ROOT, root))) {
    checked += 1;
    const rel = relative(ROOT, file);
    const text = readFileSync(file, 'utf8');
    // One rule block at a time, so the tracking is only reported when it sits with the transform.
    for (const block of text.split('}')) {
      if (!/text-transform\s*:\s*uppercase/.test(block)) continue;
      if (ALLOWED.has(rel)) continue;
      const selector = (block.split('{')[0] ?? '').trim().split('\n').pop()?.trim() ?? '?';
      const tracked = /letter-spacing\s*:/.test(block);
      problems.push(`${rel}: ${selector} sets text-transform: uppercase${tracked ? ' with letter-spacing' : ''}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`no-tracked-caps found ${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('Sentence case everywhere (docs/DESIGN.md section 3). Only the classification marking is set in capitals.');
  process.exit(1);
}
console.log(`no tracked capitals in ${checked} stylesheets (the classification marking allowed)`);
