/**
 * Regenerates the verification table in docs/HANDOVER.md section 3 from the clock rules, so the
 * table is the code and not a copy of it. The prose above and below the table is hand-written; only
 * the rows between the header and the first paragraph after them are replaced.
 * `src/clocks/verification.test.ts` fails when the committed table differs from this output.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CLOCK_RULES, clockRuleTrigger } from '../src/clocks/rules';

const target = resolve(import.meta.dirname, '../../../docs/HANDOVER.md');
const heading = '## 3. Verification table';
const header = '| Rule id | Process | Trigger | Seeded value | Confidence | Source | Flag |';

export function verificationRows(): string[] {
  return CLOCK_RULES.map((rule) => {
    const value = `${rule.amount} ${rule.unit}${rule.direction === 'before' ? ' before' : ''}`;
    const flag = rule.todoVerify ? 'TODO(verify)' : rule.deferrable ? 'deferrable' : '';
    return `| ${rule.id} | ${rule.process} | ${clockRuleTrigger(rule.id)} | ${value} | ${rule.confidence} | ${rule.source} (${rule.sourceRef}) | ${flag} |`;
  });
}

const current = readFileSync(target, 'utf8');
const start = current.indexOf(header, current.indexOf(heading));
if (start === -1) throw new Error('docs/HANDOVER.md has no verification table header under section 3');
const afterHeader = current.indexOf('\n', current.indexOf('\n', start) + 1) + 1; // past the header and the |---| line
const end = current.indexOf('\n\n', afterHeader);
const next = current.slice(afterHeader, end);
const rows = verificationRows().join('\n');
writeFileSync(target, current.slice(0, afterHeader) + rows + current.slice(end));
console.log(`wrote ${CLOCK_RULES.length} rows to docs/HANDOVER.md section 3${next === rows ? ' (unchanged)' : ''}`);
