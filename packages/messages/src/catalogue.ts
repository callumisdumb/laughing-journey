/**
 * The bundled catalogue, flattened to dot-separated keys. `en-GB.json` is the only place a
 * user-visible string lives; `en-GB.local.json` is the optional local overrides file for a
 * deployment (empty by default); session overrides come from the provider's store.
 */
import bundled from './en-GB.json';
import local from './en-GB.local.json';

export type Messages = Record<string, string>;

/** Nested catalogue object: strings at the leaves, at most four levels deep. */
export interface CatalogueTree {
  [key: string]: string | CatalogueTree;
}

export const LOCALE = 'en-GB';
export const TIME_ZONE = 'Europe/London';

export function flatten(tree: CatalogueTree, prefix = ''): Messages {
  const out: Messages = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

export const BUNDLED: Messages = flatten(bundled);
export const LOCAL_OVERRIDES: Messages = flatten(local);
export const NAMESPACES: string[] = Object.keys(bundled).sort();
