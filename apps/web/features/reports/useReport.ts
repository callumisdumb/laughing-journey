'use client';

import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { useNow } from '@/lib/store';
import type { ReportKind, ReportModel } from './model';
import { periodsFor, resolvePeriod, type Period } from './period';

/** The reporting period from ?period=, with the options list and a setter that keeps the rest of the query. */
export function useReportPeriod(kind: ReportKind) {
  const now = useNow();
  const route = useRoute();
  const navigate = useNavigate();
  const periods = periodsFor(kind, now);
  const period = resolvePeriod(kind, now, route.query.get('period'));
  function setPeriod(id: string) {
    navigate(`/reports/${kind}${setQuery(route.query, { period: id })}`, { replace: true });
  }
  return { now, route, periods, period, setPeriod };
}

/** When the chosen period holds nothing but the period in progress does, say so and point at it. */
export function withHint(model: ReportModel, periods: Period[], build: (p: Period) => ReportModel, noun: string): ReportModel {
  const current = periods[0];
  if (model.activity > 0 || !current || current.id === model.period.id) return model;
  const alt = build(current);
  if (alt.activity === 0) return model;
  return { ...model, hint: { text: `Nothing in the record store falls in this period (${model.period.label}). The period in progress holds ${alt.activity} ${noun}.`, periodId: current.id } };
}
