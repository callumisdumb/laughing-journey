'use client';

import { isExcludedParty, processLabel, type Person, type Process } from '@mas/domain';
import { useT } from '@mas/messages';
import { Pill } from '@mas/ui';
import { Ban, Eye } from 'lucide-react';
import { accessForUser, processesInvolving } from '@/lib/selectors';
import { useConfig, useCurrentUser, useData, useGrants, useNow } from '@/lib/store';

/**
 * Two marks a household or network row may carry, and neither of them leaks anything.
 *
 * The first says the person is themselves subject to a process the reader cannot open. That is
 * presence-level information and the brief asks for it explicitly: a worker should be able to see
 * that the household member is known without seeing what is known, because the alternative is that
 * they find out by accident or not at all.
 *
 * The second says the person must not receive information about a case the subject is on. That one
 * is not decoration: it is why the name beside it is not a link (D-098), and the register decides
 * it rather than the screen.
 */
export function KnownElsewhere({ person }: { person: Person }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const now = useNow();
  const grants = useGrants();
  if (!user) return null;

  const processes = processesInvolving(data, person.id);
  const presenceOnly = processes.length > 0 && processes.every((p) => {
    const level = accessForUser(data, config, user, p, grants, now).level;
    return level === 'presence' || level === 'none';
  });

  const excludedFrom: Process[] = data.processes.filter((p) => p.status === 'open' && isExcludedParty(p, { personId: person.id }, config.exclusions, p.stage, data.relationships) !== null);

  if (!presenceOnly && excludedFrom.length === 0) return null;

  return (
    <>
      {presenceOnly ? (
        <Pill size="sm" tone="outline" icon={<Eye size={12} aria-hidden="true" />} title={t('person.network.presenceOnlyHint')}>
          {t('person.network.presenceOnly')}
        </Pill>
      ) : null}
      {excludedFrom.map((process) => (
        <Pill key={process.id} size="sm" tone="critical" icon={<Ban size={12} aria-hidden="true" />}>
          {t('person.network.excludedHere', { process: processLabel(process.type) })}
        </Pill>
      ))}
    </>
  );
}
