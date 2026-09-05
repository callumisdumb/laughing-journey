// Shared helpers for the message catalogue scripts.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const ROOT = resolve(new URL('../..', import.meta.url).pathname);
export const CATALOGUE = resolve(ROOT, 'packages/messages/src/en-GB.json');
export const CONTEXT = resolve(ROOT, 'packages/messages/src/en-GB.context.json');
export const GENERATED = resolve(ROOT, 'packages/messages/src/keys.generated.ts');
export const NAMESPACES = ['product', 'common', 'nav', 'states', 'errors', 'forms', 'home', 'worklist', 'search', 'person', 'chronology', 'inbox', 'processes', 'asp', 'cp', 'marac', 'mappa', 'awi', 'meetings', 'actions', 'sharing', 'connectors', 'reports', 'audit', 'admin', 'settings', 'help', 'glossary', 'print', 'desktop', 'domain', 'demoClock', 'demo', 'compare', 'links', 'permissions', 'practitioner', 'simulator', 'notifications'];
export const MAX_DEPTH = 4;

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** A context entry is an object whose `where` is a string; a catalogue leaf is a string. */
export function isContextEntry(value) {
  return value !== null && typeof value === 'object' && typeof value.where === 'string';
}

/** Flatten a nested tree to dot keys. mode 'catalogue' stops at strings, 'context' at context entries. */
export function flatten(tree, prefix = '', out = {}, mode = 'catalogue') {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const leaf = mode === 'context' ? isContextEntry(value) || typeof value !== 'object' || value === null : typeof value !== 'object' || value === null;
    if (!leaf) flatten(value, path, out, mode);
    else out[path] = value;
  }
  return out;
}

/** Sort every object's keys alphabetically, recursively. */
export function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort((a, b) => a.localeCompare(b, 'en'))
        .map((k) => [k, sortDeep(value[k])]),
    );
  }
  return value;
}

export function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(sortDeep(value), null, 2)}\n`);
}

/** Set a dotted key in a nested object. */
export function setPath(tree, path, value) {
  const parts = path.split('.');
  let node = tree;
  for (const part of parts.slice(0, -1)) {
    if (typeof node[part] !== 'object' || node[part] === null) node[part] = {};
    node = node[part];
  }
  node[parts[parts.length - 1]] = value;
}

export function depthOf(path) {
  return path.split('.').length;
}
