import { localDateOf, type Dataset, type Person } from '@mas/domain';
import { differenceInYears, parseISO } from 'date-fns';

/** The address lines a person was recorded at on a given day, from their dated address history. */
export function addressLineAt(data: Dataset, person: Person, isoInstant: string): string | undefined {
  const d = localDateOf(isoInstant);
  const sorted = [...person.addressHistory].sort((a, b) => (a.from < b.from ? -1 : 1));
  const period = sorted.find((a) => a.from <= d && (!a.to || a.to >= d)) ?? sorted[sorted.length - 1];
  const addr = period ? data.addresses.find((a) => a.id === period.addressId) : undefined;
  return addr ? [addr.line1, addr.line2].filter(Boolean).join(', ') : undefined;
}

export function ageOn(dateOfBirth: string, isoDate: string): number {
  return differenceInYears(parseISO(isoDate), parseISO(dateOfBirth));
}
