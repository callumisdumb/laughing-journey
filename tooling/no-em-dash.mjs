// Fails when an em dash appears in any tracked text file. Brief section 2, rule 4.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && /\.(ts|tsx|js|mjs|cjs|css|md|json|yaml|yml|html|rs|toml)$/.test(f))
  .filter((f) => !f.startsWith('docs/SCREENSHOTS/'));

const offenders = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('\u2014')) offenders.push(`${file}:${i + 1}`);
  });
}

if (offenders.length > 0) {
  console.error('Em dashes found (use commas, colons, full stops or parentheses):');
  for (const o of offenders) console.error(`  ${o}`);
  process.exit(1);
}
console.log(`no em dashes in ${files.length} files`);
