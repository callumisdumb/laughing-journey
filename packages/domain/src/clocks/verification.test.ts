import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLOCK_RULES, clockRuleDescription, clockRuleLabel, clockRuleTrigger } from './rules';

/**
 * Holds the three places that state a clock rule's confidence to one another (D-205).
 *
 * `rules.ts` is the source. `docs/HANDOVER.md` section 3 is the verification table, the only copy,
 * generated from the code by `pnpm docs:verification-table` and pinned here row by row. `docs/RESEARCH.md` is the research
 * log: it indexes its entries by rule id in its section 3, and it may not mark a rule to verify once
 * the table marks that rule High, unless the entry doing so carries a "Superseded by" line naming
 * the entry that corrected it. Two copies of the table drifted within a day of being written, and
 * the log kept saying Verify about a citation the code had already settled; a note asking people to
 * keep them in step is what had failed, so this does not ask.
 */
const ROOT = resolve(import.meta.dirname, '../../../..');
const HANDOVER = readFileSync(resolve(ROOT, 'docs/HANDOVER.md'), 'utf8');
const RESEARCH = readFileSync(resolve(ROOT, 'docs/RESEARCH.md'), 'utf8');

interface Row {
  id: string;
  process: string;
  trigger: string;
  value: string;
  confidence: string;
  source: string;
  flag: string;
}

/** The body of a `## ` section, up to the next one. */
function section(text: string, heading: string): string {
  const start = text.indexOf(`\n${heading}\n`);
  if (start === -1) throw new Error(`no section "${heading}"`);
  const rest = text.slice(start + heading.length + 2);
  const end = rest.search(/\n## /);
  return end === -1 ? rest : rest.slice(0, end);
}

/** Every seven-cell body row of the markdown table in a section. */
function tableRows(text: string): Row[] {
  return text
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('| Rule id') && !line.startsWith('|---'))
    .map((line) => line.slice(1, -1).split('|').map((cell) => cell.trim()))
    .filter((cells) => cells.length === 7)
    .map((cells) => ({ id: cells[0] ?? '', process: cells[1] ?? '', trigger: cells[2] ?? '', value: cells[3] ?? '', confidence: cells[4] ?? '', source: cells[5] ?? '', flag: cells[6] ?? '' }));
}

/** The research log as sections: each `## ` or `### ` heading with the lines under it. */
function researchSections(): { heading: string; lines: string[] }[] {
  const out: { heading: string; lines: string[] }[] = [];
  for (const line of RESEARCH.split('\n')) {
    if (/^#{2,3} /.test(line)) out.push({ heading: line.replace(/^#+ /, ''), lines: [] });
    else out.at(-1)?.lines.push(line);
  }
  return out;
}

const rows = tableRows(section(HANDOVER, '## 3. Verification table'));
const byId = new Map(rows.map((row) => [row.id, row]));
const highIds = rows.filter((row) => row.confidence === 'high').map((row) => row.id);
const names = (text: string) => highIds.filter((id) => text.includes(id));

describe('the handover verification table is the code', () => {
  it('lists every rule once and nothing else', () => {
    expect(rows.map((row) => row.id)).toEqual(CLOCK_RULES.map((rule) => rule.id));
  });

  it.each(CLOCK_RULES.map((rule) => [rule.id, rule] as const))('%s reads as rules.ts has it', (id, rule) => {
    const row = byId.get(id);
    expect(row).toBeDefined();
    if (!row) return;
    expect(row.process).toBe(rule.process);
    // A rule without catalogue text prints its key on the Admin screen and in this table.
    for (const text of [clockRuleLabel(id), clockRuleTrigger(id), clockRuleDescription(id)]) expect(text).not.toMatch(/^domain\.clockRules\./);
    expect(row.trigger).toBe(clockRuleTrigger(id));
    expect(row.value).toBe(`${rule.amount} ${rule.unit}${rule.direction === 'before' ? ' before' : ''}`);
    expect(row.confidence).toBe(rule.confidence);
    expect(row.source).toBe(`${rule.source} (${rule.sourceRef})`);
    expect(row.flag).toBe(rule.todoVerify ? 'TODO(verify)' : rule.deferrable ? 'deferrable' : '');
  });
});

describe('the research log does not contradict it', () => {
  it('indexes every rule in its section 3', () => {
    const index = section(RESEARCH, '## 3. Verification table');
    const missing = CLOCK_RULES.map((rule) => rule.id).filter((id) => !index.includes(id));
    expect(missing).toEqual([]);
  });

  it('carries no TODO(verify) against a rule the table marks High', () => {
    const offending = RESEARCH.split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => line.includes('TODO(verify)'))
      .flatMap(({ line, n }) => names(line).map((id) => `line ${n}: ${id}`));
    expect(offending).toEqual([]);
  });

  it('marks nothing Verify against a High rule unless the entry says what superseded it', () => {
    const headings = new Set(researchSections().map((s) => s.heading.split(' ')[0]));
    const offending: string[] = [];
    for (const { heading, lines } of researchSections()) {
      const body = lines.join('\n');
      const mentioned = names(body);
      if (mentioned.length === 0) continue;
      const verifies = lines.some((line) => line.startsWith('- Confidence:') && /\bVerify\b/.test(line));
      if (!verifies) continue;
      const superseded = lines.find((line) => /^- Superseded by \d+\.\d+\b/.test(line));
      const target = superseded?.match(/^- Superseded by (\d+\.\d+)/)?.[1];
      if (!target) offending.push(`${heading}: names ${mentioned.join(', ')} and says Verify without a "Superseded by" line`);
      else if (!headings.has(target)) offending.push(`${heading}: superseded by ${target}, which is not a section`);
    }
    expect(offending).toEqual([]);
  });
});
