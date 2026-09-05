import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASP_AGE_BANDS, ASP_CLIENT_GROUPS, ASP_ETHNICITIES, ASP_GENDERS, ASP_HARM_LOCATIONS, ASP_INQUIRY_ACTIONS, ASP_REFERRAL_SOURCES, HARM_TYPES, LSI_SERVICE_TYPES } from '../enums';
import { NMDS_QUARTERS, NMDS_SHEETS, columnLetters, emptyNmdsFigures, formulaCells, nmdsCellMap, quarterColumn, type NmdsCell } from './cellMap';
import WORKBOOK_FIELDS from './workbook-2026-27.fields.json';

const WORKBOOK_ACTIONS = WORKBOOK_FIELDS.aspInquiryActions;

/**
 * The cell map, checked against the workbook it fills.
 *
 * The map's whole job is to put a figure in the right box of someone else's spreadsheet, and it is
 * the kind of code that can be confidently wrong: every cell reference is plausible, and nothing but
 * the workbook itself can say which one is right. So this file reads
 * docs/templates/ASP-data-workbook-2026-27.xlsx and asserts against it.
 *
 * Two properties matter most. Every cell the map writes must sit against the row label its figure
 * belongs to, so a Lead Officer reading down column A sees the figures they expect. And no cell the
 * map writes may be one the workbook computes for itself: a literal on top of a SUM is the failure
 * that would go unnoticed longest.
 */

const WORKBOOK = resolve(import.meta.dirname, '../../../../docs/templates/ASP-data-workbook-2026-27.xlsx');

/**
 * A tiny reader for the parts of xlsx this test needs: the shared string table, the sheet index, and
 * for one sheet the text and formula of each cell. ExcelJS could do it, but a test that reads the
 * template with the same library the writer uses would pass on a bug in that library; and the domain
 * package has no runtime dependencies, which is worth keeping.
 */
class Xlsx {
  private readonly entries = new Map<string, Buffer>();
  private readonly shared: string[] = [];
  /** Parsed sheets are cached: the assertions read the same sheet hundreds of times. */
  private readonly parsed = new Map<string, Map<string, { text: string; formula: boolean }>>();
  readonly sheets = new Map<string, string>();

  constructor(path: string) {
    const buffer = readFileSync(path);
    for (const [name, data] of readZip(buffer)) this.entries.set(name, data);
    const strings = this.xml('xl/sharedStrings.xml');
    if (strings) for (const si of matchAll(strings, /<si>([\s\S]*?)<\/si>/g)) this.shared.push(textOf(si(1)));
    const rels = new Map<string, string>();
    for (const m of matchAll(this.xml('xl/_rels/workbook.xml.rels') ?? '', /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) rels.set(m(1), m(2));
    for (const m of matchAll(this.xml('xl/workbook.xml') ?? '', /<sheet\b[^>]*\/>/g)) {
      const name = first(m(0), /name="([^"]+)"/);
      const id = first(m(0), /r:id="([^"]+)"/);
      const target = id ? rels.get(id) : undefined;
      if (name && target) this.sheets.set(decode(name), target.startsWith('xl/') ? target : `xl/${target.replace(/^\//, '')}`);
    }
  }

  private xml(name: string): string | undefined {
    const data = this.entries.get(name);
    return data ? data.toString('utf8') : undefined;
  }

  /** Every non-empty cell of a sheet: its text, and whether the workbook computes it. */
  cells(sheetName: string): Map<string, { text: string; formula: boolean }> {
    const cached = this.parsed.get(sheetName);
    if (cached) return cached;
    const path = this.sheets.get(sheetName);
    if (!path) throw new Error(`no sheet named ${sheetName}`);
    const xml = this.xml(path) ?? '';
    const out = new Map<string, { text: string; formula: boolean }>();
    for (const m of matchAll(xml, /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = first(m(1), /r="([^"]+)"/);
      if (!ref) continue;
      const body = m(2);
      const formula = /<f[\s>]/.test(body);
      const type = first(m(1), /t="([^"]+)"/);
      const value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      const inline = /<is>([\s\S]*?)<\/is>/.exec(body)?.[1];
      let text = '';
      if (type === 's' && value !== undefined) text = this.shared[Number(value)] ?? '';
      else if (inline !== undefined) text = textOf(inline);
      else if (value !== undefined) text = value;
      out.set(ref, { text, formula });
    }
    this.parsed.set(sheetName, out);
    return out;
  }
}

