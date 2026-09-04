'use client';

/**
 * The search index, built by decrypting rather than by checking a level.
 *
 * `readableCaseIds` is the set of cases whose content this reader actually opened. Every case-bound
 * record in the index hangs off that set, so the client's index contains what the client could
 * decrypt and nothing else. That is the whole claim, expressed as code rather than as a sentence in
 * the Help pages, and it is why the count of unsearchable cases is the only thing the reader is
 * told about the rest.
 */
import { type Dataset, type Person } from '@mas/domain';
import { useMemo } from 'react';
import { accessForUser, currentAddress, fullName } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useNow, useVault } from '@/lib/store';
import { readProcessDetail } from '@/lib/vault';
import type { SearchInput } from '@/lib/search';

/** Every address a person has lived at, as one line each, for the address match. */
function addressLinesFor(data: Dataset, person: Person): string[] {
  const lines = person.addressHistory
    .map((entry) => data.addresses.find((address) => address.id === entry.addressId))
    .filter((address) => address !== undefined)
    .map((address) => `${address.line1} ${address.line2 ?? ''} ${address.town} ${address.postcode}`);
  const current = currentAddress(data, person).line;
  return lines.length > 0 ? lines : [current];
}

export function useSearchInput(): SearchInput | null {
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const vault = useVault();
  const grants = useAppStore((s) => s.session.breakGlass);
  const now = useNow();
  // A grant expires, so the set has to be rebuilt when it does. The demo clock is fixed unless the
  // presenter moves it, so in practice this is one build per sign-in.
  const minute = Math.floor(now.getTime() / 60_000);

  return useMemo(() => {
    if (!user) return null;
    const at = new Date(minute * 60_000);
    const readableCaseIds = new Set<string>();
    let unsearchableCases = 0;
    for (const process of data.processes) {
      const access = accessForUser(data, config, user, process, grants, at);
      const opened = readProcessDetail(vault, process, user, access.breakGlass === 'active');
      if (opened.detail) readableCaseIds.add(process.id);
      else unsearchableCases += 1;
    }
    const addressLines = new Map<string, string[]>();
    const personNames = new Map<string, string>();
    for (const person of data.people) {
      addressLines.set(person.id, addressLinesFor(data, person));
      personNames.set(person.id, fullName(person));
    }
    return {
      readableCaseIds,
      unsearchableCases,
      people: data.people,
      users: data.users,
      processes: data.processes,
      events: data.events,
      meetings: data.meetings,
      actions: data.actions,
      plans: data.plans,
      addressLines,
      personNames,
    };
  }, [data, config, user, vault, grants, minute]);
}
