import type { ConnectorHealth } from '@mas/domain';

/**
 * Simulation controls shared by the mock adapters: latency, outages and degraded status.
 * The Connectors screen flips these for demos.
 */
export interface SimulationState {
  outage: Set<string>;
  degraded: Set<string>;
  /** Latency multiplier: 1 is realistic, 0 is instant (tests). */
  latencyScale: number;
  lastSync: Map<string, string>;
}

export const simulation: SimulationState = {
  outage: new Set(),
  degraded: new Set(),
  latencyScale: 1,
  lastSync: new Map(),
};

export function setOutage(id: string, on: boolean): void {
  if (on) simulation.outage.add(id);
  else simulation.outage.delete(id);
}

export function setDegraded(id: string, on: boolean): void {
  if (on) simulation.degraded.add(id);
  else simulation.degraded.delete(id);
}

export function setLatencyScale(scale: number): void {
  simulation.latencyScale = scale;
}

function seededJitter(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

/** 200 to 1500 ms, deterministic per call key, scaled by the simulation. */
export async function simulateLatency(key: string): Promise<number> {
  const ms = Math.round(200 + seededJitter(key) * 1300) * simulation.latencyScale;
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
  return ms;
}

export class ConnectorDownError extends Error {
  constructor(id: string) {
    super(`${id} is not responding. The last successful sync is still available; try again in a few minutes.`);
    this.name = 'ConnectorDownError';
  }
}

export async function healthFor(id: string, displayName: string, key: string): Promise<ConnectorHealth> {
  const latencyMs = await simulateLatency(key);
  const lastSyncAt = simulation.lastSync.get(id);
  if (simulation.outage.has(id)) return { status: 'down', lastSyncAt, latencyMs, message: `${displayName} is not responding (simulated outage).` };
  if (simulation.degraded.has(id)) return { status: 'degraded', lastSyncAt, latencyMs: latencyMs * 3, message: `${displayName} is slow to respond; some pulls may time out.` };
  return { status: 'ok', lastSyncAt, latencyMs, message: 'Connected.' };
}

export function guard(id: string): void {
  if (simulation.outage.has(id)) throw new ConnectorDownError(id);
}

export function markSynced(id: string, at: string): void {
  simulation.lastSync.set(id, at);
}
