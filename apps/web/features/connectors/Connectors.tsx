'use client';

import { AGENCY_SHORT, formatDateTime, type ConnectorEvent, type ConnectorHealth } from '@mas/domain';
import { MOCK_ADAPTERS, setDegraded, setLatencyScale, setOutage, simulation, type ConnectorCapability, type ConnectorNarrative, type MockAdapter } from '@mas/connectors';
import { tKey, useT, type Translator } from '@mas/messages';
import { AgencyMark, Button, EmptyState, KeyValue, Pill, SelectField, Sheet, SheetBody, SheetHead, Switch, TabPanel, Table, TableWrap, Tabs, useToast, type PillTone } from '@mas/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { useSelection } from '@/lib/selection';
import { useAppStore, useCurrentUser, useData, useNow } from '@/lib/store';
import styles from './Connectors.module.css';

type Status = ConnectorHealth['status'] | 'checking';

const STATUS_ICON: Record<Status, ReactNode> = {
  ok: <CheckCircle2 size={14} aria-hidden="true" />,
  degraded: <AlertTriangle size={14} aria-hidden="true" />,
  down: <CloudOff size={14} aria-hidden="true" />,
  checking: <Loader2 size={14} aria-hidden="true" />,
};

const statusWord = (status: Status) => tKey(`connectors.status.${status}`);
const capabilityLabel = (capability: ConnectorCapability) => tKey(`connectors.capabilities.${capability}`);
const directionLabel = (direction: ConnectorNarrative['direction']) => tKey(`connectors.direction.${direction}`);
const significanceLabel = (significance: 'low' | 'moderate' | 'high') => tKey(`connectors.significance.${significance}`);

const SIGNIFICANCE_TONE: Record<'low' | 'moderate' | 'high', PillTone> = { low: 'low', moderate: 'medium', high: 'high' };

type LatencyChoice = 'realistic' | 'fast' | 'instant';
const LATENCY_CHOICES: LatencyChoice[] = ['realistic', 'fast', 'instant'];
const LATENCY_SCALES: Record<LatencyChoice, number> = { realistic: 1, fast: 0.25, instant: 0 };
const latencyChoiceLabel = (choice: LatencyChoice) => tKey(`connectors.speed.${choice}`);

type TabId = 'sync' | 'mapping' | 'real';
const TAB_IDS: TabId[] = ['sync', 'mapping', 'real'];
const tabLabel = (id: TabId) => tKey(`connectors.tabs.${id}`);

interface SyncRow {
  id: string;
  at: string;
  durationMs: number;
  events: number;
  outcome: 'ok' | 'degraded' | 'failed';
  message: string;
}

const outcomeWord = (outcome: SyncRow['outcome']) => tKey(`connectors.syncOutcome.${outcome}`);
const OUTCOME_TONE: Record<SyncRow['outcome'], PillTone> = { ok: 'low', degraded: 'medium', failed: 'critical' };

