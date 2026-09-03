'use client';

import { AGENCY_SHORT, formatDateTime, type ConnectorEvent, type ConnectorHealth } from '@mas/domain';
import { MOCK_ADAPTERS, setDegraded, setLatencyScale, setOutage, simulation, type ConnectorCapability, type ConnectorNarrative, type MockAdapter } from '@mas/connectors';
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

const STATUS_WORD: Record<Status, string> = { ok: 'Connected', degraded: 'Degraded', down: 'Down', checking: 'Checking' };

const STATUS_ICON: Record<Status, ReactNode> = {
  ok: <CheckCircle2 size={14} aria-hidden="true" />,
  degraded: <AlertTriangle size={14} aria-hidden="true" />,
  down: <CloudOff size={14} aria-hidden="true" />,
  checking: <Loader2 size={14} aria-hidden="true" />,
};

const CAPABILITY_LABELS: Record<ConnectorCapability, string> = {
  lookupPerson: 'Look up a person',
  pullEvents: 'Pull events',
  pushOutcome: 'Push outcomes',
  registerCheck: 'Register check',
  flagRecord: 'Place flags',
};

const DIRECTION_LABELS: Record<ConnectorNarrative['direction'], string> = {
  inbound: 'Into the platform only',
  outbound: 'Out of the platform only',
  both: 'Both ways',
};

const SIGNIFICANCE_TONE: Record<'low' | 'moderate' | 'high', PillTone> = { low: 'low', moderate: 'medium', high: 'high' };

type LatencyChoice = 'realistic' | 'fast' | 'instant';
const LATENCY_SCALES: Record<LatencyChoice, number> = { realistic: 1, fast: 0.25, instant: 0 };

const TABS = [
  { id: 'sync', label: 'Sync history' },
  { id: 'mapping', label: 'Mapping preview' },
  { id: 'real', label: 'How this would connect for real' },
];

interface SyncRow {
  id: string;
  at: string;
  durationMs: number;
  events: number;
  outcome: 'ok' | 'degraded' | 'failed';
  message: string;
}

const OUTCOME_WORD: Record<SyncRow['outcome'], string> = { ok: 'Completed', degraded: 'Slow', failed: 'Failed' };
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
function seededHistory(adapter: MockAdapter, now: Date): SyncRow[] {
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
      message: slow ? 'Source system slow to respond; the pull completed.' : 'Completed.',
    });
  }
  return rows;
}

function latencyLabel(health: ConnectorHealth | undefined): string {
  return health ? `${Math.round(health.latencyMs)} ms` : 'measuring';
}

