'use client';

import { useT } from '@mas/messages';
import { TextField } from '@mas/ui';
import { useState } from 'react';
import { setQuery, useNavigate } from '@/lib/router';
import { useData } from '@/lib/store';
import { DEFAULT_CHILD_POPULATION, parseChildPopulation } from './buildModel';
import { cpModel } from './cpModel';
import { ReportFrame } from './ReportFrame';
import { useReportPeriod, withHint } from './useReport';

/**
 * Child Protection Register statistics for the chosen year to 31 July, with a fictional child
 * population for the rate per 1,000 the publication reports.
 */
export function ReportCp() {
  const t = useT();
  const data = useData();
  const navigate = useNavigate();
  const { now, route, periods, period, setPeriod } = useReportPeriod('cp');
  const population = parseChildPopulation(route.query);
  const [draft, setDraft] = useState(String(population));
  const model = withHint(cpModel(data, now, period, population), periods, (p) => cpModel(data, now, p, population), (n) => t('reports.cp.hint', { count: n }));

  function commit() {
    const n = Number(draft);
    const next = Number.isFinite(n) && n >= 100 ? Math.round(n) : DEFAULT_CHILD_POPULATION;
    setDraft(String(next));
    if (next === population) return;
    navigate(`/reports/cp${setQuery(route.query, { pop: next === DEFAULT_CHILD_POPULATION ? null : String(next) })}`, { replace: true });
  }

  return (
    <ReportFrame
      model={model}
      periods={periods}
      onPeriod={setPeriod}
      controls={
        <TextField
          label={t('reports.cp.populationLabel')}
          type="number"
          inputMode="numeric"
          min={100}
          step={100}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
          }}
          hint={t('reports.cp.populationHint')}
        />
      }
    />
  );
}
