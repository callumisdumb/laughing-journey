/**
 * Fails when placeholder copy reaches a screen. Brief section G.4.
 *
 * Everything a person can read lives in `packages/messages/src/en-GB.json`, which is what makes
 * this checkable at all: one file to read rather than a grep across every component hoping the
 * string was not built from three variables. A recording is where this bites, because "TBD" on a
 * screen in front of chief officers is not a small thing, and nobody notices it in the room.
 *
 * The words are checked as words rather than as substrings, so "Latvia" is not a lorem and a person
 * called Todd is not a TODD. The seeded data is not checked here: it has its own generator and its
 * own tests, and a person's name is not copy.
 *
 * One message says the word on purpose: the child protection register's rate note explains that the
 * population denominator is a placeholder, which is the honest thing to say about a fictional
 * figure. Its context entry carries `placeholderWord: true`, so the exception is written down beside
 * the copy rather than as a pattern in here that would quietly cover the next one too.
 */
import { readFileSync } from 'node:fs';

const CATALOGUE = 'packages/messages/src/en-GB.json';
const CONTEXT = 'packages/messages/src/en-GB.context.json';

/** Placeholders, as whole words. */
const WORDS = ['lorem', 'ipsum', 'todo', 'tbd', 'tbc', 'xxx', 'placeholder', 'coming soon', 'fixme', 'wip'];

function flatten(tree, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') flatten(value, path, out);
    else out[path] = value;
  }
  return out;
}

function contextEntries() {
  const out = {};
  const walk = (tree, prefix) => {
    for (const [key, value] of Object.entries(tree)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value !== null && typeof value === 'object' && typeof value.where !== 'string') walk(value, path);
      else out[path] = value;
    }
  };
  walk(JSON.parse(readFileSync(CONTEXT, 'utf8')), '');
  return out;
}

const messages = flatten(JSON.parse(readFileSync(CATALOGUE, 'utf8')));
const context = contextEntries();
const problems = [];
let allowed = 0;
for (const [key, text] of Object.entries(messages)) {
  if (typeof text !== 'string') continue;
  if (context[key] && context[key].placeholderWord === true) {
    allowed += 1;
    continue;
  }
  for (const word of WORDS) {
    const pattern = new RegExp(`\\b${word.replace(/ /g, '\\s+')}\\b`, 'i');
    if (pattern.test(text)) problems.push(`${key}: ${word} in ${JSON.stringify(text.slice(0, 90))}`);
  }
}

if (problems.length > 0) {
  console.error(`placeholder copy found in ${problems.length} message${problems.length === 1 ? '' : 's'}:`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`no placeholder copy in ${Object.keys(messages).length} messages (${WORDS.length} words checked, ${allowed} said on purpose)`);
