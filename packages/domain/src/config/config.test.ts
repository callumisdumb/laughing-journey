import { describe, expect, it } from 'vitest';
import { configSchema } from '../schemas/config';
import { DEFAULT_CONFIG } from './default-config';
import { glossaryLookup } from './glossary';
import { stageLabel } from './labels';

describe('default config', () => {
  it('is valid', () => {
    expect(() => configSchema.parse(DEFAULT_CONFIG)).not.toThrow();
  });
  it('uses the national IRD label', () => {
    expect(DEFAULT_CONFIG.labels['cp.ird']).toContain('Inter-agency');
  });
  it('looks up glossary terms case-insensitively', () => {
    expect(glossaryLookup('mappa')?.definition).toContain('Multi-Agency');
    expect(glossaryLookup('zzz')).toBeUndefined();
  });
  it('labels stages and falls back to the key', () => {
    expect(stageLabel('cp', 'ird')).toBe('IRD');
    expect(stageLabel('asp', 'unknown')).toBe('unknown');
  });
});
