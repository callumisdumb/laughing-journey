'use client';

import { CLASSIFICATION_LABELS, formatDateTime } from '@mas/domain';
import { Button, ClassificationBanner } from '@mas/ui';
import { ArrowLeft, Printer } from 'lucide-react';
import { useEffect } from 'react';
import { setQuery, useNavigate, useRoute } from '@/lib/router';
import { useAppStore, useConfig, useData, useNow } from '@/lib/store';
import { buildModel, parsePopulation } from './buildModel';
import { Chart } from './Chart';
import type { ReportKind, ReportSection, TableSpec } from './model';
import { resolvePeriod } from './period';
import styles from './ReportPrintPack.module.css';

function PackTable({ table }: { table: TableSpec }) {
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
              <td colSpan={table.columns.length}>{table.empty ?? 'None in period'}</td>
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
  const data = useData();
  const config = useConfig();
  const now = useNow();
  const route = useRoute();
  const navigate = useNavigate();
  const audit = useAppStore((s) => s.audit);
  const period = resolvePeriod(kind, now, route.query.get('period'));
  const model = buildModel(kind, data, config, now, period, { population: parsePopulation(route.query) });

  useEffect(() => {
    audit({ act: 'export', targetType: 'report', targetId: `${kind}:${period.id}`, targetLabel: `${model.title} print pack: ${period.label}` });
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
  const marking = CLASSIFICATION_LABELS[model.classification];
  const back = `/reports/${kind}${setQuery(route.query, { print: null })}`;

  const head = (page: number) => (
    <div className={styles.head}>
      <span>{marking}</span>
      <span>{model.title}</span>
      <span>
        Page {page} of {totalPages}
      </span>
    </div>
  );
  const foot = (
    <div className={styles.foot}>
      <span>Printed {formatDateTime(now)} from the platform. Synthetic demonstration data.</span>
      <span>{marking}</span>
    </div>
  );

  return (
    <div className={`${styles.pack} print-pack`}>
      <div className={`${styles.controls} no-print`}>
        <Button variant="secondary" icon={<ArrowLeft size={16} aria-hidden="true" />} onClick={() => navigate(back)}>
          Back to the report
        </Button>
        <Button variant="primary" size="lg" icon={<Printer size={16} aria-hidden="true" />} onClick={() => window.print()}>
          Print
        </Button>
      </div>
      <ClassificationBanner level={model.classification} />
      <section className={`${styles.page} print-page`}>
        {head(1)}
        <h1 className={styles.title}>{model.title}</h1>
        <p className={styles.meta}>{model.period.label}.</p>
        <p className={styles.meta}>{model.lede}</p>
        <p className={styles.meta}>{model.meta.join(' ')}</p>
        <h2>Headline figures</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Measure</th>
              <th scope="col" data-align="num">
                Value
              </th>
              <th scope="col">Note</th>
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
        <h2>Field set and sources</h2>
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
              {s.tables.map((t) => (
                <PackTable key={t.id} table={t} />
              ))}
            </div>
          ))}
          {foot}
        </section>
      ))}
    </div>
  );
}
