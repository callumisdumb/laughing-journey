'use client';

import { useConfig, useData } from '@/lib/store';
import { awiModel } from './awiModel';
import { ReportFrame } from './ReportFrame';
import { useReportPeriod, withHint } from './useReport';

/** AWI application timeliness for the reporting year to date. */
export function ReportAwi() {
  const data = useData();
  const config = useConfig();
  const { now, periods, period, setPeriod } = useReportPeriod('awi');
  const model = withHint(awiModel(data, config, now, period), periods, (p) => awiModel(data, config, now, p), (n) => `${n} ${n === 1 ? 'concern or application' : 'concerns and applications'}`);
  return <ReportFrame model={model} periods={periods} onPeriod={setPeriod} />;
}
