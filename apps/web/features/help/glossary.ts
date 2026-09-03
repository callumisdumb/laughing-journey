import { tKey } from '@mas/messages';

/**
 * Appendix A of the brief, in display order. Each id names `glossary.<id>.term` and
 * `glossary.<id>.definition` in the message catalogue; the text lives there, not here.
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

/** Every glossary entry with its current wording, including any Admin override. */
export function glossaryEntries(): GlossaryEntry[] {
  return GLOSSARY_IDS.map((id) => ({ id, term: tKey(`glossary.${id}.term`), definition: tKey(`glossary.${id}.definition`) }));
}
