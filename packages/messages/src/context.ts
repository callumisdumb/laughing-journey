/** The editor's context for every key: where it appears, a length cap, whether it is verbatim, a screenshot. */
import contextTree from './en-GB.context.json';

export interface ContextEntry {
  where: string;
  maxLength?: number;
  verbatim?: boolean;
  screenshot?: string;
}

interface ContextNode {
  [key: string]: ContextEntry | ContextNode;
}

function isEntry(value: ContextEntry | ContextNode): value is ContextEntry {
  return typeof (value as ContextEntry).where === 'string';
}

function flattenContext(tree: ContextNode, prefix = ''): Record<string, ContextEntry> {
  const out: Record<string, ContextEntry> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isEntry(value)) out[path] = value;
    else Object.assign(out, flattenContext(value, path));
  }
  return out;
}

export const CONTEXT: Record<string, ContextEntry> = flattenContext(contextTree);

export function contextFor(key: string): ContextEntry | undefined {
  return CONTEXT[key];
}
