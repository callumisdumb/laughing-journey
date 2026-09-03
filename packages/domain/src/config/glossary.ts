import { tKey } from '@mas/messages';

/**
 * Appendix A of the brief, in display order. Each id names `glossary.<id>.term` and
 * `glossary.<id>.definition` in the message catalogue; the text lives there, not here.
 * Used for first-use tooltips (the Term primitive) and the Help screen.
 */
export const GLOSSARY_IDS = [
  'apc',
  'asp',
  'awi',
  'chi',
  'cog',
  'cp',
  'cpc',
  'cpo',
  'cppm',
  'cswo',
  'daq',
  'dash',
  'dsdas',
  'dtc',
  'era',
  'girfec',
  'hscp',
  'idaa',
  'ird',
  'ivpd',
  'jii',
  'jpfe',
  'lsi',
  'lsCmi',
  'mappa',
  'mappp',
  'mapps',
  'marac',
  'matac',
  'mho',
  'mwc',
  'olr',
  'opg',
  'poa',
  'ppu',
  'ra',
  'rma',
  'rmp',
  'rm2000',
  'sa07',
  'scim',
  'scra',
  'seemis',
  'shanarri',
  'sog',
  'sonr',
  'sps',
  'vns',
  'visor',
] as const;
export type GlossaryId = (typeof GLOSSARY_IDS)[number];

export interface GlossaryEntry {
  id: GlossaryId;
  term: string;
  definition: string;
}

export function glossaryTerm(id: GlossaryId): string {
  return tKey(`glossary.${id}.term`);
}

export function glossaryDefinition(id: GlossaryId): string {
  return tKey(`glossary.${id}.definition`);
}

export function glossaryEntry(id: GlossaryId): GlossaryEntry {
  return { id, term: glossaryTerm(id), definition: glossaryDefinition(id) };
}

/** Every glossary entry in display order with its current wording, including any Admin override. */
export function glossaryEntries(): GlossaryEntry[] {
  return GLOSSARY_IDS.map(glossaryEntry);
}

/** Find an entry by its term, case-insensitively: the Term primitive passes the text it wraps. */
export function glossaryLookup(term: string): GlossaryEntry | undefined {
  const needle = term.toLowerCase();
  const id = GLOSSARY_IDS.find((g) => glossaryTerm(g).toLowerCase() === needle);
  return id ? glossaryEntry(id) : undefined;
}
