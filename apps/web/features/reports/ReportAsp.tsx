'use client';

import { useData } from '@/lib/store';
import { aspModel } from './aspModel';
import { ReportFrame } from './ReportFrame';
import { useReportPeriod, withHint } from './useReport';

/** ASP biennial report figures for the chosen biennium. */
export function ReportAsp() {
  const data = useData();
  const { now, periods, period, setPeriod } = useReportPeriod('asp');
  const model = withHint(aspModel(data, now, period), periods, (p) => aspModel(data, now, p), 'referrals');
  return <ReportFrame model={model} periods={periods} onPeriod={setPeriod} />;
}
