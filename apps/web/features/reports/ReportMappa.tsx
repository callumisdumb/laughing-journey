'use client';

import { useT } from '@mas/messages';
import { useConfig, useData } from '@/lib/store';
import { mappaModel } from './mappaModel';
import { ReportFrame } from './ReportFrame';
import { useReportPeriod, withHint } from './useReport';

/** MAPPA annual report: Annex 3 Tables 1 to 9 for the chosen year to 31 March. Counts only, never names. */
export function ReportMappa() {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const { now, periods, period, setPeriod } = useReportPeriod('mappa');
  const model = withHint(mappaModel(data, config, now, period), periods, (p) => mappaModel(data, config, now, p), (n) => t('reports.mappa.hint', { count: n }));
  return <ReportFrame model={model} periods={periods} onPeriod={setPeriod} />;
}