/** Deterministic 0 to 1 from a string, so seeded history never changes between renders or runs. */
function jitter(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

function canPull(adapter: MockAdapter): boolean {
  return adapter.capabilities.includes('pullEvents');
}

/** Three or four believable past syncs, derived from the demo clock and the adapter's stated cadence. */
function seededHistory(t: Translator, adapter: MockAdapter, now: Date): SyncRow[] {
  if (!canPull(adapter)) return [];
  const nightly = /nightly|daily/i.test(adapter.narrative.cadence);
  const stepMinutes = nightly ? 24 * 60 : 15;
  const count = 3 + (jitter(`${adapter.id}:count`) > 0.5 ? 1 : 0);
  const rows: SyncRow[] = [];
  for (let k = 1; k <= count; k += 1) {
    const slow = jitter(`${adapter.id}:outcome:${k}`) > 0.88;
    const base = Math.round(200 + jitter(`${adapter.id}:latency:${k}`) * 1300);
    rows.push({
      id: `${adapter.id}-seed-${k}`,
      at: new Date(now.getTime() - k * stepMinutes * 60_000).toISOString(),
      durationMs: slow ? base * 3 : base,
      events: Math.floor(jitter(`${adapter.id}:events:${k}`) * 3),
      outcome: slow ? 'degraded' : 'ok',
      message: slow ? t('connectors.history.seededSlow') : t('connectors.history.seededCompleted'),
    });
  }
  return rows;
}

function latencyLabel(t: Translator, health: ConnectorHealth | undefined): string {
  return health ? t('connectors.latency.milliseconds', { ms: String(Math.round(health.latencyMs)) }) : t('connectors.latency.measuring');
}

function StatusWord({ status }: { status: Status }) {
  return (
    <span className={styles.status} data-status={status}>
      {STATUS_ICON[status]}
      {statusWord(status)}
    </span>
  );
}

interface CardProps {
  adapter: MockAdapter;
  selected: boolean;
  pending: number;
  received: number;
  lastSeededSync: string | undefined;
  onSelect: () => void;
}

function HealthCard({ adapter, selected, pending, received, lastSeededSync, onSelect }: CardProps) {
  const t = useT();
  const health = useQuery({ queryKey: ['health', adapter.id], queryFn: () => adapter.health(), refetchInterval: 30_000 });
  const status: Status = health.data?.status ?? 'checking';
  const lastSync = health.data?.lastSyncAt ?? lastSeededSync;
  return (
    <li className={styles.card} data-state={selected ? 'selected' : undefined} data-status={status}>
      <div className={styles.cardTop}>
        <StatusWord status={status} />
        <AgencyMark agency={adapter.agency} />
      </div>
      <button type="button" className={styles.cardName} aria-pressed={selected} onClick={onSelect}>
        {adapter.displayName}
      </button>
      <span className={styles.cardSystem}>{adapter.systemName}</span>
      <div className={styles.caps}>
        {adapter.capabilities.map((c) => (
          <Pill key={c} size="sm" tone="outline">
            {capabilityLabel(c)}
          </Pill>
        ))}
      </div>
      <dl className={styles.cardMeta}>
        <dt>{t('connectors.card.lastSync')}</dt>
        <dd>{lastSync ? formatDateTime(lastSync) : canPull(adapter) ? t('connectors.card.notYet') : t('connectors.card.noDataConnection')}</dd>
        <dt>{t('connectors.card.latency')}</dt>
        <dd>{latencyLabel(t, health.data)}</dd>
      </dl>
      <div className={styles.cardInbox}>
        {pending > 0 ? <AppLink href="/inbox">{t('connectors.card.pending', { count: pending })}</AppLink> : <span>{t('connectors.card.nothingPending')}</span>}
        {received > 0 ? <span className={styles.cardInboxTotal}>{t('connectors.card.receivedTotal', { count: received })}</span> : null}
      </div>
    </li>
  );
}

interface DetailProps {
  adapter: MockAdapter;
  subjectId: string | undefined;
  pending: number;
  history: SyncRow[];
  onRow: (row: SyncRow) => void;
  outage: boolean;
  degraded: boolean;
  onOutage: (on: boolean) => void;
  onDegraded: (on: boolean) => void;
  tab: string;
  onTab: (id: string) => void;
}

function Detail({ adapter, subjectId, pending, history, onRow, outage, degraded, onOutage, onDegraded, tab, onTab }: DetailProps) {
  const t = useT();
  const data = useData();
  const now = useNow();
  const upsert = useAppStore((s) => s.upsert);
  const audit = useAppStore((s) => s.audit);
  const newId = useAppStore((s) => s.newId);
  const { toast } = useToast();
  const health = useQuery({ queryKey: ['health', adapter.id], queryFn: () => adapter.health(), refetchInterval: 30_000 });
  const status: Status = health.data?.status ?? 'checking';
  const pullable = canPull(adapter);

  const sync = useMutation({
    mutationFn: async () => {
      const started = performance.now();
      const h = await adapter.health();
      const events = pullable && subjectId ? await adapter.pullEvents({ personId: subjectId }, { from: '2015-01-01', to: now.toISOString() }) : [];
      return { health: h, events, durationMs: Math.round(performance.now() - started) };
    },
    onSuccess: ({ health: h, events, durationMs }) => {
      let added = 0;
      for (const e of events) {
        if (data.connectorEvents.some((c) => c.externalRef === e.externalRef)) continue;
        const rec: ConnectorEvent = {
          id: newId('cev'),
          synthetic: true,
          connectorId: adapter.id,
          agency: adapter.agency,
          subjectId: subjectId ?? '',
          receivedAt: now.toISOString(),
          externalRef: e.externalRef,
          sourcePayload: e.source,
          mapped: { eventType: e.mapped.eventType, title: e.mapped.title, detail: e.mapped.detail, occurredAt: e.occurredAt, hasTime: e.hasTime, significance: e.mapped.significance, mappingRule: e.mapped.mappingRule },
          status: 'pending',
        };
        upsert('connectorEvents', rec);
        added += 1;
      }
      const outcome: SyncRow['outcome'] = h.status === 'degraded' ? 'degraded' : 'ok';
      const message = events.length === 0 ? t('connectors.sync.nothingNew') : added === 0 ? t('connectors.sync.alreadyKnown', { count: events.length }) : t('connectors.sync.newEvents', { count: added });
      onRow({ id: newId('sync'), at: now.toISOString(), durationMs, events: events.length, outcome, message });
      audit({ act: 'read', targetType: 'inbox', targetId: adapter.id, targetLabel: t('connectors.sync.auditLabel', { name: adapter.displayName }), reason: t('connectors.sync.auditReason', { pulled: events.length, added }) });
      toast({ title: t('connectors.sync.toastTitle', { name: adapter.displayName }), text: added > 0 ? t('connectors.sync.toastText', { count: added }) : message, tone: 'success' });
    },
    onError: (err: Error) => {
      onRow({ id: newId('sync'), at: now.toISOString(), durationMs: 0, events: 0, outcome: 'failed', message: err.message });
      audit({ act: 'read', targetType: 'inbox', targetId: adapter.id, targetLabel: t('connectors.sync.auditLabel', { name: adapter.displayName }), reason: t('connectors.sync.failedReason') });
      toast({ title: t('connectors.sync.failedTitle', { name: adapter.displayName }), text: err.message, tone: 'error' });
    },
  });

  const lastSync = health.data?.lastSyncAt ?? history.find((r) => r.outcome !== 'failed')?.at;
  const inboxLink = (chunks: ReactNode) => <AppLink href="/inbox">{chunks}</AppLink>;

  return (
    <Sheet aria-labelledby="connector-detail-title">
      <SheetHead
        id="connector-detail-title"
        title={adapter.displayName}
        meta={t('connectors.detail.meta', { system: adapter.systemName, agency: AGENCY_SHORT[adapter.agency], direction: directionLabel(adapter.narrative.direction) })}
        actions={
          <Button variant="primary" icon={<RefreshCw size={16} aria-hidden="true" />} loading={sync.isPending} disabled={!pullable} title={pullable ? undefined : t('connectors.detail.noPull')} onClick={() => sync.mutate()}>
            {t('connectors.detail.sync')}
          </Button>
        }
        divided
      />
      <SheetBody>
        <div className={styles.statusRow} aria-live="polite">
          <StatusWord status={status} />
          <span className={styles.statusMessage}>{health.data?.message ?? t('connectors.detail.checking')}</span>
          <span className={styles.statusMeta}>{t('connectors.detail.statusMeta', { lastSync: lastSync ? formatDateTime(lastSync) : pullable ? t('connectors.detail.lastSyncNotYet') : t('connectors.detail.lastSyncNotApplicable'), latency: latencyLabel(t, health.data) })}</span>
        </div>
        <p className={styles.inboxNote}>{pending > 0 ? t.rich('connectors.detail.pendingNote', { count: pending, link: inboxLink }) : t.rich('connectors.detail.emptyNote', { link: inboxLink })}</p>
        <div className={styles.demo}>
          <Switch label={t('connectors.demo.outage')} checked={outage} onChange={(e) => onOutage(e.target.checked)} />
          <Switch label={t('connectors.demo.slow')} checked={degraded} onChange={(e) => onDegraded(e.target.checked)} />
          <span className={styles.demoNote}>{t('connectors.demo.note')}</span>
        </div>
        <Tabs items={TAB_IDS.map((id) => ({ id, label: tabLabel(id) }))} value={tab} onChange={onTab} label={t('connectors.detail.tabsLabel')} idPrefix="connector" />
        <TabPanel id="sync" active={tab === 'sync'} idPrefix="connector">
          {history.length === 0 ? (
            <EmptyState title={t('connectors.history.empty.title')} text={pullable ? t('connectors.history.empty.pullable') : t('connectors.history.empty.reference', { name: adapter.displayName })} />
          ) : (
            <TableWrap label={tabLabel('sync')}>
              <Table>
                <thead>
                  <tr>
                    <th scope="col">{t('connectors.history.columns.when')}</th>
                    <th scope="col">{t('connectors.history.columns.duration')}</th>
                    <th scope="col">{t('connectors.history.columns.events')}</th>
                    <th scope="col">{t('connectors.history.columns.outcome')}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => (
                    <tr key={r.id} data-outcome={r.outcome}>
                      <td className={styles.nowrap}>{formatDateTime(r.at)}</td>
                      <td data-align="num">{r.outcome === 'failed' ? t('connectors.history.noResponse') : t('connectors.latency.milliseconds', { ms: String(r.durationMs) })}</td>
                      <td data-align="num">{r.events}</td>
                      <td>
                        <Pill size="sm" tone={OUTCOME_TONE[r.outcome]}>
                          {outcomeWord(r.outcome)}
                        </Pill>
                        <span className={styles.rowNote}>{r.message}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </TabPanel>
        <TabPanel id="mapping" active={tab === 'mapping'} idPrefix="connector">
          <p className={styles.panelIntro}>{t('connectors.mapping.intro', { system: adapter.systemName })}</p>
          <TableWrap label={tabLabel('mapping')}>
            <Table>
              <thead>
                <tr>
                  <th scope="col">{t('connectors.mapping.columns.sourceField')}</th>
                  <th scope="col">{t('connectors.mapping.columns.sourceValue')}</th>
                  <th scope="col">{t('connectors.mapping.columns.eventType')}</th>
                  <th scope="col">{t('connectors.mapping.columns.significance')}</th>
                  <th scope="col">{t('connectors.mapping.columns.note')}</th>
                </tr>
              </thead>
              <tbody>
                {adapter.mapping.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <code className={styles.code}>{m.sourceField}</code>
                    </td>
                    <td>{m.sourceValue}</td>
                    <td>
                      <code className={styles.code}>{m.eventType}</code>
                    </td>
                    <td>
                      <Pill size="sm" tone={SIGNIFICANCE_TONE[m.significance]}>
                        {significanceLabel(m.significance)}
                      </Pill>
                    </td>
                    <td className={styles.note}>{m.note}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </TabPanel>
        <TabPanel id="real" active={tab === 'real'} idPrefix="connector">
          <p className={styles.panelIntro}>{t('connectors.real.intro', { system: adapter.systemName })}</p>
          <KeyValue
            items={[
              { key: t('connectors.real.authentication'), value: adapter.narrative.authModel },
              { key: t('connectors.real.direction'), value: directionLabel(adapter.narrative.direction) },
              { key: t('connectors.real.cadence'), value: adapter.narrative.cadence },
              { key: t('connectors.real.boundary'), value: adapter.narrative.notes },
            ]}
          />
        </TabPanel>
      </SheetBody>
    </Sheet>
  );
}

export function Connectors() {
  const t = useT();
  const data = useData();
  const user = useCurrentUser();
  const now = useNow();
  const route = useRoute();
  const navigate = useNavigate();
  const audit = useAppStore((s) => s.audit);
  const select = useSelection((s) => s.select);
  const queryClient = useQueryClient();
  const dev = useDevState();
  const [history, setHistory] = useState<Record<string, SyncRow[]>>({});
  const [outages, setOutages] = useState<string[]>(() => [...simulation.outage]);
  const [degradeds, setDegradeds] = useState<string[]>(() => [...simulation.degraded]);
  const [latency, setLatency] = useState<LatencyChoice>(() => (simulation.latencyScale === 0 ? 'instant' : simulation.latencyScale < 1 ? 'fast' : 'realistic'));

  useEffect(() => {
    select(null);
  }, [select]);

  if (!user) return null;

  const requested = route.query.get('adapter');
  const adapter = MOCK_ADAPTERS.find((a) => a.id === requested) ?? MOCK_ADAPTERS[0];
  const tab = route.query.get('tab') ?? 'sync';

  function setParams(updates: Record<string, string | null>) {
    navigate(`/connectors${setQuery(route.query, updates)}`, { replace: true });
  }

  function countsFor(id: string) {
    const all = data.connectorEvents.filter((c) => c.connectorId === id);
    return { pending: all.filter((c) => c.status === 'pending').length, received: all.length };
  }

  function historyFor(a: MockAdapter): SyncRow[] {
    return [...(history[a.id] ?? []), ...seededHistory(t, a, now)];
  }

  function recordRow(id: string, row: SyncRow) {
    setHistory((h) => ({ ...h, [id]: [row, ...(h[id] ?? [])] }));
  }

  function refetchHealth(id: string) {
    void queryClient.invalidateQueries({ queryKey: ['health', id] });
  }

  function toggleOutage(a: MockAdapter, on: boolean) {
    setOutage(a.id, on);
    setOutages((xs) => (on ? [...xs.filter((x) => x !== a.id), a.id] : xs.filter((x) => x !== a.id)));
    audit({ act: 'edit', targetType: 'config', targetId: `connector:${a.id}`, targetLabel: t('connectors.demo.auditLabel', { name: a.displayName }), reason: t('connectors.demo.outageReason', { state: on ? 'on' : 'off', name: a.displayName }) });
    refetchHealth(a.id);
  }

  function toggleDegraded(a: MockAdapter, on: boolean) {
    setDegraded(a.id, on);
    setDegradeds((xs) => (on ? [...xs.filter((x) => x !== a.id), a.id] : xs.filter((x) => x !== a.id)));
    audit({ act: 'edit', targetType: 'config', targetId: `connector:${a.id}`, targetLabel: t('connectors.demo.auditLabel', { name: a.displayName }), reason: t('connectors.demo.slowReason', { state: on ? 'on' : 'off', name: a.displayName }) });
    refetchHealth(a.id);
  }

  function changeLatency(choice: LatencyChoice) {
    setLatencyScale(LATENCY_SCALES[choice]);
    setLatency(choice);
    audit({ act: 'edit', targetType: 'config', targetId: 'connector:latency', targetLabel: t('connectors.speed.auditLabel'), reason: t('connectors.speed.auditReason', { choice }) });
    void queryClient.invalidateQueries({ queryKey: ['health'] });
  }

  if (!adapter) return null;

  const sampleSubject = data.connectorEvents.find((c) => c.connectorId === adapter.id)?.subjectId ?? data.processes.find((p) => p.status === 'open')?.subjectIds[0];
  const pendingTotal = data.connectorEvents.filter((c) => c.status === 'pending').length;
  const bold = (chunks: ReactNode) => <strong>{chunks}</strong>;

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>{t('connectors.page.title')}</h1>
          <p className="page-lede">{t.rich('connectors.page.lede', { link: (chunks) => <AppLink href="/inbox">{chunks}</AppLink> })}</p>
        </div>
        <div className={styles.headControls}>
          <SelectField label={t('connectors.speed.label')} value={latency} onChange={(e) => changeLatency(e.target.value as LatencyChoice)} options={LATENCY_CHOICES.map((choice) => ({ value: choice, label: latencyChoiceLabel(choice) }))} />
        </div>
      </div>
      <ScreenState state={dev ?? 'ready'} empty={{ title: t('connectors.page.emptyTitle'), text: t('connectors.page.emptyText') }}>
        <div className={styles.summary}>
          <span>{t.rich('connectors.summary.connectors', { count: MOCK_ADAPTERS.length, b: bold })}</span>
          <span>{t.rich('connectors.summary.outages', { count: outages.length, b: bold })}</span>
          <span>{t.rich('connectors.summary.pending', { count: pendingTotal, b: bold })}</span>
        </div>
        <ul className={styles.cards} aria-label={t('connectors.page.cardsLabel')}>
          {MOCK_ADAPTERS.map((a) => {
            const counts = countsFor(a.id);
            return <HealthCard key={a.id} adapter={a} selected={a.id === adapter.id} pending={counts.pending} received={counts.received} lastSeededSync={seededHistory(t, a, now)[0]?.at} onSelect={() => setParams({ adapter: a.id })} />;
          })}
        </ul>
        <Detail
          key={adapter.id}
          adapter={adapter}
          subjectId={sampleSubject}
          pending={countsFor(adapter.id).pending}
          history={historyFor(adapter)}
          onRow={(row) => recordRow(adapter.id, row)}
          outage={outages.includes(adapter.id)}
          degraded={degradeds.includes(adapter.id)}
          onOutage={(on) => toggleOutage(adapter, on)}
          onDegraded={(on) => toggleDegraded(adapter, on)}
          tab={tab}
          onTab={(id) => setParams({ tab: id === 'sync' ? null : id })}
        />
      </ScreenState>
    </div>
  );
}
