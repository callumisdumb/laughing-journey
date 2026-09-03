'use client';

import { classificationFor, formatDateTime, marking as markingFor } from '@mas/domain';
import { useT } from '@mas/messages';
import { Button, ClassificationMarking } from '@mas/ui';
import { ArrowLeft, Printer } from 'lucide-react';
import { useEffect } from 'react';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { useAppStore, useConfig, useData, useNow } from '@/lib/store';
import { buildModel, parseChildPopulation, parsePopulation } from './buildModel';
import { Chart } from './Chart';
import type { ReportKind, ReportSection, TableSpec } from './model';
import { resolvePeriod } from './period';
import styles from './ReportPrintPack.module.css';

function PackTable({ table }: { table: TableSpec }) {
  const t = useT();
  const numeric = new Set(table.numeric ?? []);
  return (
    <>
      {table.title ? <h3>{table.title}</h3> : null}
      {table.note ? <p className={styles.note}>{table.note}</p> : null}
      <table className={styles.table}>
        <thead>
          <tr>
            {table.columns.map((c, i) => (
              <th key={c} scope="col" data-align={numeric.has(i) ? 'num' : undefined}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.length === 0 ? (
            <tr>
              <td colSpan={table.columns.length}>{table.empty ?? t('reports.table.empty')}</td>
            </tr>
          ) : (
            table.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} data-align={numeric.has(ci) ? 'num' : undefined}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  );
}

/** A report as numbered pages with the classification marking, a running head and foot, and every chart's data table. */
export function ReportPrintPack({ kind }: { kind: ReportKind }) {
  const t = useT();
  const data = useData();
  const config = useConfig();
  const now = useNow();
  const route = useRoute();
  const navigate = useNavigate();
  const audit = useAppStore((s) => s.audit);
  const period = resolvePeriod(kind, now, route.query.get('period'));
  const model = buildModel(kind, data, config, now, period, { population: parsePopulation(route.query), childPopulation: parseChildPopulation(route.query) });

  useEffect(() => {
    audit({ act: 'export', targetType: 'report', targetId: `${kind}:${period.id}`, targetLabel: t('print.reports.auditLabel', { title: model.title, period: period.label }) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, period.id]);

  const pages: ReportSection[][] = [];
  let current: ReportSection[] = [];
  for (const s of model.sections) {
    if (s.chart) {
      if (current.length > 0) {
        pages.push(current);
        current = [];
      }
      pages.push([s]);
    } else {
      current.push(s);
      if (current.length === 2) {
        pages.push(current);
        current = [];
      }
    }
  }
  if (current.length > 0) pages.push(current);
  const totalPages = pages.length + 1;
  // Aggregate counts are Official and take no marking; a report that names no one needs none.
  const classification = classificationFor(config, model);
  const marking = markingFor(classification) ?? '';
  const back = `/reports/${kind}${setQuery(route.query, { print: null })}`;

  const head = (page: number) => (
    <div className={styles.head}>
      <span>{marking}</span>
      <span>{model.title}</span>
      <span>{t('print.common.page', { page, total: totalPages })}</span>
    </div>
  );
  const foot = (
    <div className={styles.foot}>
      <span>{t('print.common.printedFooter', { when: formatDateTime(now) })}</span>
      <span>{marking}</span>
    </div>
  );

  return (
    <div className={`${styles.pack} print-pack`}>
      <div className={`${styles.controls} no-print`}>
        <Button variant="secondary" icon={<ArrowLeft size={16} aria-hidden="true" />} onClick={() => navigate(back)}>
          {t('print.reports.back')}
        </Button>
        <Button variant="primary" size="lg" icon={<Printer size={16} aria-hidden="true" />} onClick={() => window.print()}>
          {t('print.common.print')}
        </Button>
      </div>
      <ClassificationMarking classification={classification} />
      <section className={`${styles.page} print-page`}>
        {head(1)}
        <h1 className={styles.title}>{model.title}</h1>
        <p className={styles.meta}>{t('print.reports.periodLine', { period: model.period.label })}</p>
        <p className={styles.meta}>{model.lede}</p>
        <p className={styles.meta}>{model.meta.join(' ')}</p>
        <h2>{t('print.reports.headline')}</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('print.reports.columns.measure')}</th>
              <th scope="col" data-align="num">
                {t('print.reports.columns.value')}
              </th>
              <th scope="col">{t('print.reports.columns.note')}</th>
            </tr>
          </thead>
          <tbody>
            {model.figures.map((f) => (
              <tr key={f.id}>
                <td>{f.label}</td>
                <td data-align="num">{f.value}</td>
                <td>{f.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2>{t('reports.frame.sourcesTitle')}</h2>
        <ul className={styles.list}>
          {model.verify.map((v) => (
            <li key={v}>{v}</li>
          ))}
          {model.sources.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        {foot}
      </section>
      {pages.map((sections, i) => (
        <section key={i} className={`${styles.page} print-page`}>
          {head(i + 2)}
          {sections.map((s) => (
            <div key={s.id} className={styles.section}>
              <h2>{s.title}</h2>
              {s.note ? <p className={styles.note}>{s.note}</p> : null}
              {s.chart ? <Chart spec={s.chart} /> : null}
              {s.tables.map((table) => (
                <PackTable key={table.id} table={table} />
              ))}
            </div>
          ))}
          {foot}
        </section>
      ))}
    </div>
  );
}
