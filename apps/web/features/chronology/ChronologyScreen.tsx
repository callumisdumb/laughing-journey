'use client';

import { EVENT_FAMILIES, LENS_IDS, agencyShort, analysisKindLabel, eventFamilyLabel, formatDate, formatDateTime, lensLabel, processShort, significanceLabel, type Agency, type EventFamily, type LensId, type Significance } from '@mas/domain';
import { useT } from '@mas/messages';
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

type Zoom = 'all' | '3y' | '12m' | '90d' | '30d';

const ZOOMS: Zoom[] = ['all', '3y', '12m', '90d', '30d'];

const ZOOM_LABELS = {
  all: 'chronology.screen.zoom.all',
  '3y': 'chronology.screen.zoom.threeYears',
  '12m': 'chronology.screen.zoom.twelveMonths',
  '90d': 'chronology.screen.zoom.ninetyDays',
  '30d': 'chronology.screen.zoom.thirtyDays',
} as const;

export function ChronologyScreen({ personId }: { personId: string }) {
  const t = useT();
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
        <EmptyState title={t('person.notFound.title')} text={t('person.notFound.text')} actions={<AppLink href="/people">{t('person.notFound.back')}</AppLink>} />
      </div>
    );
  }
  const person = model.person;
  const name = fullName(person);

  if (route.query.get('view') === 'print') return <PrintPack personId={personId} />;

  if (!model.canSeeIntegrated && model.processes.some((p) => p.accessRestriction === 'restricted') && model.visible.length === 0) {
    return (
      <div className="page">
        <RestrictedState reason={t('chronology.screen.restricted')} breakGlass="unavailable" />
      </div>
    );
  }

  const inboxCount = inboxForUser(data, user).filter((c) => c.subjectId === personId).length;
  const windowLabel = store.window ? t('chronology.screen.window', { from: formatDate(store.window.from), to: formatDate(store.window.to) }) : t('chronology.screen.windowAll', { from: formatDate(model.domain.from), to: formatDate(model.domain.to) });

  function zoom(kind: Zoom) {
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
          <h1>{t('chronology.screen.heading', { name, view: store.view, agency: agencyShort(user.agency) })}</h1>
          <p className="page-lede">{t('chronology.screen.lede', { shown: model.events.length, total: model.visible.length, window: windowLabel })}</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.segmented} role="group" aria-label={t('chronology.screen.viewGroup')}>
          <button type="button" className={styles.segment} aria-pressed={store.view === 'single'} onClick={() => store.setView('single')}>
            {t('chronology.screen.view.single')}
          </button>
          <button type="button" className={styles.segment} aria-pressed={store.view === 'integrated'} onClick={() => store.setView('integrated')} disabled={!model.canSeeIntegrated}>
            {t('chronology.screen.view.integrated')}
          </button>
          <button type="button" className={styles.segment} aria-pressed={store.view === 'pack'} onClick={() => store.setView('pack')} disabled={!model.canSeeIntegrated}>
            {t('chronology.screen.view.pack')}
          </button>
        </div>
        <div className={styles.segmented} role="group" aria-label={t('chronology.screen.windowGroup')}>
          {ZOOMS.map((k) => (
            <button key={k} type="button" className={styles.segment} aria-pressed={k === 'all' ? store.window === null : false} onClick={() => zoom(k)}>
              {t(ZOOM_LABELS[k])}
            </button>
          ))}
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" icon={<Inbox size={16} aria-hidden="true" />} onClick={() => navigate('/inbox')} disabled={inboxCount === 0}>
            {t('chronology.screen.reviewInbox', { count: inboxCount })}
          </Button>
          <Button variant="secondary" icon={<Printer size={16} aria-hidden="true" />} onClick={() => navigate(`${route.path}?view=print`)}>
            {t('chronology.screen.exportPack')}
          </Button>
          <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setAdding(true)}>
            {t('chronology.screen.addEvent')}
          </Button>
        </div>
      </div>

      <div className={styles.filters} role="group" aria-label={t('chronology.filters.group')}>
        <span className={styles.filterLabel}>{t('chronology.filters.agency')}</span>
        {model.agencies.map((a) => (
          <button key={a} type="button" className={styles.chip} aria-pressed={store.filters.agencies.includes(a)} onClick={() => store.setFilters({ agencies: toggle<Agency>(store.filters.agencies, a) })}>
            {agencyShort(a)}
          </button>
        ))}
        <span className={styles.filterLabel}>{t('chronology.filters.significance')}</span>
        {(['high', 'moderate', 'low'] as Significance[]).map((s) => (
          <button key={s} type="button" className={styles.chip} aria-pressed={store.filters.significance.includes(s)} onClick={() => store.setFilters({ significance: toggle<Significance>(store.filters.significance, s) })}>
            {significanceLabel(s)}
          </button>
        ))}
        <label className={styles.filterLabel} htmlFor="chron-family">
          {t('chronology.filters.type.label')}
        </label>
        <select id="chron-family" className={styles.select} value={store.filters.families[0] ?? ''} onChange={(e) => store.setFilters({ families: e.target.value ? [e.target.value as EventFamily] : [] })}>
          <option value="">{t('chronology.filters.type.any')}</option>
          {EVENT_FAMILIES.map((f) => (
            <option key={f} value={f}>
              {eventFamilyLabel(f)}
            </option>
          ))}
        </select>
        <label className={styles.filterLabel} htmlFor="chron-process">
          {t('chronology.filters.process.label')}
        </label>
        <select id="chron-process" className={styles.select} value={store.filters.processId ?? ''} onChange={(e) => store.setFilters({ processId: e.target.value || null })}>
          <option value="">{t('chronology.filters.process.any')}</option>
          {model.processes.map((p) => (
            <option key={p.id} value={p.id}>
              {processShort(p.type)} {p.reference}
            </option>
          ))}
        </select>
        <label className={styles.filterLabel} htmlFor="chron-source">
          {t('chronology.filters.source.label')}
        </label>
        <select id="chron-source" className={styles.select} value={store.filters.source} onChange={(e) => store.setFilters({ source: e.target.value as 'all' | 'manual' | 'connector' })}>
          <option value="all">{t('chronology.filters.source.all')}</option>
          <option value="manual">{t('chronology.filters.source.manual')}</option>
          <option value="connector">{t('chronology.filters.source.connector')}</option>
        </select>
        <label className={styles.filterLabel} htmlFor="chron-vis">
          {t('chronology.filters.visibility.label')}
        </label>
        <select id="chron-vis" className={styles.select} value={store.filters.visibility[0] ?? ''} onChange={(e) => store.setFilters({ visibility: e.target.value ? [e.target.value as 'agency-only' | 'integrated' | 'restricted'] : [] })}>
          <option value="">{t('chronology.filters.visibility.any')}</option>
          <option value="agency-only">{t('chronology.filters.visibility.agencyOnly')}</option>
          <option value="integrated">{t('chronology.filters.visibility.integrated')}</option>
          <option value="restricted">{t('chronology.filters.visibility.restricted')}</option>
        </select>
      </div>

      <div className={styles.filters} role="group" aria-label={t('chronology.lenses.group')}>
        <span className={styles.filterLabel}>{t('chronology.lenses.label')}</span>
        {LENS_IDS.map((id: LensId) => (
          <button key={id} type="button" className={styles.chip} aria-pressed={store.lenses.includes(id)} onClick={() => store.toggleLens(id)}>
            {lensLabel(id)}
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

      <ScreenState state={state} empty={{ title: t('chronology.screen.empty.title'), text: store.view === 'single' ? t('chronology.screen.empty.single', { agency: agencyShort(user.agency), name }) : t('chronology.screen.empty.integrated', { name }) }}>
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
          <h2>{t('chronology.analysis.title')}</h2>
          <p className={styles.windowNote}>{t('chronology.analysis.lede')}</p>
          {model.analyses.length === 0 ? <p className={styles.windowNote}>{t('chronology.analysis.none')}</p> : null}
          <div className={styles.analysisList}>
            {model.analyses.map((a) => (
              <div key={a.id} className={styles.analysisNote} data-selected={store.selectedAnalysisId === a.id ? 'true' : undefined} role="button" tabIndex={0} onClick={() => store.selectAnalysis(a.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && store.selectAnalysis(a.id)}>
                <strong>{a.title}</strong>
                <span>{a.text}</span>
                <span className={styles.analysisMeta}>{t('chronology.analysis.meta', { kind: analysisKindLabel(a.kind), author: a.authorName, agency: agencyShort(a.agency), when: formatDateTime(a.recordedAt), count: a.eventIds.length })}</span>
              </div>
            ))}
          </div>
        </div>
      </ScreenState>
      <AddEventDialog open={adding} onClose={() => setAdding(false)} personId={personId} processIds={model.processes.filter((p) => p.status === 'open').map((p) => p.id)} recentEvents={model.visible} />
    </div>
  );
}
