import { DEMO_NOW_ISO, datasetSchema, type Dataset } from '@mas/domain';
import { seedMarionFraser } from '../scenarios/01-marion-fraser';
import { seedKayleighDocherty } from '../scenarios/02-kayleigh-docherty';
import { seedDerekMuir } from '../scenarios/03-derek-muir';
import { seedAidenBoyle } from '../scenarios/04-aiden-boyle';
import { seedTomaszNowak } from '../scenarios/05-tomasz-nowak';
import { seedIshbelGrant } from '../scenarios/06-ishbel-grant';
import { seedWhinbraeLsi } from '../scenarios/07-whinbrae-lsi';
import { seedChloeReid } from '../scenarios/08-chloe-reid';
import { seedBulkPopulation } from './bulk';
import { createContext, type BuildContext } from './context';
import { seedOrganisations } from './organisations';
import { seedAudit } from './audit';
import { seedNotifications } from './notifications';

export const DEFAULT_SEED = 'clydeshore-2026';

export interface BuildOptions {
  seed?: string;
  nowIso?: string;
  /** Number of background households on top of the scenarios. */
  households?: number;
  /** Validate the whole dataset against the Zod schema. Off by default (it is slow-ish); the test suite validates the built dataset explicitly. */
  validate?: boolean;
}

export type ScenarioSeeder = (ctx: BuildContext) => void;

export const SCENARIOS: Array<{ id: string; title: string; seed: ScenarioSeeder }> = [
  { id: '01-marion-fraser', title: 'Marion Fraser, 78, Kirkbrae: adult support and protection with capacity concern', seed: seedMarionFraser },
  { id: '02-kayleigh-docherty', title: 'Kayleigh Docherty, 29, Ardvale: MARAC with a linked child protection process', seed: seedKayleighDocherty },
  { id: '03-derek-muir', title: 'Derek Muir, 41, Abbey Wynd: MAPPA level 2 (restricted)', seed: seedDerekMuir },
  { id: '04-aiden-boyle', title: 'Aiden Boyle, 7, Craiglarrick: child protection', seed: seedAidenBoyle },
  { id: '05-tomasz-nowak', title: 'Tomasz Nowak, 34, Harbour Row: adult support and protection with interpreter', seed: seedTomaszNowak },
  { id: '06-ishbel-grant', title: 'Ishbel Grant, 84, ward 7: adults with incapacity, guardianship', seed: seedIshbelGrant },
  { id: '07-whinbrae-lsi', title: 'Whinbrae House care home: large scale investigation', seed: seedWhinbraeLsi },
  { id: '08-chloe-reid', title: 'Chloe Reid, 19, Kirkbrae: pre-birth child protection with a MARAC and a closed childhood record', seed: seedChloeReid },
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
  seedNotifications(ctx);
  if (options.validate) datasetSchema.parse(ctx.data);
  return ctx.data;
}