/** Enough of the zip format to read stored and deflated entries out of an xlsx. */
function readZip(buffer: Buffer): Array<[string, Buffer]> {
  const out: Array<[string, Buffer]> = [];
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error('not a zip file');
  let offset = buffer.readUInt32LE(end + 16);
  const count = buffer.readUInt16LE(end + 10);
  for (let i = 0; i < count; i += 1) {
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    const method = buffer.readUInt16LE(offset + 10);
    const compressed = buffer.readUInt32LE(offset + 20);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = buffer.subarray(start, start + compressed);
    out.push([name, method === 0 ? raw : inflateRawSync(raw)]);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return out;
}

/** A match, read by group index. A function rather than an array so a group is always a string. */
type Match = (group: number) => string;

function* matchAll(text: string, pattern: RegExp): Generator<Match> {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const found = m;
    yield (group) => found[group] ?? '';
  }
}

/** The first group of the first match, or an empty string. */
function first(text: string, pattern: RegExp, group = 1): string {
  return pattern.exec(text)?.[group] ?? '';
}

function decode(text: string): string {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function textOf(xml: string): string {
  return [...matchAll(xml, /<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m(1))).join('');
}

const book = new Xlsx(WORKBOOK);

/** An element that must be there: a missing one is a bug in the map, not a soft absence. */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`expected an item at index ${index} of ${items.length}`);
  return item;
}

/** Column letters and row number of a cell reference. */
function split(ref: string): { column: string; row: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!m) throw new Error(`bad cell reference ${ref}`);
  return { column: m[1] ?? '', row: Number(m[2]) };
}

/** The label in column A on the row a cell sits on. */
function labelFor(sheet: string, ref: string): string {
  return book.cells(sheet).get(`A${split(ref).row}`)?.text.trim() ?? '';
}

describe('columnLetters', () => {
  it('numbers columns the way a spreadsheet does', () => {
    expect(columnLetters(1)).toBe('A');
    expect(columnLetters(3)).toBe('C');
    expect(columnLetters(15)).toBe('O');
    expect(columnLetters(26)).toBe('Z');
    expect(columnLetters(27)).toBe('AA');
    expect(columnLetters(63)).toBe('BK');
  });
});

describe('the 2026-27 quarter columns', () => {
  it('lands on the columns the workbook heads with the right quarter', () => {
    // Every ordinary sheet heads its quarters on one row; sheet 1 uses row 5.
    const referrals = book.cells(NMDS_SHEETS.referrals);
    for (const [i, quarter] of NMDS_QUARTERS.entries()) {
      expect(referrals.get(`${quarterColumn(quarter)}5`)?.text.trim()).toBe(`Q${i + 1} 2026/27`);
    }
    expect(quarterColumn('q1')).toBe('O');
    expect(quarterColumn('q4')).toBe('R');
  });

  it('steps five columns a quarter on the age and gender sheet', () => {
    const age = book.cells(NMDS_SHEETS.ageAndGender);
    for (const [i, quarter] of NMDS_QUARTERS.entries()) {
      expect(age.get(`${quarterColumn(quarter, 5)}5`)?.text.trim()).toBe(`Q${i + 1} 2026/27`);
    }
    expect(quarterColumn('q1', 5)).toBe('BK');
  });
});

