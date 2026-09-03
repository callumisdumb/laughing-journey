'use client';

import type { CSSProperties } from 'react';
import { ChartFrame } from './ChartFrame';
import { GEOMETRY, wrapLabel, ticksFor } from './geometry';
import type { ChartSpec } from './model';
import styles from './StackedBarChart.module.css';

/** One bar per category, segments stacked in series order, the total printed above. */
export function StackedBarChart({ spec }: { spec: ChartSpec }) {
  const { width, height, left, right, top, bottom } = GEOMETRY;
  const n = Math.max(1, spec.categories.length);
  const totals = spec.categories.map((_, ci) => spec.series.reduce((acc, _s, si) => acc + (spec.values[si]?.[ci] ?? 0), 0));
  const ticks = ticksFor(Math.max(0, ...totals));
  const scaleMax = ticks[ticks.length - 1] ?? 1;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const slot = plotW / n;
  const barW = Math.max(2, slot * 0.6);
  const y = (v: number) => top + plotH - (v / scaleMax) * plotH;

  return (
    <ChartFrame spec={spec}>
      <svg className={styles.svg} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={spec.summary} data-dense={n > 9 ? 'true' : undefined}>
        <title>{spec.summary}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line className={styles.grid} x1={left} x2={width - right} y1={y(t)} y2={y(t)} />
            <text className={styles.axisText} x={left - 8} y={y(t) + 4} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {spec.categories.map((c, ci) => {
          const x = left + ci * slot + (slot - barW) / 2;
          let acc = 0;
          const segments = spec.series.map((ser, si) => {
            const v = spec.values[si]?.[ci] ?? 0;
            const from = acc;
            acc += v;
            return { ser, si, v, from };
          });
          const total = totals[ci] ?? 0;
          return (
            <g key={c}>
              {segments.map(({ ser, si, v, from }) => (
                <rect key={ser.key} className={styles.bar} data-series={si} style={{ '--series-colour': ser.colour } as CSSProperties} x={x} y={y(from + v)} width={barW} height={y(from) - y(from + v)} />
              ))}
              {total > 0 ? (
                <text className={styles.valueText} x={x + barW / 2} y={y(total) - 5} textAnchor="middle">
                  {total}
                </text>
              ) : null}
            </g>
          );
        })}
        <line className={styles.axis} x1={left} x2={width - right} y1={y(0)} y2={y(0)} />
        {spec.categories.map((c, ci) => {
          const lines = wrapLabel(c, Math.max(8, Math.floor(slot / 6.5)));
          const cx = left + ci * slot + slot / 2;
          return (
            <text key={c} className={styles.axisText} x={cx} y={height - bottom + 20} textAnchor="middle">
              {lines.map((line, li) => (
                <tspan key={li} x={cx} dy={li === 0 ? 0 : 13}>
                  {line}
                </tspan>
              ))}
            </text>
          );
        })}
        <text className={styles.axisTitle} x={left + plotW / 2} y={height - 10} textAnchor="middle">
          {spec.xLabel}
        </text>
        <text className={styles.axisTitle} transform={`translate(16 ${top + plotH / 2}) rotate(-90)`} textAnchor="middle">
          {spec.yLabel}
        </text>
      </svg>
    </ChartFrame>
  );
}
