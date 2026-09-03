import { t } from '@mas/messages';
import { z } from 'zod';
import { EXCLUSION_PARTIES, EXCLUSION_PARTY_LABELS, type ExclusionParty } from '../enums';
import { normalisePartyName } from '../need-to-know/parties';
import type { CaseParty } from '../schemas/process';

/**
 * "Is there anyone else who must not receive information about this case?"
 *
 * Asked on the MARAC referral (the DAQ that accompanies it) and on the MAPPA referral. Each answer
 * names someone the record does not already link to the case. It goes on the case-role register as a
 * manual entry keyed by the typed name, so the hard exclusions for the process catch them. The parties
 * offered on each form are the roles the exclusion rows name for that process.
 *
 * The question text lives in the catalogue (forms.mustNotReceive.question); read it here so an
 * Admin override applies wherever the domain quotes it.
 */
export function mustNotReceiveQuestion(): string {
  return t('forms.mustNotReceive.question');
}

/** MARAC: the perpetrator and the perpetrator's family or associates. */
export const MARAC_MUST_NOT_RECEIVE_PARTIES = ['perpetrator-associates', 'perpetrator'] as const satisfies readonly ExclusionParty[];
/** MAPPA: victims, employers, the offender's family or associates and members of the public. */
export const MAPPA_MUST_NOT_RECEIVE_PARTIES = ['victim', 'employer', 'perpetrator-associates', 'public'] as const satisfies readonly ExclusionParty[];

export const mustNotReceiveEntrySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: () => t('errors.mustNotReceive.name') })
    .max(120, { error: () => t('errors.forms.maxLength', { max: 120 }) }),
  party: z.enum(EXCLUSION_PARTIES),
  relationship: z
    .string()
    .trim()
    .max(120, { error: () => t('errors.forms.maxLength', { max: 120 }) })
    .optional(),
  reason: z
    .string()
    .trim()
    .min(5, { error: () => t('errors.mustNotReceive.reason') })
    .max(400, { error: () => t('errors.forms.maxLength', { max: 400 }) }),
});
export type MustNotReceiveEntry = z.infer<typeof mustNotReceiveEntrySchema>;
export type MustNotReceiveEntryInput = z.input<typeof mustNotReceiveEntrySchema>;

/** The repeatable field for one form, limited to the parties that make sense for its process. */
export function mustNotReceiveListSchema<const T extends readonly [ExclusionParty, ...ExclusionParty[]]>(parties: T) {
  return z.array(mustNotReceiveEntrySchema.extend({ party: z.enum(parties) })).default([]);
}

/**
 * A case-role register entry from one answer: a manual entry keyed by the typed name. `via` names the
 * form in the label, e.g. "the DAQ" or "the MAPPA referral".
 */
export function casePartyFromMustNotReceive(entry: MustNotReceiveEntry, since: string, via: string): CaseParty {
  const partyLabel = EXCLUSION_PARTY_LABELS[entry.party];
  const relationship = entry.relationship?.trim();
  return {
    name: entry.name.trim(),
    party: entry.party,
    label: relationship ? `${partyLabel}: ${relationship} (named on ${via})` : `${partyLabel} (named on ${via})`,
    since,
    source: 'manual',
    reason: entry.reason.trim(),
  };
}

export interface RegisterUpdate {
  parties: CaseParty[];
  /** Entries that were new to the register. */
  added: number;
  /** Entries that replaced one already recorded for the same name and party. */
  updated: number;
}

/**
 * The register with the answers added. An answer that repeats a name already recorded for the same
 * party replaces that entry rather than duplicating it; names match case-insensitively after trimming.
 */
export function withMustNotReceive(existing: CaseParty[], entries: MustNotReceiveEntry[], since: string, via: string): RegisterUpdate {
  const parties = [...existing];
  let added = 0;
  let updated = 0;
  for (const entry of entries) {
    const party = casePartyFromMustNotReceive(entry, since, via);
    const key = normalisePartyName(party.name ?? '');
    const i = parties.findIndex((p) => p.party === party.party && p.name !== undefined && normalisePartyName(p.name) === key);
    if (i >= 0) {
      parties[i] = party;
      updated += 1;
    } else {
      parties.push(party);
      added += 1;
    }
  }
  return { parties, added, updated };
}

/** Audit wording for a register update, e.g. "Case-role register: 2 entries added from the DAQ". */
export function registerUpdateLabel(update: RegisterUpdate, via: string): string {
  const count = (n: number, verb: string) => `${n} ${n === 1 ? 'entry' : 'entries'} ${verb}`;
  const parts: string[] = [];
  if (update.added > 0) parts.push(count(update.added, 'added'));
  if (update.updated > 0) parts.push(count(update.updated, 'updated'));
  return `Case-role register: ${parts.length > 0 ? parts.join(', ') : 'no change'} from ${via}`;
}
