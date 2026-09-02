import type { Dataset, User } from '@mas/domain';
import { IdFactory } from './ids';
import { Prng } from './prng';

/** Mutable build context shared by the bulk generator and the hand-authored scenarios. */
export interface BuildContext {
  seed: string;
  rng: Prng;
  ids: IdFactory;
  /** The fixed demo instant. */
  now: Date;
  nowIso: string;
  data: Dataset;
  user(id: string): User;
}

export function createContext(seed: string, nowIso: string): BuildContext {
  const data: Dataset = {
    meta: { seed, generatedAt: nowIso, now: nowIso, synthetic: true },
    organisations: [],
    teams: [],
    users: [],
    addresses: [],
    people: [],
    households: [],
    relationships: [],
    processes: [],
    events: [],
    analyses: [],
    meetings: [],
    actions: [],
    plans: [],
    riskAssessments: [],
    viewsRecords: [],
    lawfulBases: [],
    sharingRecords: [],
    informationRequests: [],
    connectorEvents: [],
    audit: [],
  };
  return {
    seed,
    rng: new Prng(seed),
    ids: new IdFactory(),
    now: new Date(nowIso),
    nowIso,
    data,
    user(id: string): User {
      const u = data.users.find((x) => x.id === id);
      if (!u) throw new Error(`unknown user ${id}`);
      return u;
    },
  };
}
