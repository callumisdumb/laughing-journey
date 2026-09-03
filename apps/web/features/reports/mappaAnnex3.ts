/**
 * MAPPA annual report: the nine tables in Annex 3 of the MAPPA National Guidance that every
 * Strategic Oversight Group report must carry (Management of Offenders etc. (Scotland) Act 2005
 * s11(3)). Reporting period 1 April to 31 March; point-in-time rows are read on 31 March.
 *
 * FIELD SET HIGH. The product owner confirmed on 03 Sep 2026 that the report carries these nine
 * tables for the year 1 April to 31 March: Tables 1, 3, 4, 5, 6, 7 and 9 from the record store,
 * Table 2 from the civil order register, Table 8 as "Data not held" only (D-048).
 *
 * PLACEHOLDER LABELS. The titles, column headers and row labels below were recovered on
 * 03 Sep 2026 from search extracts of published SOG annual reports and of the annex page; the
 * annex itself could not be read through the proxy (docs/RESEARCH.md, 6.7). When the supplied
 * Annex 3 text arrives, replace every `title`, `columns` entry and row `label` here word for word.
 * mappaModel.ts keys every figure on the row `id` and never on the wording, so this file is the
 * only one that changes.
 *
 * `confidence` records how each table's wording was recovered: 'extract' means the title (and
 * some rows) appear in a search extract of a published report; 'reconstructed' means the table's
 * place in the sequence is known but its wording was not read. It says nothing about the field
 * set, which is High for all nine.
 */

export const DATA_NOT_HELD = 'Data not held';

/** Where the figures come from: the record store, the civil order register, or nowhere. */
export type AnnexSource = 'data' | 'orders' | 'not-held';

export interface AnnexRow {
  id: string;
  label: string;
}

export interface AnnexTable {
  id: 'table-1' | 'table-2' | 'table-3' | 'table-4' | 'table-5' | 'table-6' | 'table-7' | 'table-8' | 'table-9';
  number: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  title: string;
  /** Column headers, the first being the row label column. */
  columns: string[];
  rows: AnnexRow[];
  source: AnnexSource;
  confidence: 'extract' | 'reconstructed';
}

export const MAPPA_ANNEX3_TABLES: readonly AnnexTable[] = [
  {
    id: 'table-1',
    number: 1,
    title: 'Registered sex offenders (RSOs)',
    columns: ['Measure', 'Number'],
    rows: [
      { id: 'community', label: 'RSOs in the community on 31 March' },
      { id: 'per-100k', label: 'RSOs per 100,000 of the population' },
      { id: 'breach', label: 'RSOs charged with breaching the notification requirements in the year' },
      { id: 'wanted', label: 'RSOs wanted on 31 March' },
      { id: 'missing', label: 'RSOs missing on 31 March' },
    ],
    source: 'data',
    confidence: 'extract',
  },
  {
    id: 'table-2',
    number: 2,
    title: 'Civil orders: Sexual Offences Prevention Orders, Risk of Sexual Harm Orders, Sexual Harm Prevention Orders and Sexual Risk Orders',
    columns: ['Measure', 'Number'],
    rows: [
      { id: 'sopo-in-force', label: 'Sexual Offences Prevention Orders (SOPOs) in force on 31 March' },
      { id: 'sopo-made', label: 'SOPOs made by the courts in the year' },
      { id: 'rsho-in-force', label: 'Risk of Sexual Harm Orders (RSHOs) in force on 31 March' },
      { id: 'rsho-made', label: 'RSHOs made by the courts in the year' },
      { id: 'shpo-in-force', label: 'Sexual Harm Prevention Orders (SHPOs) in force on 31 March' },
      { id: 'shpo-made', label: 'SHPOs made by the courts in the year' },
      { id: 'sro-in-force', label: 'Sexual Risk Orders (SROs) in force on 31 March' },
      { id: 'sro-made', label: 'SROs made by the courts in the year' },
      { id: 'breach-convictions', label: 'Convictions for breach of an order in the year' },
    ],
    source: 'orders',
    confidence: 'extract',
  },
  {
    id: 'table-3',
    number: 3,
    title: 'RSOs by MAPPA management level on 31 March',
    columns: ['Category', 'Level 1', 'Level 2', 'Level 3', 'Total'],
    rows: [{ id: 'rso', label: 'Registered sex offenders (Category 1)' }],
    source: 'data',
    confidence: 'reconstructed',
  },
  {
    id: 'table-4',
    number: 4,
    title: 'Restricted patients',
    columns: ['Measure', 'Number'],
    rows: [
      { id: 'total', label: 'Restricted patients the health board(s) in the MAPPA region had responsibility for on 31 March' },
      { id: 'level-1', label: 'Of whom managed at Level 1' },
      { id: 'level-2', label: 'Of whom managed at Level 2' },
      { id: 'level-3', label: 'Of whom managed at Level 3' },
    ],
    source: 'data',
    confidence: 'extract',
  },
  {
    id: 'table-5',
    number: 5,
    title: 'Other risk of serious harm offenders (Category 3)',
    columns: ['Measure', 'Number'],
    rows: [
      { id: 'total', label: 'Category 3 offenders managed under MAPPA on 31 March' },
      { id: 'level-2', label: 'Of whom managed at Level 2' },
      { id: 'level-3', label: 'Of whom managed at Level 3' },
      { id: 'referred', label: 'Category 3 offenders referred for multi-agency management in the year' },
    ],
    source: 'data',
    confidence: 'reconstructed',
  },
  {
    id: 'table-6',
    number: 6,
    title: 'RSOs in the community by sex on 31 March',
    columns: ['Sex', 'Number'],
    rows: [
      { id: 'male', label: 'Male' },
      { id: 'female', label: 'Female' },
      { id: 'not-recorded', label: 'Not recorded' },
      { id: 'total', label: 'Total' },
    ],
    source: 'data',
    confidence: 'reconstructed',
  },
  {
    id: 'table-7',
    number: 7,
    title: 'RSOs managed under statutory conditions and/or notification requirements on 31 March',
    columns: ['Measure', 'Number'],
    rows: [
      { id: 'supervision', label: 'Subject to statutory supervision on licence and to the notification requirements' },
      { id: 'sonr-only', label: 'Subject to the notification requirements only' },
      { id: 'total', label: 'Total' },
    ],
    source: 'data',
    confidence: 'extract',
  },
  {
    id: 'table-8',
    number: 8,
    title: 'MAPPA offenders charged with a serious further offence in the year',
    columns: ['Category', 'Number'],
    rows: [
      { id: 'category-1', label: 'Registered sex offenders (Category 1)' },
      { id: 'category-2', label: 'Restricted patients (Category 2)' },
      { id: 'category-3', label: 'Other risk of serious harm offenders (Category 3)' },
    ],
    source: 'not-held',
    confidence: 'reconstructed',
  },
  {
    id: 'table-9',
    number: 9,
    title: 'RSOs in custody and returned to custody',
    columns: ['Measure', 'Number'],
    rows: [
      { id: 'in-custody', label: 'RSOs in custody on 31 March' },
      { id: 'released', label: 'RSOs released from custody in the year' },
      { id: 'returned', label: 'RSOs returned to custody in the year' },
      { id: 'licence-breaches', label: 'Licence conditions breached in the year' },
    ],
    source: 'data',
    confidence: 'reconstructed',
  },
];
