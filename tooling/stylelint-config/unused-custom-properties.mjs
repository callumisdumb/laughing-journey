// Reports CSS custom properties that are defined but never read with var().
// Tokens in tokens.css are exempt (they are the design system's public API).
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const files = execSync('git ls-files -co --exclude-standard "apps/web/**/*.css" "packages/ui/**/*.css"', {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);

const defined = new Map();
const used = new Set();
for (const file of files) {
  const css = readFileSync(file, 'utf8');
  const isTokens = file.endsWith('tokens.css');
  for (const m of css.matchAll(/(--[a-zA-Z0-9-_]+)\s*:/g)) {
    if (!isTokens && !defined.has(m[1])) defined.set(m[1], file);
  }
  for (const m of css.matchAll(/var\(\s*(--[a-zA-Z0-9-_]+)/g)) used.add(m[1]);
}
// Properties may also be read from TS (getComputedStyle) or set inline; scan source too.
const src = execSync('git ls-files -co --exclude-standard "apps/web/**/*.ts" "apps/web/**/*.tsx" "packages/ui/**/*.ts" "packages/ui/**/*.tsx"', {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);
for (const file of src) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/(--[a-zA-Z0-9-_]+)/g)) used.add(m[1]);
}
const unused = [...defined.entries()].filter(([name]) => !used.has(name));
if (unused.length > 0) {
  console.error('Unused CSS custom properties:');
  for (const [name, file] of unused) console.error(`  ${name} (${file})`);
  process.exit(1);
}
console.log(`custom properties: ${defined.size} defined outside tokens, all used`);
