import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../config/default-config';
import { DOCUMENT_LIMITS, type Document } from '../schemas/document';
import type { Process } from '../schemas/process';
import { bytesOnRecord, documentClassification, documentRefusals, markedFileName } from './index';

const doc = (id: string, size: number, parentId = 'per_1'): Document => ({ id, synthetic: true, parent: { kind: 'person', id: parentId }, name: `${id}.pdf`, mimeType: 'application/pdf', size, dataUri: 'data:application/pdf;base64,AA==', classification: { level: 'official', sensitive: false, handling: [] }, addedAt: '2026-09-02T09:00:00Z', addedByName: 'Test' });

describe('documentRefusals', () => {
  it('accepts a file within both caps', () => {
    expect(documentRefusals({ name: 'letter.pdf', size: 1000, mimeType: 'application/pdf', totalOnRecord: 0 })).toEqual([]);
  });
  it('refuses a file over the per-file cap, and a file that would take the record over its cap', () => {
    expect(documentRefusals({ name: 'scan.pdf', size: DOCUMENT_LIMITS.file + 1, mimeType: 'application/pdf', totalOnRecord: 0 })).toEqual(['documentTooLarge']);
    expect(documentRefusals({ name: 'scan.pdf', size: 1000, mimeType: 'application/pdf', totalOnRecord: DOCUMENT_LIMITS.record - 999 })).toEqual(['documentRecordFull']);
    expect(documentRefusals({ name: 'scan.pdf', size: 1000, mimeType: 'application/pdf', totalOnRecord: DOCUMENT_LIMITS.record - 1000 })).toEqual([]);
  });
  it('refuses an empty file, an unnamed one and one with no type', () => {
    expect(documentRefusals({ name: ' ', size: 0, mimeType: '', totalOnRecord: 0 })).toEqual(['documentNameRequired', 'documentEmpty', 'documentTypeRequired']);
  });
});

describe('bytesOnRecord', () => {
  it('sums the live files on one parent and ignores the rest', () => {
    const docs = [doc('a', 100), doc('b', 200), { ...doc('c', 400), recordedInError: { at: '2026-09-02T09:00:00Z', byName: 'Test', reason: 'Wrong record' } } as Document, doc('d', 800, 'per_2')];
    expect(bytesOnRecord(docs, { kind: 'person', id: 'per_1' })).toBe(300);
  });
});

describe('markedFileName', () => {
  it('prefixes the marking and leaves Official alone', () => {
    expect(markedFileName({ level: 'official', sensitive: false, handling: [] }, 'letter.pdf')).toBe('letter.pdf');
    expect(markedFileName({ level: 'official', sensitive: true, handling: [] }, 'letter.pdf')).toBe('OFFICIAL-SENSITIVE-letter.pdf');
  });
});

describe('documentClassification', () => {
  const marac = { id: 'prc_1', type: 'marac', subjectIds: ['per_1'], classification: { level: 'official', sensitive: true, handling: [] }, accessRestriction: 'unrestricted' } as unknown as Process;
  const asp = { id: 'prc_2', type: 'asp', subjectIds: ['per_1', 'per_2'], classification: { level: 'official', sensitive: false, handling: [] }, accessRestriction: 'unrestricted' } as unknown as Process;
  const data = { processes: [marac, asp], meetings: [{ id: 'mtg_1', processId: 'prc_1' }, { id: 'mtg_2', processId: 'prc_2' }], events: [{ id: 'evt_1', linkedProcessIds: ['prc_2'] }, { id: 'evt_2', linkedProcessIds: [] }] } as unknown as Parameters<typeof documentClassification>[2];
  it('takes the case, the meeting\'s case and the event\'s case', () => {
    expect(documentClassification(DEFAULT_CONFIG, { kind: 'process', id: 'prc_1' }, data).sensitive).toBe(true);
    expect(documentClassification(DEFAULT_CONFIG, { kind: 'meeting', id: 'mtg_1' }, data).sensitive).toBe(true);
    expect(documentClassification(DEFAULT_CONFIG, { kind: 'meeting', id: 'mtg_2' }, data).sensitive).toBe(false);
    expect(documentClassification(DEFAULT_CONFIG, { kind: 'event', id: 'evt_1' }, data).sensitive).toBe(false);
  });
  it('takes the highest of a person\'s cases, and Official where there is nothing behind the record', () => {
    expect(documentClassification(DEFAULT_CONFIG, { kind: 'person', id: 'per_1' }, data).sensitive).toBe(true);
    expect(documentClassification(DEFAULT_CONFIG, { kind: 'person', id: 'per_2' }, data).sensitive).toBe(false);
    expect(documentClassification(DEFAULT_CONFIG, { kind: 'event', id: 'evt_2' }, data)).toEqual({ level: 'official', sensitive: false, handling: [] });
    expect(documentClassification(DEFAULT_CONFIG, { kind: 'person', id: 'per_9' }, data)).toEqual({ level: 'official', sensitive: false, handling: [] });
  });
});
