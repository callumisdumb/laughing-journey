import { DEMO_NOW_ISO, datasetSchema, type Dataset } from '@mas/domain';
import { seedAidenBoyle } from '../scenarios/04-aiden-boyle';
import { seedBulkPopulation } from './bulk';
import { createContext, type BuildContext } from './context';
import { seedOrganisations } from './organisations';
import { seedAudit } from './audit';

export const DEFAULT_SEED = 'clydeshore-2026';

export interface BuildOptions {
  seed?: string;
  nowIso?: string;
  /** Number of background households on top of the scenarios. */
  households?: number;
  /** Validate the whole dataset against the Zod schema (slow-ish; on by default in tests). */
  validate?: boolean;
}

export type ScenarioSeeder = (ctx: BuildContext) => void;

export const SCENARIOS: Array<{ id: string; title: string; seed: ScenarioSeeder }> = [
  { id: '04-aiden-boyle', title: 'Aiden Boyle, 7, Braeside: child protection', seed: seedAidenBoyle },
];

function linkMemberships(ctx: BuildContext): void {
  for (const p of ctx.data.processes) {
    for (const m of p.members) {
      const u = ctx.data.users.find((x) => x.id === m.userId);
      if (u && !u.caseMemberships.includes(p.id)) u.caseMemberships.push(p.id);
    }
  }
}

export function buildDataset(options: BuildOptions = {}): Dataset {
  const seed = options.seed ?? DEFAULT_SEED;
  const ctx = createContext(seed, options.nowIso ?? DEMO_NOW_ISO);
  seedOrganisations(ctx);
  for (const s of SCENARIOS) s.seed(ctx);
  seedBulkPopulation(ctx, options.households ?? 58);
  linkMemberships(ctx);
  seedAudit(ctx);
  if (options.validate) datasetSchema.parse(ctx.data);
  return ctx.data;
}
