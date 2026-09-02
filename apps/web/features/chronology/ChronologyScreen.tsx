'use client';

import { AGENCY_SHORT, EVENT_FAMILIES, EVENT_FAMILY_LABELS, LENS_IDS, LENS_LABELS, PROCESS_SHORT, formatDate, formatDateTime, type Agency, type EventFamily, type LensId, type Significance } from '@mas/domain';
import { Button, EmptyState, RestrictedState } from '@mas/ui';
import { subDays, subMonths, subYears } from 'date-fns';
import { ArrowLeft, Inbox, Plus, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { useNavigate, useRoute } from '@/lib/router';
import { personPath } from '@/lib/routes';
import { useSelection } from '@/lib/selection';
import { fullName, inboxForUser } from '@/lib/selectors';
import { useAppStore, useCurrentUser, useData, useNow } from '@/lib/store';
import { AddEventDialog } from './AddEventDialog';
import { EventList } from './EventList';
import { LanesChart } from './LanesChart';
import { PrintPack } from './PrintPack';
import { useChronologyStore } from './state';
import { useChronology } from './useChronology';
import styles from './ChronologyScreen.module.css';

export function ChronologyScreen({ personId }: { personId: string }) {
  const route = useRoute();
  const navigate = useNavigate();
  const data = useData();
  const user = useCurrentUser();
  const now = useNow();
  const dev = useDevState();
  const selectContext = useSelection((s) => s.select);
  const audit = useAppStore((s) => s.audit);
  const store = useChronologyStore();
  const reset = useChronologyStore((s) => s.reset);
  const model = useChronology(personId);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    reset(personId);
  }, [personId, reset]);

  useEffect(() => {
    if (store.selectedEventId) selectContext({ kind: 'event', id: store.selectedEventId, personId });
    else if (store.selectedAnalysisId) selectContext({ kind: 'analysis', id: store.selectedAnalysisId, personId });
    else selectContext({ kind: 'person', id: personId });
  }, [store.selectedEventId, store.selectedAnalysisId, personId, selectContext]);

  useEffect(() => {
    if (model.person) audit({ act: 'read', targetType: 'person', targetId: personId, targetLabel: `Chronology: ${fullName(model.person)}`, processId: model.processes[0]?.id });
    // audit once per person view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);

  if (!user) return null;
  if (!model.person) {
    return (
      <div className="page">
        <EmptyState title="Person not found" text="This record does not exist in the demo dataset." actions={<AppLink href="/people">Back to people</AppLink>} />
      </div>
    );
  }
  const person = model.person;
  const name = fullName(person);

  if (route.query.get('view') === 'print') return <PrintPack personId={personId} />;

  if (!model.canSeeIntegrated && model.processes.some((p) => p.classification === 'restricted') && model.visible.length === 0) {
    return (
      <div className="page">
        <RestrictedState reason="This person's chronology belongs to a restricted process and you are not on its distribution list." breakGlass="unavailable" />
      </div>
    );
  }

  const inboxCount = inboxForUser(data, user).filter((c) => c.subjectId === personId).length;
  const windowLabel = store.window ? `${formatDate(store.window.from)} to ${formatDate(store.window.to)}` : `${formatDate(model.domain.from)} to ${formatDate(model.domain.to)} (everything)`;

  function zoom(kind: 'all' | '3y' | '12m' | '90d' | '30d') {
    if (kind === 'all') return store.setWindow(null);
    const to = now.toISOString();
    const from = kind === '3y' ? subYears(now, 3) : kind === '12m' ? subMonths(now, 12) : kind === '90d' ? subDays(now, 90) : subDays(now, 30);
    store.setWindow({ from: from.toISOString(), to });
  }

  function toggle<T>(list: T[], v: T): T[] {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  const state = dev ?? (model.visible.length === 0 ? 'empty' : 'ready');

  return (
    <div className="page" data-width="wide">
      <div className="page-head">
        <div className="page-head-text">
          <AppLink href={personPath(personId)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)' }}>
            <ArrowLeft size={14} aria-hidden="true" /> {name}
          </AppLink>
          <h1>{name}: {store.view === 'single' ? `${AGENCY_SHORT[user.agency]} chronology` : store.view === 'pack' ? 'chronology as it appears in the meeting pack' : 'integrated chronology'}</h1>
          <p className="page-lede">
            {model.events.length} of {model.visible.length} events shown. Window: {windowLabel}.
          </p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.segmented} role="group" aria-label="Chronology view">
          <button type="button" className={styles.segment} aria-pressed={store.view === 'single'} onClick={() => store.setView('single')}>
            Single agency
          </button>
          <button type="button" className={styles.segment} aria-pressed={store.view === 'integrated'} onClick={() => store.setView('integrated')} disabled={!model.canSeeIntegrated}>
            Integrated
          </button>
          <button type="button" className={styles.segment} aria-pressed={store.view === 'pack'} onClick={() => store.setView('pack')} disabled={!model.canSeeIntegrated}>
            As it appears in the pack
          </button>
        </div>
        <div className={styles.segmented} role="group" aria-label="Time window">
          {(
            [
              ['all', 'All'],
              ['3y', '3 years'],
              ['12m', '12 months'],
              ['90d', '90 days'],
              ['30d', '30 days'],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" className={styles.segment} aria-pressed={k === 'all' ? store.window === null : false} onClick={() => zoom(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" icon={<Inbox size={16} aria-hidden="true" />} onClick={() => navigate('/inbox')} disabled={inboxCount === 0}>
            Review inbox ({inboxCount})
          </Button>
          <Button variant="secondary" icon={<Printer size={16} aria-hidden="true" />} onClick={() => navigate(`${route.path}?view=print`)}>
            Export pack
          </Button>
          <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setAdding(true)}>
            Add event
          </Button>
        </div>
      </div>

      <div className={styles.filters} role="group" aria-label="Filters">
        <span className={styles.filterLabel}>Agency</span>
        {model.agencies.map((a) => (
          <button key={a} type="button" className={styles.chip} aria-pressed={store.filters.agencies.includes(a)} onClick={() => store.setFilters({ agencies: toggle<Agency>(store.filters.agencies, a) })}>
            {AGENCY_SHORT[a]}
          </button>
        ))}
        <span className={styles.filterLabel}>Significance</span>
        {(['high', 'moderate', 'low'] as Significance[]).map((s) => (
          <button key={s} type="button" className={styles.chip} aria-pressed={store.filters.significance.includes(s)} onClick={() => store.setFilters({ significance: toggle<Significance>(store.filters.significance, s) })}>
            {s}
          </button>
        ))}
        <label className={styles.filterLabel} htmlFor="chron-family">
          Type
        </label>
        <select id="chron-family" className={styles.select} value={store.filters.families[0] ?? ''} onChange={(e) => store.setFilters({ families: e.target.value ? [e.target.value as EventFamily] : [] })}>
          <option value="">Any type</option>
          {EVENT_FAMILIES.map((f) => (
            <option key={f} value={f}>
              {EVENT_FAMILY_LABELS[f]}
            </option>
          ))}
        </select>
        <label className={styles.filterLabel} htmlFor="chron-process">
          Process
        </label>
        <select id="chron-process" className={styles.select} value={store.filters.processId ?? ''} onChange={(e) => store.setFilters({ processId: e.target.value || null })}>
          <option value="">Any process</option>
          {model.processes.map((p) => (
            <option key={p.id} value={p.id}>
              {PROCESS_SHORT[p.type]} {p.reference}
            </option>
          ))}
        </select>
        <label className={styles.filterLabel} htmlFor="chron-source">
          Source
        </label>
        <select id="chron-source" className={styles.select} value={store.filters.source} onChange={(e) => store.setFilters({ source: e.target.value as 'all' | 'manual' | 'connector' })}>
          <option value="all">Manual and connector</option>
          <option value="manual">Manual only</option>
          <option value="connector">Connector only</option>
        </select>
        <label className={styles.filterLabel} htmlFor="chron-vis">
          Visibility
        </label>
        <select id="chron-vis" className={styles.select} value={store.filters.visibility[0] ?? ''} onChange={(e) => store.setFilters({ visibility: e.target.value ? [e.target.value as 'agency-only' | 'integrated' | 'restricted'] : [] })}>
          <option value="">Any</option>
          <option value="agency-only">Agency only</option>
          <option value="integrated">Integrated</option>
          <option value="restricted">Restricted</option>
        </select>
      </div>

      <div className={styles.filters} role="group" aria-label="Pattern lenses">
        <span className={styles.filterLabel}>Lenses</span>
        {LENS_IDS.map((id: LensId) => (
          <button key={id} type="button" className={styles.chip} aria-pressed={store.lenses.includes(id)} onClick={() => store.toggleLens(id)}>
            {LENS_LABELS[id].label}
          </button>
        ))}
      </div>
      {model.lensResults.length > 0 ? (
        <div className={styles.lensPanel} role="status">
          {model.lensResults.map((r) => (
            <div key={r.id}>
              <div className={styles.lensTitle}>{r.label}</div>
              <div>
                {r.looksFor} {r.finding}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <ScreenState state={state} empty={{ title: 'No events to show', text: store.view === 'single' ? `No ${AGENCY_SHORT[user.agency]} events are recorded for ${name}. Add one, or review the connector inbox.` : `No integrated events are shared for ${name} yet. Promote events from a single-agency chronology with a lawful basis.` }}>
        <LanesChart
          events={model.events}
          analyses={model.analyses}
          agencies={model.agencies}
          domain={store.window ?? model.domain}
          lensResults={model.lensResults}
          highlighted={model.highlighted}
          selectedEventId={store.selectedEventId}
          selectedAnalysisId={store.selectedAnalysisId}
          onSelectEvent={store.select}
          onSelectAnalysis={store.selectAnalysis}
          onBrush={store.setWindow}
          settle
        />
        <div className={styles.section}>
          <EventList events={model.events} selectedEventId={store.selectedEventId} highlighted={model.highlighted} onSelect={store.select} height={440} />
        </div>
        <div className={styles.section}>
          <h2>Analysis notes</h2>
          <p className={styles.windowNote}>Professional judgement, kept apart from the facts above and linked to the events it rests on.</p>
          {model.analyses.length === 0 ? <p className={styles.windowNote}>No analysis notes yet.</p> : null}
          <div className={styles.analysisList}>
            {model.analyses.map((a) => (
              <div key={a.id} className={styles.analysisNote} data-selected={store.selectedAnalysisId === a.id ? 'true' : undefined} role="button" tabIndex={0} onClick={() => store.selectAnalysis(a.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && store.selectAnalysis(a.id)}>
                <strong>{a.title}</strong>
                <span>{a.text}</span>
                <span className={styles.analysisMeta}>
                  {a.kind}. {a.authorName} ({AGENCY_SHORT[a.agency]}), {formatDateTime(a.recordedAt)}. Rests on {a.eventIds.length} {a.eventIds.length === 1 ? 'event' : 'events'}.
                </span>
              </div>
            ))}
          </div>
        </div>
      </ScreenState>
      <AddEventDialog open={adding} onClose={() => setAdding(false)} personId={personId} processIds={model.processes.filter((p) => p.status === 'open').map((p) => p.id)} recentEvents={model.visible} />
    </div>
  );
}
