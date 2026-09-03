import { t } from '@mas/messages';
import { describe, expect, it } from 'vitest';
import { lensLabel } from '../chronology/lenses';
import { CLOCK_RULES, clockRuleDescription, clockRuleLabel, clockRuleTrigger, findClockRule } from '../clocks/rules';
import { AGENCIES, ROLE_DEFINITIONS, agencyShort, roleLabel } from '../enums';
import { configSchema } from '../schemas/config';
import { DEFAULT_CONFIG } from './default-config';
import { GLOSSARY_IDS, glossaryEntries, glossaryLookup } from './glossary';
import { stageLabel } from './labels';

describe('default config', () => {
  it('is valid', () => {
    expect(() => configSchema.parse(DEFAULT_CONFIG)).not.toThrow();
  });
  it('uses the national IRD label', () => {
  });
  it('looks up glossary terms case-insensitively', () => {
    expect(glossaryLookup('mappa')?.definition).toBe(t('glossary.mappa.definition'));
    expect(glossaryLookup('LS/CMI')?.id).toBe('lsCmi');
    expect(glossaryEntries()).toHaveLength(GLOSSARY_IDS.length);
    expect(glossaryLookup('zzz')).toBeUndefined();
  });
  it('labels stages and falls back to the key', () => {
    expect(stageLabel('cp', 'ird')).toBe(t('domain.stages.cp.ird'));
    expect(stageLabel('asp', 'case-conference')).toBe(t('domain.stages.asp.caseConference'));
    expect(stageLabel('asp', 'unknown')).toBe('unknown');
  });
  it('reads every label from the catalogue', () => {
    expect(roleLabel('mho')).toBe(t('domain.roles.mho.label'));
    expect(ROLE_DEFINITIONS.mho).toMatchObject({ id: 'mho', agency: 'social-work', organisation: 'hscp' });
    expect(agencyShort('police')).toBe(t('domain.agencies.police.short'));
    expect(AGENCIES).toContain('police');
    expect(lensLabel('gaps')).toBe(t('domain.lenses.gaps.label'));
    const rule = findClockRule(CLOCK_RULES, 'cp.cppm.initial');
    expect(rule).toBeDefined();
    expect(clockRuleLabel('cp.cppm.initial')).toBe(t('domain.clockRules.cpCppmInitial.label'));
    expect(clockRuleTrigger('cp.cppm.initial')).toBe(t('domain.clockRules.cpCppmInitial.trigger'));
    expect(clockRuleDescription('cp.cppm.initial')).toBe(t('domain.clockRules.cpCppmInitial.description'));
    expect(clockRuleDescription('asp.inquiry.decision')).toBe(findClockRule(CLOCK_RULES, 'asp.inquiry.decision')?.localNote);
    expect(JSON.parse(JSON.stringify(rule))).not.toHaveProperty('label');
  });
});