describe('nmdsCellMap', () => {
  const cells = nmdsCellMap(emptyNmdsFigures(), 'q1');
  const on = (sheet: string) => cells.filter((cell) => cell.sheet === sheet);

  it('names only sheets the workbook has', () => {
    for (const sheet of new Set(cells.map((c) => c.sheet))) {
      expect([...book.sheets.keys()]).toContain(sheet);
    }
  });

  it('never writes a cell the workbook computes for itself', () => {
    // Checked both ways: every cell the map lists as computed genuinely is a formula in the template,
    // and no cell the map emits sits on one.
    for (const quarter of NMDS_QUARTERS) {
      for (const ref of formulaCells(quarter)) {
        const [sheet = '', cell = ''] = ref.split('!');
        expect(book.cells(sheet).get(cell)?.formula, `${ref} should be a formula in the template`).toBe(true);
      }
      const listed = new Set(formulaCells(quarter));
      for (const cell of nmdsCellMap(emptyNmdsFigures(), quarter)) {
        expect(listed.has(`${cell.sheet}!${cell.cell}`), `${cell.sheet}!${cell.cell} is listed as computed`).toBe(false);
        expect(book.cells(cell.sheet).get(cell.cell)?.formula ?? false, `${cell.sheet}!${cell.cell} is a formula in the template`).toBe(false);
      }
    }
  });

  it('puts every referral source against its own row', () => {
    const rows = on(NMDS_SHEETS.referrals);
    expect(rows).toHaveLength(ASP_REFERRAL_SOURCES.length);
    expect(labelFor(NMDS_SHEETS.referrals, at(rows, 0).cell)).toBe('Mental Welfare Commission for Scotland');
    expect(labelFor(NMDS_SHEETS.referrals, rows.at(-1)!.cell)).toBe('Other (please specify below)');
    expect(split(at(rows, 0).cell)).toEqual({ column: 'O', row: 6 });
  });

  it('puts the two inquiry counts against their own rows', () => {
    const rows = on(NMDS_SHEETS.inquiries);
    expect(labelFor(NMDS_SHEETS.inquiries, at(rows, 0).cell)).toBe('Total inquiries where investigatory powers are not used');
    expect(labelFor(NMDS_SHEETS.inquiries, at(rows, 1).cell)).toBe('Total inquiries where  investigatory powers are used');
  });

  it('separates initial and review case conferences', () => {
    const rows = on(NMDS_SHEETS.conferences);
    expect(labelFor(NMDS_SHEETS.conferences, at(rows, 0).cell)).toBe('Number of initial case conferences');
    expect(labelFor(NMDS_SHEETS.conferences, at(rows, 1).cell)).toBe('Number of review case conferences');
  });

  it('writes an uptake percentage only where invitations were issued', () => {
    const none = nmdsCellMap(emptyNmdsFigures(), 'q1').filter((c) => c.sheet === NMDS_SHEETS.attendees);
    expect(none).toHaveLength(2);
    expect(none.map((c) => labelFor(NMDS_SHEETS.attendees, c.cell))).toEqual([
      'Adults at risk invited to attend a case conference (total)',
      'Number of case conferences where an independent advocate has been invited (total)',
    ]);
    const some = nmdsCellMap({ ...emptyNmdsFigures(), adultsInvited: 4, adultUptakePercent: 75, advocatesInvited: 2, advocateUptakePercent: 50 }, 'q1').filter((c) => c.sheet === NMDS_SHEETS.attendees);
    expect(some).toHaveLength(4);
    expect(some.map((c) => c.value)).toEqual([4, 75, 2, 50]);
    expect(labelFor(NMDS_SHEETS.attendees, at(some, 1).cell)).toBe('Adults at risk invited to attend a case conference (percentage uptake)');
  });

  it('puts plans and each order type against their own rows', () => {
    const rows = on(NMDS_SHEETS.plansAndPowers);
    expect(rows).toHaveLength(8);
    const labels = rows.map((r) => labelFor(NMDS_SHEETS.plansAndPowers, r.cell));
    expect(labels).toEqual([
      'Total number of managed ASPPs',
      'Total number of newly commenced ASPPs',
      'Assessment orders',
      'Removal orders',
      'Banning or temporary banning orders',
      'Assessment orders',
      'Removal orders',
      'Banning or temporary banning orders',
    ]);
    // Applied for is the first block and granted the second, which is the order the workbook prints.
    expect(split(at(rows, 2).cell).row).toBeLessThan(split(at(rows, 5).cell).row);
  });

  it('writes both action blocks against the workbook labels', () => {
    const rows = on(NMDS_SHEETS.actions);
    expect(rows).toHaveLength(ASP_INQUIRY_ACTIONS.length * 2);
    for (const [i, id] of ASP_INQUIRY_ACTIONS.entries()) {
      expect(labelFor(NMDS_SHEETS.actions, at(rows, i).cell)).toBe(labelFor(NMDS_SHEETS.actions, at(rows, i + ASP_INQUIRY_ACTIONS.length).cell));
      expect(id).toBeTruthy();
    }
    // The workbook's own row labels, taken from the transcription fixture rather than retyped: the
    // first uses an em dash and this file is not the place to reproduce one.
    expect(labelFor(NMDS_SHEETS.actions, at(rows, 0).cell)).toBe(WORKBOOK_ACTIONS[0]?.workbookRow);
    expect(labelFor(NMDS_SHEETS.actions, at(rows, 5).cell)).toBe('Pending/Unknown');
  });

  it('crosses age with gender in the right block of columns', () => {
    const rows = on(NMDS_SHEETS.ageAndGender);
    expect(rows).toHaveLength(ASP_AGE_BANDS.length * ASP_GENDERS.length);
    const sheet = book.cells(NMDS_SHEETS.ageAndGender);
    for (const cell of rows) {
      const { column, row } = split(cell.cell);
      // Column heading is the gender, row label is the age band, both from the workbook itself.
      expect(ASP_GENDERS.map((g) => g as string)).toBeTruthy();
      expect(['Male', 'Female', 'Trans or non-binary', 'Prefer not to say']).toContain(sheet.get(`${column}6`)?.text.trim());
      expect(sheet.get(`A${row}`)?.text.trim()).toBeTruthy();
    }
    expect(at(rows, 0).cell).toBe('BK7');
    expect(sheet.get('A7')?.text.trim()).toBe('16-17');
    expect(sheet.get('BK6')?.text.trim()).toBe('Male');
    // The fifth column of the block is the workbook's own total and is never written.
    expect(rows.map((r) => split(r.cell).column)).not.toContain('BO');
  });

  it('fills every ethnicity, harm, location and client group row', () => {
    expect(on(NMDS_SHEETS.ethnicity)).toHaveLength(ASP_ETHNICITIES.length);
    expect(on(NMDS_SHEETS.harm)).toHaveLength(HARM_TYPES.length * 2);
    expect(on(NMDS_SHEETS.location)).toHaveLength(ASP_HARM_LOCATIONS.length * 2);
    expect(on(NMDS_SHEETS.clientGroup)).toHaveLength(ASP_CLIENT_GROUPS.length * 2);
    expect(labelFor(NMDS_SHEETS.ethnicity, at(on(NMDS_SHEETS.ethnicity), 0).cell)).toBe('White');
    expect(labelFor(NMDS_SHEETS.harm, at(on(NMDS_SHEETS.harm), 0).cell)).toBe('Physical harm');
    expect(labelFor(NMDS_SHEETS.location, at(on(NMDS_SHEETS.location), 0).cell)).toBe('Own home');
    expect(labelFor(NMDS_SHEETS.clientGroup, at(on(NMDS_SHEETS.clientGroup), 0).cell)).toBe('Dementia');
  });

  it('writes the three caring responsibility counts', () => {
    const rows = on(NMDS_SHEETS.caring);
    expect(rows.map((r) => labelFor(NMDS_SHEETS.caring, r.cell))).toEqual([
      'Number of inquiries where adult at risk has child care responsibilities',
      'Number of inquiries where adult at risk has caring responsibilities for other adults',
      'Number of cases where a child was present at the incident',
    ]);
  });

  it('writes LSI service types and the identifier lists', () => {
    const figures = { ...emptyNmdsFigures(), careHomeCsNumbers: ['CS2026099471', 'CS2026099472'], nhsHospitalCodes: ['Q101V'] };
    const rows = nmdsCellMap(figures, 'q1').filter((c) => c.sheet === NMDS_SHEETS.lsis);
    expect(rows).toHaveLength(LSI_SERVICE_TYPES.length + 3);
    expect(labelFor(NMDS_SHEETS.lsis, at(rows, 0).cell)).toBe('Care homes');
    const csRows = rows.filter((r) => typeof r.value === 'string' && r.value.startsWith('CS'));
    expect(csRows).toHaveLength(2);
    expect(labelFor(NMDS_SHEETS.lsis, at(csRows, 0).cell)).toBe('Care homes - unique CS number for each LSI');
    const hospital = rows.find((r) => r.value === 'Q101V')!;
    expect(labelFor(NMDS_SHEETS.lsis, hospital.cell)).toBe('National hospital code for each LSI commenced (see \'Notes on completion\')');
  });

  it('writes nought rather than leaving a cell blank', () => {
    // A blank cell in a national return means "not provided"; nought means "none".
    for (const cell of cells) {
      expect(cell.value).not.toBe('');
      expect(cell.value).not.toBeUndefined();
    }
    expect(cells.every((c) => typeof c.value === 'number' ? c.value === 0 : true)).toBe(true);
  });

  it('moves every cell one column along for each later quarter', () => {
    const q1 = nmdsCellMap(emptyNmdsFigures(), 'q1');
    const q4 = nmdsCellMap(emptyNmdsFigures(), 'q4');
    expect(q4).toHaveLength(q1.length);
    const shift = (cell: NmdsCell) => split(cell.cell).column;
    expect(shift(at(q1, 0))).toBe('O');
    expect(shift(at(q4, 0))).toBe('R');
    // Rows never move between quarters, only columns.
    for (const [i, cell] of q1.entries()) expect(split(at(q4, i).cell).row).toBe(split(cell.cell).row);
  });
});
