/**
 * Fails when an em dash appears in any tracked text file. Brief section 2, rule 4.
 *
 * One exception, and only one: a message the catalogue's context file marks `verbatim` is a field
 * label copied word for word from a published statutory template. Some of those templates punctuate
 * with em dashes, and the product owner's instruction is to reproduce a return's labels exactly
 * rather than paraphrase them (D-055). The exception is keyed on the context flag, so it covers
 * nothing an author writes themselves.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const CATALOGUE = 'packages/messages/src/en-GB.json';
const CONTEXT = 'packages/messages/src/en-GB.context.json';

function flatten(tree, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && typeof value.where !== 'string') flatten(value, path, out);
    else out[path] = value;
  }
  return out;
}

/** The verbatim messages that legitimately carry an em dash, as exact strings to allow. */
function verbatimTexts() {
  try {
    const messages = flatten(JSON.parse(readFileSync(CATALOGUE, 'utf8')));
    const context = flatten(JSON.parse(readFileSync(CONTEXT, 'utf8')));
    const allowed = new Set();
    for (const [key, entry] of Object.entries(context)) {
      if (entry && typeof entry === 'object' && entry.verbatim === true && typeof messages[key] === 'string' && messages[key].includes('\u2014')) allowed.add(messages[key]);
    }
    return allowed;
  } catch {
    return new Set();
  }
}

const allowedVerbatim = verbatimTexts();

const files = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && /\.(ts|tsx|js|mjs|cjs|css|md|json|yaml|yml|html|rs|toml)$/.test(f))
  .filter((f) => !f.startsWith('docs/SCREENSHOTS/'));

const offenders = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const catalogue = file === CATALOGUE;
  lines.forEach((line, i) => {
    if (!line.includes('\u2014')) return;
    // In the catalogue, a line holding exactly one verbatim label is allowed; anywhere else is not.
    if (catalogue && [...allowedVerbatim].some((text) => line.includes(text))) return;
    offenders.push(`${file}:${i + 1}`);
  });
}

if (offenders.length > 0) {
  console.error('Em dashes found (use commas, colons, full stops or parentheses):');
  for (const o of offenders) console.error(`  ${o}`);
  process.exit(1);
}
console.log(`no em dashes in ${files.length} files${allowedVerbatim.size > 0 ? ` (${allowedVerbatim.size} verbatim template labels allowed)` : ''}`);
