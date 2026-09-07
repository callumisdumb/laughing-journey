import { describe, expect, it } from 'vitest';
import { changedFields, history, isRecordedInError, live, versionEntry, warrantsVersion, withRecordedInError, withVersion, type Correctable } from './correct';

interface Note extends Correctable {
  id: string;
  title: string;
  detail?: string;
  count?: number;
}

const note = (over: Partial<Note> = {}): Note => ({ id: 'n1', title: 'First', ...over });
const WHO = { at: '2026-09-04T10:00:00+01:00', byName: 'Janet Kerr' };

describe('changedFields', () => {
  it('reports only the named fields that moved, as strings a person can read', () => {
    const changed = changedFields(note({ detail: 'was', count: 1 }), note({ title: 'Second', detail: 'was', count: 2 }), ['title', 'detail', 'count']);
    expect(changed).toEqual([
      { field: 'title', from: 'First', to: 'Second' },
      { field: 'count', from: '1', to: '2' },
    ]);
  });

  it('treats an absent value as an empty string rather than the word undefined', () => {
    expect(changedFields(note(), note({ detail: 'now' }), ['detail'])).toEqual([{ field: 'detail', from: '', to: 'now' }]);
  });

  it('ignores fields the caller did not name, including the version list itself', () => {
    const before = note();
    const after = withVersion(note({ title: 'Second' }), versionEntry({ ...WHO, change: 'Renamed' }));
    expect(changedFields(before, after, ['detail'])).toEqual([]);
  });
});

describe('version entries', () => {
  it('keeps what the corrected fields held before, so the original stays readable', () => {
    const changed = changedFields(note(), note({ title: 'Second' }), ['title']);
    const entry = versionEntry({ ...WHO, change: 'Title corrected', reason: 'It was typed wrong.', changed });
    expect(entry.before).toEqual({ title: 'First' });
    expect(entry.reason).toBe('It was typed wrong.');
  });

  it('writes no before map where nothing changed', () => {
    expect(versionEntry({ ...WHO, change: 'Saved' }).before).toBeUndefined();
  });

  it('appends rather than replacing, and returns the record untouched for a null entry', () => {
    const once = withVersion(note(), versionEntry({ ...WHO, change: 'One' }));
    const twice = withVersion(once, versionEntry({ ...WHO, change: 'Two' }));
    expect(twice.versions?.map((v) => v.change)).toEqual(['One', 'Two']);
    const same = note();
    expect(withVersion(same, null)).toBe(same);
  });

  it('reads history newest first, which is the order a reader wants', () => {
    const twice = withVersion(withVersion(note(), versionEntry({ ...WHO, change: 'One' })), versionEntry({ ...WHO, change: 'Two' }));
    expect(history(twice).map((v) => v.change)).toEqual(['Two', 'One']);
  });

  it('warrants an entry for a real change or for any correction, and not for a save that changed nothing', () => {
    expect(warrantsVersion([], undefined)).toBe(false);
    expect(warrantsVersion([{ field: 'title', from: 'a', to: 'b' }], undefined)).toBe(true);
    // A correction always writes one, because the reason is the point of it.
    expect(warrantsVersion([], 'The date was wrong on the referral.')).toBe(true);
  });
});

describe('recorded in error', () => {
  it('marks rather than removes, and keeps everything else on the record', () => {
    const marked = withRecordedInError(note({ detail: 'still here' }), { ...WHO, reason: 'Opened on the wrong person.' });
    expect(marked.detail).toBe('still here');
    expect(isRecordedInError(marked)).toBe(true);
    expect(isRecordedInError(note())).toBe(false);
  });

  it('is what a working view filters on, and only a working view', () => {
    const all = [note({ id: 'a' }), withRecordedInError(note({ id: 'b' }), { ...WHO, reason: 'Opened on the wrong person.' }), note({ id: 'c' })];
    expect(live(all).map((n) => n.id)).toEqual(['a', 'c']);
    // The record itself is still there for the audit ledger and for any pack already distributed.
    expect(all).toHaveLength(3);
  });
});
