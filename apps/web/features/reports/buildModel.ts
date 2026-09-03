import type { Config, Dataset } from '@mas/domain';
import { aspModel } from './aspModel';
import { awiModel } from './awiModel';
import { cpModel } from './cpModel';
import { mappaModel } from './mappaModel';
import { maracModel } from './maracModel';
import type { ReportKind, ReportModel } from './model';
import type { Period } from './period';

export interface ModelOptions {
  /** Adult female population for the MARAC rate. Fictional. */
  population: number;
}

export const DEFAULT_POPULATION = 41000;

export function parsePopulation(query: URLSearchParams): number {
  const n = Number(query.get('pop'));
  return Number.isFinite(n) && n >= 100 ? Math.round(n) : DEFAULT_POPULATION;
}

/** One entry point for the screen and the print pack, so both show the same numbers. */
export function buildModel(kind: ReportKind, data: Dataset, config: Config, now: Date, period: Period, options: ModelOptions): ReportModel {
  switch (kind) {
    case 'asp':
      return aspModel(data, now, period);
    case 'cp':
      return cpModel(data, now, period);
    case 'marac':
      return maracModel(data, now, period, options.population);
    case 'mappa':
      return mappaModel(data, config, now, period);
    case 'awi':
      return awiModel(data, config, now, period);
  }
}
