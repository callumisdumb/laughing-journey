'use client';

import { useT } from '@mas/messages';
import { TextField } from '@mas/ui';
import { useState } from 'react';
import { setQuery, useNavigate } from '@/lib/router';
import { useData } from '@/lib/store';
import { DEFAULT_POPULATION, parsePopulation } from './buildModel';
import { maracModel } from './maracModel';
import { ReportFrame } from './ReportFrame';
import { useReportPeriod, withHint } from './useReport';

/** MARAC SafeLives return for the rolling four quarters, with a fictional population for the rate. */
export function ReportMarac() {
  const t = useT();
  const data = useData();
  const navigate = useNavigate();
  const { now, route, periods, period, setPeriod } = useReportPeriod('marac');
  const population = parsePopulation(route.query);
  const [draft, setDraft] = useState(String(population));
  const model = withHint(maracModel(data, now, period, population), periods, (p) => maracModel(data, now, p, population), (n) => t('reports.marac.hint', { count: n }));

  function commit() {
    const n = Number(draft);
    const next = Number.isFinite(n) && n >= 100 ? Math.round(n) : DEFAULT_POPULATION;
    setDraft(String(next));
    if (next === population) return;
    navigate(`/reports/marac${setQuery(route.query, { pop: next === DEFAULT_POPULATION ? null : String(next) })}`, { replace: true });
  }

  return (
    <ReportFrame
      model={model}
      periods={periods}
      onPeriod={setPeriod}
      controls={
        <TextField
          label={t('reports.marac.populationLabel')}
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
          hint={t('reports.marac.populationHint')}
        />
      }
    />
  );
}
