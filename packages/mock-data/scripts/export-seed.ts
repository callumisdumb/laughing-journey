import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDataset } from '../src/generator/build';

const data = buildDataset({ seed: process.env.MAS_SEED, validate: true });
const dir = resolve(import.meta.dirname, '../dist');
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'seed.json'), JSON.stringify(data, null, 2));
const counts = Object.fromEntries(Object.entries(data).filter(([k]) => k !== 'meta').map(([k, v]) => [k, (v as unknown[]).length]));
console.log(`wrote dist/seed.json for seed "${data.meta.seed}"`);
console.table(counts);
