import { tKey } from '@mas/messages';
import type { MatchReason } from '@mas/domain';

const REASON_KEYS: Record<Exclude<MatchReason['kind'], 'alias' | 'address'>, string> = {
  chi: 'chi',
  name: 'name',
  'name-transposed': 'nameTransposed',
  'dob-exact': 'dobExact',
  'dob-transposed': 'dobTransposed',
  'dob-day-month-swapped': 'dobDayMonthSwapped',
  'dob-year': 'dobYear',
  'expected-delivery': 'expectedDelivery',
};

/** Why this candidate came back, in the practitioner's words rather than the matcher's. */
export function reasonLabel(reason: MatchReason): string {
  if (reason.kind === 'alias') return tKey('person.create.reasons.alias', { alias: reason.alias });
  if (reason.kind === 'address') return tKey(`person.create.reasons.${reason.current ? 'addressCurrent' : 'addressPrevious'}`);
  return tKey(`person.create.reasons.${REASON_KEYS[reason.kind]}`);
}

/** A stable key for a reason chip, since the same kind never appears twice for one candidate. */
export function reasonKey(reason: MatchReason): string {
  return reason.kind === 'alias' ? `alias:${reason.alias}` : reason.kind === 'address' ? `address:${String(reason.current)}` : reason.kind;
}
