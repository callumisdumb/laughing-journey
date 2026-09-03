'use client';

import { useT } from '@mas/messages';
import { Button, SelectField, Sheet, SheetBody, SheetHead } from '@mas/ui';
import { Printer } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { Chart } from './Chart';
import { FigureGrid } from './FigureGrid';
import type { ReportModel } from './model';
import type { Period } from './period';
import { SectionTable } from './SectionTable';
import styles from './ReportFrame.module.css';

export interface ReportFrameProps {
  model: ReportModel;
  periods: Period[];
  onPeriod: (id: string) => void;
  /** Extra controls beside the period, e.g. the MARAC population. */
  controls?: ReactNode;
}

/** The common frame for every report: title, period, meta line, headline figures, sections, sources, print pack. */
export function ReportFrame({ model, periods, onPeriod, controls }: ReportFrameProps) {
  const t = useT();
  const route = useRoute();
  const navigate = useNavigate();
  const dev = useDevState();
  const printHref = `/reports/${model.kind}${setQuery(route.query, { print: '1' })}`;

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>{model.title}</h1>
          <p className="page-lede">{model.lede}</p>
        </div>
        <div className={styles.actions}>
          <Button variant="primary" size="lg" icon={<Printer size={16} aria-hidden="true" />} onClick={() => navigate(printHref)}>
            {t('reports.frame.print')}
          </Button>
        </div>
      </div>
      <div className={styles.controls}>
        <div className={styles.period}>
          <SelectField label={t('reports.frame.periodLabel')} value={model.period.id} onChange={(e) => onPeriod(e.target.value)} options={periods.map((p) => ({ value: p.id, label: p.label }))} />
        </div>
        {controls}
        <AppLink href="/reports" className={styles.back}>
          {t('reports.frame.allReports')}
        </AppLink>
      </div>
      <p className={styles.meta}>{model.meta.join(' ')}</p>
      {model.hint ? (
        <div className={styles.hint} role="status">
          <span>{model.hint.text}</span>
          <AppLink href={`/reports/${model.kind}${setQuery(route.query, { period: model.hint.periodId })}`}>{t('reports.frame.switchPeriod')}</AppLink>
        </div>
      ) : null}
      <ScreenState state={dev ?? 'ready'} empty={{ title: t('reports.frame.emptyTitle'), text: t('reports.frame.emptyText') }}>
        <div className="stack">
          <FigureGrid figures={model.figures} />
          {model.sections.map((s) => (
            <Sheet key={s.id}>
              <SheetHead title={s.title} meta={s.note} />
              <SheetBody>
                <div className={styles.sectionBody}>
                  {s.chart ? <Chart spec={s.chart} /> : null}
                  {s.tables.map((table) => (
                    <SectionTable key={table.id} table={table} fallbackLabel={s.title} />
                  ))}
                </div>
              </SheetBody>
            </Sheet>
          ))}
          <Sheet tone="well">
            <SheetHead title={t('reports.frame.sourcesTitle')} meta={t('reports.frame.sourcesMeta')} />
            <SheetBody>
              <ul className={styles.sources}>
                {model.verify.map((v) => (
                  <li key={v}>{v}</li>
                ))}
                {model.sources.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </SheetBody>
          </Sheet>
        </div>
      </ScreenState>
    </div>
  );
}
