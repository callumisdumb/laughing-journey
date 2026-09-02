'use client';

import { applyLens, eventFamily, type ChronologyAnalysis, type ChronologyEvent, type LensResult, type Person, type Process } from '@mas/domain';
import { useMemo } from 'react';
import { accessForUser, eventsForPerson, personById, processesForPerson } from '@/lib/selectors';
import { useAppStore, useConfig, useCurrentUser, useData, useNow } from '@/lib/store';
import { useChronologyStore, type Window } from './state';

export interface ChronologyModel {
  person: Person | undefined;
  processes: Process[];
  /** All events the user may see for the current view, before filters. */
  visible: ChronologyEvent[];
  /** After filters and window. */
  events: ChronologyEvent[];
  analyses: ChronologyAnalysis[];
  lensResults: LensResult[];
  highlighted: Set<string>;
  domain: Window;
  agencies: ChronologyEvent['agency'][];
  canSeeIntegrated: boolean;
}

export function useChronology(personId: string): ChronologyModel {
  const data = useData();
  const config = useConfig();
  const user = useCurrentUser();
  const now = useNow();
  const grants = useAppStore((s) => s.session.breakGlass);
  const view = useChronologyStore((s) => s.view);
  const window = useChronologyStore((s) => s.window);
  const filters = useChronologyStore((s) => s.filters);
  const lenses = useChronologyStore((s) => s.lenses);

  return useMemo(() => {
    const person = personById(data, personId);
    const processes = person ? processesForPerson(data, person.id) : [];
    const all = person ? eventsForPerson(data, person.id) : [];
    const access = user ? processes.map((p) => accessForUser(data, config, user, p, grants, now)) : [];
    const canSeeIntegrated = access.some((a) => a.level === 'full' || a.level === 'summary') || (user ? processes.length === 0 : false);
    const restrictedOk = new Set(processes.filter((p, i) => p.classification === 'restricted' && access[i]?.level === 'full').map((p) => p.id));

    const visible = all.filter((e) => {
      if (!user) return false;
      if (e.visibility === 'restricted' && !e.linkedProcessIds.some((id) => restrictedOk.has(id))) return false;
      if (view === 'single') return e.agency === user.agency;
      if (!canSeeIntegrated) return e.agency === user.agency;
      if (view === 'pack') return (e.visibility === 'integrated' || e.visibility === 'restricted') && e.significance !== 'low';
      return e.visibility === 'integrated' || e.visibility === 'restricted' || e.agency === user.agency;
    });

    const sortedAsc = [...visible].sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1));
    const first = sortedAsc[0]?.occurredAt ?? now.toISOString();
    const domain: Window = window ?? { from: first.slice(0, 10) < now.toISOString().slice(0, 10) ? first : now.toISOString(), to: now.toISOString() };

    const events = visible.filter((e) => {
      if (filters.agencies.length && !filters.agencies.includes(e.agency)) return false;
      if (filters.families.length && !filters.families.includes(eventFamily(e.eventType))) return false;
      if (filters.significance.length && !filters.significance.includes(e.significance)) return false;
      if (filters.processId && !e.linkedProcessIds.includes(filters.processId)) return false;
      if (filters.source === 'manual' && e.sourceSystem !== 'manual') return false;
      if (filters.source === 'connector' && e.sourceSystem === 'manual') return false;
      if (filters.visibility.length && !filters.visibility.includes(e.visibility)) return false;
      if (window && (e.occurredAt < window.from || e.occurredAt > window.to)) return false;
      return true;
    });

    const analyses = person ? data.analyses.filter((a) => a.subjectId === person.id && (view !== 'single' || a.agency === user?.agency)) : [];
    const lensResults = lenses.map((id) => applyLens(id, visible, now));
    const highlighted = new Set(lensResults.flatMap((r) => r.eventIds));
    const agencies = [...new Set(visible.map((e) => e.agency))];
    return { person, processes, visible, events, analyses, lensResults, highlighted, domain, agencies, canSeeIntegrated };
  }, [data, config, user, grants, now, personId, view, window, filters, lenses]);
}
