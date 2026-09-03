'use client';

import { useConfig, useData } from '@/lib/store';
import { mappaModel } from './mappaModel';
import { ReportFrame } from './ReportFrame';
import { useReportPeriod, withHint } from './useReport';

/** MAPPA annual report counts for the chosen year to 31 March. Counts only, never names. */
export function ReportMappa() {
  const data = useData();
  const config = useConfig();
  const { now, periods, period, setPeriod } = useReportPeriod('mappa');
  const model = withHint(mappaModel(data, config, now, period), periods, (p) => mappaModel(data, config, now, p), (n) => `${n} ${n === 1 ? 'offender' : 'offenders'} managed under MAPPA`);
  return <ReportFrame model={model} periods={periods} onPeriod={setPeriod} />;
}
