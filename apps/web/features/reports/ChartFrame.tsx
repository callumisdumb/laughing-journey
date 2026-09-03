'use client';

import { useT } from '@mas/messages';
import { AgencyMark, Table, TableWrap } from '@mas/ui';
import type { CSSProperties, ReactNode } from 'react';
import type { ChartSeries, ChartSpec } from './model';
import styles from './ChartFrame.module.css';

/** Title, legend, the chart itself and always the data table with the same numbers. */
export function ChartFrame({ spec, children }: { spec: ChartSpec; children: ReactNode }) {
  const t = useT();
  const multi = spec.series.length > 1;
  const legend: ChartSeries[] = spec.categoryLegend ?? (multi ? spec.series : []);
  const totals = spec.categories.map((_, ci) => spec.series.reduce((acc, _s, si) => acc + (spec.values[si]?.[ci] ?? 0), 0));
  return (
    <figure className={styles.frame}>
      <figcaption className={styles.caption}>{spec.title}</figcaption>
      {legend.length > 0 ? (
        <ul className={styles.legend} aria-label={t('reports.chart.legend', { title: spec.title })}>
          {legend.map((s, i) => (
            <li key={s.key} className={styles.legendItem} data-series={i} style={{ '--series-colour': s.colour } as CSSProperties}>
              <span className={styles.swatch} aria-hidden="true" />
              {s.agency ? <AgencyMark agency={s.agency} /> : <span>{s.label}</span>}
            </li>
          ))}
        </ul>
      ) : null}
      <div className={styles.canvas}>{children}</div>
      <TableWrap label={t('reports.chart.data', { title: spec.title })} className={styles.table}>
        <Table>
          <thead>
            <tr>
              <th scope="col">{spec.xLabel}</th>
              {spec.series.map((s) => (
                <th key={s.key} scope="col" data-align="num">
                  {s.label}
                </th>
              ))}
              {multi ? (
                <th scope="col" data-align="num">
                  {t('reports.chart.total')}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {spec.categories.map((c, ci) => (
              <tr key={c}>
                <td>{spec.categoryLabels?.[ci] ?? c}</td>
                {spec.series.map((s, si) => (
                  <td key={s.key} data-align="num">
                    {spec.values[si]?.[ci] ?? 0}
                  </td>
                ))}
                {multi ? <td data-align="num">{totals[ci] ?? 0}</td> : null}
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    </figure>
  );
}
