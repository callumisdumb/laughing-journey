// pnpm messages:check: every message parses as ICU, every key is referenced, every referenced
// key exists, the context file covers every key, keys are sorted and no deeper than four levels,
// and the style rules hold (British English, sentence case, no all caps, no exclamation marks,
// no em dashes, no "Oops").
import { createRequire } from 'node:module';
import { relative } from 'node:path';
import { CATALOGUE, CONTEXT, MAX_DEPTH, NAMESPACES, ROOT, depthOf, flatten, readJson, sortDeep } from './lib.mjs';
import { references, sourceFiles } from './scan.mjs';

const require = createRequire(new URL('../../packages/messages/package.json', import.meta.url));
const { parse } = require('@formatjs/icu-messageformat-parser');

const catalogueTree = readJson(CATALOGUE);
const contextTree = readJson(CONTEXT);
const catalogue = flatten(catalogueTree);
const context = flatten(contextTree, '', {}, 'context');
const keys = new Set(Object.keys(catalogue));
const errors = [];
const warn = (msg) => errors.push(msg);

// Structure.
if (JSON.stringify(sortDeep(catalogueTree)) !== JSON.stringify(catalogueTree)) warn('en-GB.json keys are not sorted alphabetically; run pnpm messages:merge or sort by hand');
if (JSON.stringify(sortDeep(contextTree)) !== JSON.stringify(contextTree)) warn('en-GB.context.json keys are not sorted alphabetically');
for (const ns of Object.keys(catalogueTree)) if (!NAMESPACES.includes(ns)) warn(`unknown namespace "${ns}"; allowed: ${NAMESPACES.join(', ')}`);
for (const key of keys) {
  if (depthOf(key) > MAX_DEPTH) warn(`${key}: deeper than ${MAX_DEPTH} levels`);
  for (const seg of key.split('.')) if (!/^[a-z][A-Za-z0-9]*$/.test(seg)) warn(`${key}: segment "${seg}" is not camelCase`);
  if (typeof catalogue[key] !== 'string') warn(`${key}: value is not a string`);
}

// ICU syntax.
const ACRONYMS = /^(ASP|CP|MARAC|MAPPA|MAPPP|AWI|IRD|CPPM|MHO|IDAA|DAQ|DASH|NHS|GP|SPS|SCRA|CHI|ID|CSV|JSON|PDF|RSO|RSOs|SHPO|SHPOs|SOPO|SOPOs|RSHO|RSHOs|SRO|SROs|FTO|FTOs|LSI|RMP|ERA|ViSOR|VISOR|PPU|SONR|HSCP|UK|DS|PC|DC|DI|A|I|OK|NMDS|SOG|MOG|AWIA|POA|PPO|NASSO|IMPACT|DVPO|DVPN|HMP|SCR|ICR|WCAG|URL|API|UI|CLDR|ICU|IT|TODO|EDD|DOB|GIRFEC|SHANARRI|SPOC|SPOCs|NSPCC|HR|VAT|FTE|GIRFEC)$/;
const AMERICAN = /\b(color|colors|colour\b(?!)|organiz\w*|center\b|centers\b|favor\w*|behavior\w*|analyz\w*|catalog\b|catalogs\b|defense|gray\b|program\b(?! (code|that|which))|license\b(?= (number|plate|to)|$)|licenses\b|practise\w* not|apologize|realize|recognize|neighbor\w*|traveled|canceled|enrollment|jewelry|mom\b|math\b|fall\b(?= term))\b/i;
for (const [key, message] of Object.entries(catalogue)) {
  if (typeof message !== 'string') continue;
  try {
    parse(message);
  } catch (e) {
    warn(`${key}: ICU syntax error: ${e.message}`);
  }
  if (/\u2014/.test(message)) warn(`${key}: em dash`);
  if (/!/.test(message)) warn(`${key}: exclamation mark`);
  if (/\boops\b/i.test(message)) warn(`${key}: "Oops"`);
  const words = message.replace(/\{[^}]*\}/g, ' ').split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  const capsWords = words.filter((w) => /^[A-Z][A-Z0-9'&/-]+$/.test(w) && !ACRONYMS.test(w.replace(/[^A-Za-z]/g, '')));
  if (words.length >= 2 && capsWords.length === words.length) warn(`${key}: all-caps label "${message}"`);
  if (words.length === 1 && capsWords.length === 1 && words[0].length > 5) warn(`${key}: all-caps word "${words[0]}"`);
  const american = message.match(AMERICAN);
  if (american) warn(`${key}: American spelling "${american[0]}"`);
}

// Context coverage.
for (const key of keys) {
  const c = context[key];
  if (!c || typeof c !== 'object') warn(`${key}: no entry in en-GB.context.json`);
  else if (typeof c.where !== 'string' || !c.where.trim()) warn(`${key}: context entry has no "where"`);
}
for (const key of Object.keys(context)) if (!keys.has(key)) warn(`${key}: context entry has no message`);

// References.
const referenced = new Set();
const patterns = new Set();
const unknownStatic = [];
for (const file of sourceFiles()) {
  const r = references(file, keys);
  for (const k of r.found) referenced.add(k);
  for (const p of r.patterns) patterns.add(p);
  // Static t('...') calls with unknown keys.
  if (!file.endsWith('.rs')) {
    const text = require('node:fs').readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\bt(?:\.rich)?\(\s*'([^']+)'/g)) if (!keys.has(m[1])) unknownStatic.push(`${relative(ROOT, file)}: t('${m[1]}') is not in the catalogue`);
  }
}
for (const u of unknownStatic) warn(u);
const prefixes = [...patterns].map((p) => p.slice(0, -1));
for (const key of keys) {
  if (referenced.has(key)) continue;
  if (prefixes.some((p) => key.startsWith(p))) continue;
  warn(`${key}: not referenced anywhere`);
}

if (errors.length) {
  console.error(`messages:check found ${errors.length} problem${errors.length === 1 ? '' : 's'}:`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`messages:check passed: ${keys.size} keys, ${Object.keys(catalogueTree).length} namespaces`);
