// Folds packages/messages/staging/<ns>.messages.json and <ns>.context.json fragments into the
// catalogue and context file (sorted), removes the fragments and regenerates the types.
import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { CATALOGUE, CONTEXT, ROOT, readJson, setPath, writeJson, flatten } from './lib.mjs';

const STAGING = resolve(ROOT, 'packages/messages/staging');
// A commit in progress rewrites the catalogue briefly; wait for its lock to clear rather than read a partial file.
const LOCK = resolve(ROOT, 'packages/messages/src/.commit-lock');
for (let i = 0; i < 60 && existsSync(LOCK); i += 1) await new Promise((r) => setTimeout(r, 1000));
if (!existsSync(STAGING)) {
  console.log('messages:merge: no staging directory');
  process.exit(0);
}
// Optional arguments name the fragments to fold (by file name prefix); with none, every fragment.
const only = process.argv.slice(2);
const catalogue = readJson(CATALOGUE);
const context = readJson(CONTEXT);
let merged = 0;
for (const file of readdirSync(STAGING).sort()) {
  const path = resolve(STAGING, file);
  if (!file.endsWith('.json')) continue;
  if (only.length && !only.some((o) => file === o || file.startsWith(`${o}.`))) continue;
  const isContext = file.endsWith('.context.json');
  const target = isContext ? context : catalogue;
  const fragment = readJson(path);
  for (const [key, value] of Object.entries(flatten(fragment, '', {}, isContext ? 'context' : 'catalogue'))) {
    setPath(target, key, value);
    merged += 1;
  }
  unlinkSync(path);
  console.log(`merged ${file}`);
}
writeJson(CATALOGUE, catalogue);
writeJson(CONTEXT, context);
execSync('node tooling/messages/types.mjs', { cwd: ROOT, stdio: 'inherit' });
console.log(`messages:merge folded ${merged} entries`);
