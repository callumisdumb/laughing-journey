/**
 * A tiny reader for the parts of xlsx the domain tests need: the shared string table, the sheet
 * index, and for one sheet the text and formula of each cell. ExcelJS could do it, but a test that
 * reads a template with the same library the writer uses would pass on a bug in that library; and
 * the domain package has no runtime dependencies, which is worth keeping. Test support only: nothing
 * under src imports this except a test.
 */
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

export class Xlsx {
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
