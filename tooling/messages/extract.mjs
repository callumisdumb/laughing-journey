// pnpm messages:extract: prints string literals a person could read that still sit in source
// (JSX text, copy props, label maps in the domain, connectors and mock-data packages, and the
// desktop shells). A clean run prints nothing but the summary and exits 0.
import { relative } from 'node:path';
import { ROOT } from './lib.mjs';
import { literals, sourceFiles } from './scan.mjs';

const only = process.argv.slice(2);
let count = 0;
const byFile = new Map();
for (const file of sourceFiles()) {
  const rel = relative(ROOT, file);
  if (only.length && !only.some((o) => rel.startsWith(o))) continue;
  const found = literals(file);
  if (found.length) byFile.set(rel, found);
  count += found.length;
}
for (const [file, found] of byFile) {
  console.log(file);
  for (const f of found) console.log(`  ${String(f.line).padStart(4)}  ${f.kind.padEnd(18)} ${JSON.stringify(f.text)}`);
}
console.log(`messages:extract: ${count} literal${count === 1 ? '' : 's'} remaining in ${byFile.size} file${byFile.size === 1 ? '' : 's'}`);
process.exit(count === 0 ? 0 : process.env.MESSAGES_EXTRACT_STRICT ? 1 : 0);
