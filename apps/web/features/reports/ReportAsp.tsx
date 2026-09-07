'use client';

import { useT } from '@mas/messages';
import { Button } from '@mas/ui';
import { FileSpreadsheet } from 'lucide-react';
import { useNavigate } from '@/lib/router';
import { useData } from '@/lib/store';
import { aspModel } from './aspModel';
import { ReportFrame } from './ReportFrame';
import { useReportPeriod, withHint } from './useReport';

/** ASP biennial report figures for the chosen biennium. */
export function ReportAsp() {
  const t = useT();
  const data = useData();
  const navigate = useNavigate();
  const { now, periods, period, setPeriod } = useReportPeriod('asp');
  const model = withHint(aspModel(data, now, period), periods, (p) => aspModel(data, now, p), (n) => t('reports.asp.hint', { count: n }));
  return (
    <ReportFrame
      model={model}
      periods={periods}
      onPeriod={setPeriod}
      controls={
        <Button variant="secondary" icon={<FileSpreadsheet size={16} aria-hidden="true" />} onClick={() => navigate('/reports/asp?nmds=1')}>
          {t('reports.asp.openReturn')}
        </Button>
      }
    />
  );
}