function StatusWord({ status }: { status: Status }) {
  return (
    <span className={styles.status} data-status={status}>
      {STATUS_ICON[status]}
      {STATUS_WORD[status]}
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
            {CAPABILITY_LABELS[c]}
          </Pill>
        ))}
      </div>
      <dl className={styles.cardMeta}>
        <dt>Last sync</dt>
        <dd>{lastSync ? formatDateTime(lastSync) : canPull(adapter) ? 'Not yet' : 'No data connection'}</dd>
        <dt>Latency</dt>
        <dd>{latencyLabel(health.data)}</dd>
      </dl>
      <div className={styles.cardInbox}>
        {pending > 0 ? <AppLink href="/inbox">{pending === 1 ? '1 event waiting in the inbox' : `${pending} events waiting in the inbox`}</AppLink> : <span>Nothing waiting in the inbox</span>}
        {received > 0 ? <span className={styles.cardInboxTotal}>{received} received in total</span> : null}
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
      const message = events.length === 0 ? 'Nothing new for the sample subject.' : added === 0 ? `${events.length} ${events.length === 1 ? 'event' : 'events'} already in the inbox or a chronology.` : `${added} new ${added === 1 ? 'event' : 'events'} sent to the inbox for review.`;
      onRow({ id: newId('sync'), at: now.toISOString(), durationMs, events: events.length, outcome, message });
      audit({ act: 'read', targetType: 'inbox', targetId: adapter.id, targetLabel: `Sync now: ${adapter.displayName}`, reason: `${events.length} pulled, ${added} new in the inbox` });
      toast({ title: `${adapter.displayName}: sync complete`, text: added > 0 ? `${added} new ${added === 1 ? 'event is' : 'events are'} waiting in the inbox. Nothing reaches a chronology until a practitioner promotes it.` : message, tone: 'success' });
    },
    onError: (err: Error) => {
      onRow({ id: newId('sync'), at: now.toISOString(), durationMs: 0, events: 0, outcome: 'failed', message: err.message });
      audit({ act: 'read', targetType: 'inbox', targetId: adapter.id, targetLabel: `Sync now: ${adapter.displayName}`, reason: 'Failed: connector not responding' });
      toast({ title: `${adapter.displayName} did not respond`, text: err.message, tone: 'error' });
    },
  });

  const lastSync = health.data?.lastSyncAt ?? history.find((r) => r.outcome !== 'failed')?.at;

  return (
    <Sheet aria-labelledby="connector-detail-title">
      <SheetHead
        id="connector-detail-title"
        title={adapter.displayName}
        meta={`${adapter.systemName}. ${AGENCY_SHORT[adapter.agency]}. ${DIRECTION_LABELS[adapter.narrative.direction]}.`}
        actions={
          <Button variant="primary" icon={<RefreshCw size={16} aria-hidden="true" />} loading={sync.isPending} disabled={!pullable} title={pullable ? undefined : 'This connector has no pull capability'} onClick={() => sync.mutate()}>
            Sync now
          </Button>
        }
        divided
      />
      <SheetBody>
        <div className={styles.statusRow} aria-live="polite">
          <StatusWord status={status} />
          <span className={styles.statusMessage}>{health.data?.message ?? 'Checking the connection.'}</span>
          <span className={styles.statusMeta}>Last sync {lastSync ? formatDateTime(lastSync) : pullable ? 'not yet' : 'not applicable'}. Latency {latencyLabel(health.data)}.</span>
        </div>
        <p className={styles.inboxNote}>
          {pending > 0 ? (
            <>
              <AppLink href="/inbox">{pending === 1 ? '1 event from this connector is' : `${pending} events from this connector are`} waiting in the inbox</AppLink>. A practitioner rewrites the title, sets the significance and promotes each one. Nothing reaches a chronology on its own.
            </>
          ) : (
            <>Events pulled from this connector land in the <AppLink href="/inbox">connector inbox</AppLink> for a practitioner to review. Nothing reaches a chronology on its own.</>
          )}
        </p>
        <div className={styles.demo}>
          <Switch label="Simulate outage" checked={outage} onChange={(e) => onOutage(e.target.checked)} />
          <Switch label="Simulate slow responses" checked={degraded} onChange={(e) => onDegraded(e.target.checked)} />
          <span className={styles.demoNote}>Demo controls for this session. Each change is written to the audit log.</span>
        </div>
        <Tabs items={TABS} value={tab} onChange={onTab} label="Connector detail" idPrefix="connector" />
        <TabPanel id="sync" active={tab === 'sync'} idPrefix="connector">
          {history.length === 0 ? (
            <EmptyState title="No sync history" text={pullable ? 'Press Sync now to pull events for the sample subject.' : `${adapter.displayName} holds a reference only. The platform never pulls its content.`} />
          ) : (
            <TableWrap label="Sync history">
              <Table>
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Duration</th>
                    <th scope="col">Events pulled</th>
                    <th scope="col">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => (
                    <tr key={r.id} data-outcome={r.outcome}>
                      <td className={styles.nowrap}>{formatDateTime(r.at)}</td>
                      <td data-align="num">{r.outcome === 'failed' ? 'no response' : `${r.durationMs} ms`}</td>
                      <td data-align="num">{r.events}</td>
                      <td>
                        <Pill size="sm" tone={OUTCOME_TONE[r.outcome]}>
                          {OUTCOME_WORD[r.outcome]}
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
          <p className={styles.panelIntro}>How {adapter.systemName} vocabulary becomes platform events. The rule sets the event type and a starting significance; the practitioner can change the significance at review.</p>
          <TableWrap label="Mapping preview">
            <Table>
              <thead>
                <tr>
                  <th scope="col">Source field</th>
                  <th scope="col">Source value</th>
                  <th scope="col">Platform event type</th>
                  <th scope="col">Significance</th>
                  <th scope="col">Note</th>
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
                        {m.significance.charAt(0).toUpperCase() + m.significance.slice(1)}
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
          <p className={styles.panelIntro}>If {adapter.systemName} were live, this is how it would connect. Nothing here is built: the adapter behind this screen is a mock behind the same interface a real one would implement.</p>
          <KeyValue
            items={[
              { key: 'Authentication', value: adapter.narrative.authModel },
              { key: 'Direction', value: DIRECTION_LABELS[adapter.narrative.direction] },
              { key: 'Cadence', value: adapter.narrative.cadence },
              { key: 'What crosses the boundary', value: adapter.narrative.notes },
            ]}
          />
        </TabPanel>
      </SheetBody>
    </Sheet>
  );
}

export function Connectors() {
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
    return [...(history[a.id] ?? []), ...seededHistory(a, now)];
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
    audit({ act: 'edit', targetType: 'config', targetId: `connector:${a.id}`, targetLabel: `Connector demo controls: ${a.displayName}`, reason: `Simulated outage ${on ? 'on' : 'off'} for ${a.displayName}` });
    refetchHealth(a.id);
  }

  function toggleDegraded(a: MockAdapter, on: boolean) {
    setDegraded(a.id, on);
    setDegradeds((xs) => (on ? [...xs.filter((x) => x !== a.id), a.id] : xs.filter((x) => x !== a.id)));
    audit({ act: 'edit', targetType: 'config', targetId: `connector:${a.id}`, targetLabel: `Connector demo controls: ${a.displayName}`, reason: `Simulated slow responses ${on ? 'on' : 'off'} for ${a.displayName}` });
    refetchHealth(a.id);
  }

  function changeLatency(choice: LatencyChoice) {
    setLatencyScale(LATENCY_SCALES[choice]);
    setLatency(choice);
    audit({ act: 'edit', targetType: 'config', targetId: 'connector:latency', targetLabel: 'Connector demo controls: response speed', reason: `Response speed set to ${choice} for every connector` });
    void queryClient.invalidateQueries({ queryKey: ['health'] });
  }

  if (!adapter) return null;

  const sampleSubject = data.connectorEvents.find((c) => c.connectorId === adapter.id)?.subjectId ?? data.processes.find((p) => p.status === 'open')?.subjectIds[0];
  const pendingTotal = data.connectorEvents.filter((c) => c.status === 'pending').length;

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>Connectors</h1>
          <p className="page-lede">
            Ten mock adapters behind the real connector interface. Everything they pull lands in the <AppLink href="/inbox">connector inbox</AppLink> for a practitioner to read, retitle and promote. Nothing goes straight into a chronology.
          </p>
        </div>
        <div className={styles.headControls}>
          <SelectField
            label="Response speed (demo)"
            value={latency}
            onChange={(e) => changeLatency(e.target.value as LatencyChoice)}
            options={[
              { value: 'realistic', label: 'Realistic (200 to 1500 ms)' },
              { value: 'fast', label: 'Fast' },
              { value: 'instant', label: 'Instant' },
            ]}
          />
        </div>
      </div>
      <ScreenState state={dev ?? 'ready'} empty={{ title: 'No connectors configured', text: 'Add an adapter in Admin to see its health here.' }}>
        <div className={styles.summary}>
          <span>
            <strong>{MOCK_ADAPTERS.length}</strong> connectors
          </span>
          <span>
            <strong>{outages.length}</strong> simulated {outages.length === 1 ? 'outage' : 'outages'}
          </span>
          <span>
            <strong>{pendingTotal}</strong> {pendingTotal === 1 ? 'event' : 'events'} waiting in the inbox across every connector
          </span>
        </div>
        <ul className={styles.cards} aria-label="Connector health">
          {MOCK_ADAPTERS.map((a) => {
            const counts = countsFor(a.id);
            return <HealthCard key={a.id} adapter={a} selected={a.id === adapter.id} pending={counts.pending} received={counts.received} lastSeededSync={seededHistory(a, now)[0]?.at} onSelect={() => setParams({ adapter: a.id })} />;
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
