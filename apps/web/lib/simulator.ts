'use client';

import { MOCK_ADAPTERS } from '@mas/connectors';
import type { ConnectorId } from '@mas/domain';
import { create } from 'zustand';

/**
 * The source system simulator's own state: what the partner system holds.
 *
 * Deliberately not in the `Dataset`. This is not casework and it is not the product's record of
 * anything; it is a second system that happens to run in the same window, and putting its episodes
 * in the platform's own dataset would blur exactly the line the simulator exists to draw.
 *
 * The reconciliation screen reads from here rather than from the adapter fixture, which is what
 * makes editing an episode in the simulator mean something: change the allocated worker over there
 * and the divergence appears over here, computed by the same function that would compute it against
 * a real feed.
 */

export interface SimEpisode {
  id: string;
  connectorId: ConnectorId;
  /** The person in the platform this episode is about, where the simulator knows. */
  personId: string;
  /** How the simulator displays the person: surname first, as these systems do. */
  displayName: string;
  /** The source system's own reference for the episode. */
  reference: string;
  /** The episode in the source system's own field names. */
  fields: Record<string, string>;
  /** True where the episode arrived from the platform rather than being typed here. */
  fromPlatform: boolean;
  /** Set once the platform has been told: the simulator does not resend a change it has sent. */
  sentAt?: string;
}

interface SimulatorState {
  episodes: SimEpisode[];
  hydrate: () => void;
  save: (episode: SimEpisode) => void;
  add: (episode: SimEpisode) => void;
  /** What this connector holds for a person, for the reconciliation screen to compare against. */
  held: (connectorId: ConnectorId, personId: string) => Record<string, string>;
  reset: () => void;
}

const KEY = 'mas.simulator.v1';

/**
 * The seed: what the partner system already held before the platform existed.
 *
 * Taken from the adapter's own `held` fixture, so the two agree until somebody changes one of them,
 * which is the point. The fixture already disagrees with what the platform last wrote, in the three
 * ways that actually occur, so the reconciliation screen has something to show on a first run.
 */
function seeded(): SimEpisode[] {
  const out: SimEpisode[] = [];
  for (const adapter of MOCK_ADAPTERS) {
    for (const [personId, fields] of Object.entries(adapter.heldAll())) {
      out.push({
        id: `sim_${adapter.id}_${personId}`,
        connectorId: adapter.id,
        personId,
        displayName: fields['Client.Name'] ?? fields['Patient.Name'] ?? personId,
        reference: fields['Episode.CaseReference'] ?? adapter.id.toUpperCase(),
        fields,
        fromPlatform: true,
      });
    }
  }
  return out;
}

function read(): SimEpisode[] {
  if (typeof window === 'undefined') return seeded();
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SimEpisode[]) : seeded();
  } catch {
    // A simulator that cannot read its own storage falls back to the seed rather than to nothing.
    return seeded();
  }
}

function persist(episodes: SimEpisode[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(episodes));
  } catch {
    // Storage refused. The simulator is a demo affordance; losing its state on a reload is a worse
    // demo and not a data loss, so it fails quietly rather than interrupting a recording.
  }
}

export const useSimulator = create<SimulatorState>((set, get) => ({
  episodes: seeded(),
  hydrate: () => set({ episodes: read() }),
  save: (episode) => {
    const episodes = get().episodes.map((e) => (e.id === episode.id ? episode : e));
    set({ episodes });
    persist(episodes);
  },
  add: (episode) => {
    const episodes = [...get().episodes, episode];
    set({ episodes });
    persist(episodes);
  },
  held: (connectorId, personId) => get().episodes.find((e) => e.connectorId === connectorId && e.personId === personId)?.fields ?? {},
  reset: () => {
    const episodes = seeded();
    set({ episodes });
    persist(episodes);
  },
}));

/**
 * Whether the demo tools are in this build.
 *
 * The simulator is a demo affordance and does not belong in a production build. With a static export
 * every route is prerendered, so this is an honest gate rather than a claim about tree shaking: the
 * flag is read at build time, the route refuses when it is off, and a production build sets it off.
 * Recorded as such in `docs/DECISIONS.md` rather than implied.
 */
export const DEMO_TOOLS = process.env.NEXT_PUBLIC_DEMO_TOOLS !== '0';
