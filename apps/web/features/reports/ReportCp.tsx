'use client';

import { useT } from '@mas/messages';
import { useData } from '@/lib/store';
import { cpModel } from './cpModel';
import { ReportFrame } from './ReportFrame';
import { useReportPeriod, withHint } from './useReport';

/** Child Protection Register statistics for the chosen year to 31 July. */
export function ReportCp() {
  const t = useT();
  const data = useData();
  const { now, periods, period, setPeriod } = useReportPeriod('cp');
  const model = withHint(cpModel(data, now, period), periods, (p) => cpModel(data, now, p), (n) => t('reports.cp.hint', { count: n }));
  return <ReportFrame model={model} periods={periods} onPeriod={setPeriod} />;
}
