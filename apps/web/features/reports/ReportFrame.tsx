'use client';

import { formatDate, submissionFor } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, SelectField, Sheet, SheetBody, SheetHead } from '@mas/ui';
import { Printer, Send } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { AppLink } from '@/components/AppLink';
import { ScreenState, useDevState } from '@/components/ScreenState';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { useData } from '@/lib/store';
import { Chart } from './Chart';
import { withDisclosureControl } from './disclosure';
import { FigureGrid } from './FigureGrid';
import { reportCatalogue, type ReportModel } from './model';
import { SubmitReturnDialog } from './SubmitReturnDialog';
import type { Period } from './period';
import { SectionTable } from './SectionTable';
import styles from './ReportFrame.module.css';

export interface ReportFrameProps {
  model: ReportModel;
  periods: Period[];
  onPeriod: (id: string) => void;
  /** Extra controls beside the period, e.g. the MARAC population. */
  controls?: ReactNode;
  /** Controls after those, e.g. the button that opens a return. */
  extraControls?: ReactNode;
}

/** The common frame for every report: title, period, meta line, headline figures, sections, sources, print pack. */
export function ReportFrame({ model: raw, periods, onPeriod, controls, extraControls }: ReportFrameProps) {
  const t = useT();
  // Every count a reader sees has been through the disclosure control (D-237); the raw model is never rendered.
  const model = useMemo(() => withDisclosureControl(raw), [raw]);
  const route = useRoute();
  const navigate = useNavigate();
  const dev = useDevState();
  const printHref = `/reports/${model.kind}${setQuery(route.query, { print: '1' })}`;
  const data = useData();
  const [submitting, setSubmitting] = useState(false);
  const submitted = submissionFor(data.submissions, model.kind, model.period.id);
  const catalogue = reportCatalogue().find((r) => r.kind === model.kind);

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-text">
          <h1>{model.title}</h1>
          <p className="page-lede">{model.lede}</p>
        </div>
        <div className={styles.actions}>
          {/* Recording that a return was sent (D-247): the product sends nothing, and the button says so in the dialog. */}
          {submitted ? (
            <span className={styles.hint} data-testid="submission-done">
              {t('reports.submission.done', { recipient: submitted.recipient, date: formatDate(submitted.submittedOn), by: submitted.submittedByName, hasReference: submitted.reference ? 'yes' : 'no', reference: submitted.reference ?? '' })}
            </span>
          ) : (
            <Button variant="secondary" size="lg" icon={<Send size={16} aria-hidden="true" />} onClick={() => setSubmitting(true)} data-testid="mark-submitted">
              {t('reports.submission.action')}
            </Button>
          )}
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
        {extraControls}
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
          {model.disclosure && model.disclosure.suppressed > 0 ? (
            <p className={styles.disclosure} data-testid="report-disclosure">
              {t('reports.disclosure.footnote', { count: model.disclosure.suppressed })}
            </p>
          ) : null}
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
      {submitting ? (
        <SubmitReturnDialog
          open
          onClose={() => setSubmitting(false)}
          kind={model.kind}
          title={model.title}
          periodId={model.period.id}
          periodLabel={model.period.label}
          defaultRecipient={catalogue?.recipient ?? ''}
        />
      ) : null}
    </div>
  );
}