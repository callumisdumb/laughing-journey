// Build-time WCAG AA contrast check over apps/web/styles/tokens.css.
// Text pairs need 4.5:1, component pairs (lines, glyph fills, soft pill backgrounds) need 3:1.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(import.meta.dirname, '../../apps/web/styles/tokens.css');
const css = readFileSync(file, 'utf8');

function block(selectorRegex) {
  const m = css.match(selectorRegex);
  if (!m) throw new Error(`block not found: ${selectorRegex}`);
  const start = css.indexOf('{', m.index) + 1;
  let depth = 1;
  let i = start;
  while (depth > 0 && i < css.length) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') depth -= 1;
    i += 1;
  }
  return css.slice(start, i - 1);
}

function tokens(text) {
  const out = {};
  for (const m of text.matchAll(/--color-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
  return out;
}

const light = tokens(block(/@theme\s*\{/));
const dark = { ...light, ...tokens(block(/\[data-theme='dark'\]\s*\{/)) };

function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const papers = ['paper-0', 'paper-1', 'paper-2'];
const textColours = ['ink-1', 'ink-2', 'ink-3', 'accent-1', 'accent-2', 'risk-critical', 'risk-high', 'risk-medium', 'risk-low', 'risk-unknown'];
const agencyColours = Object.keys(light).filter((k) => k.startsWith('agency-'));
const componentColours = ['line-3', 'accent-1', ...agencyColours, 'risk-critical', 'risk-high', 'risk-medium', 'risk-low'];
const softPairs = [
  ['risk-critical', 'risk-critical-soft'],
  ['risk-high', 'risk-high-soft'],
  ['risk-medium', 'risk-medium-soft'],
  ['risk-low', 'risk-low-soft'],
  ['risk-unknown', 'risk-unknown-soft'],
  ['accent-1', 'accent-soft'],
  ['ink-1', 'accent-soft'],
];

let failures = 0;
let checks = 0;
function check(theme, t, fg, bg, min, kind) {
  const r = ratio(t[fg], t[bg]);
  checks += 1;
  if (r < min) {
    failures += 1;
    console.error(`FAIL ${theme} ${kind}: ${fg} on ${bg} = ${r.toFixed(2)} (needs ${min})`);
  }
}

for (const [theme, t] of [['light', light], ['dark', dark]]) {
  for (const bg of papers) {
    for (const fg of textColours) check(theme, t, fg, bg, 4.5, 'text');
    for (const fg of agencyColours) check(theme, t, fg, bg, 4.5, 'agency text');
    for (const fg of componentColours) check(theme, t, fg, bg, 3, 'component');
  }
  check(theme, t, 'on-accent', 'accent-1', 4.5, 'text on accent');
  for (const [fg, bg] of softPairs) check(theme, t, fg, bg, 4.5, 'text on soft');
  check(theme, t, 'ink-3', 'paper-2', 4.5, 'placeholder');
}

if (failures > 0) {
  console.error(`contrast: ${failures} of ${checks} pairs fail AA`);
  process.exit(1);
}
console.log(`contrast: ${checks} pairs pass AA in light and dark`);
