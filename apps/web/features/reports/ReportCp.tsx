'use client';

import { useData } from '@/lib/store';
import { cpModel } from './cpModel';
import { ReportFrame } from './ReportFrame';
import { useReportPeriod, withHint } from './useReport';

/** Child Protection Register statistics for the chosen year to 31 July. */
export function ReportCp() {
  const data = useData();
  const { now, periods, period, setPeriod } = useReportPeriod('cp');
  const model = withHint(cpModel(data, now, period), periods, (p) => cpModel(data, now, p), 'register movements');
  return <ReportFrame model={model} periods={periods} onPeriod={setPeriod} />;
}
