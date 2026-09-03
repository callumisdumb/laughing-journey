'use client';

import type { CSSProperties } from 'react';
import { ChartFrame } from './ChartFrame';
import { GEOMETRY, ticksFor } from './geometry';
import type { ChartSpec } from './model';
import styles from './BarChart.module.css';

/** Grouped bars: one group per category, one bar per series. Single-series charts may colour each bar by category. */
export function BarChart({ spec }: { spec: ChartSpec }) {
  const { width, height, left, right, top, bottom } = GEOMETRY;
  const n = Math.max(1, spec.categories.length);
  const s = Math.max(1, spec.series.length);
  const ticks = ticksFor(Math.max(0, ...spec.values.flat()));
  const scaleMax = ticks[ticks.length - 1] ?? 1;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const slot = plotW / n;
  const groupW = slot * 0.66;
  const barW = groupW / s;
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
        {spec.series.map((ser, si) => (
          <g key={ser.key} className={styles.series} data-series={si} style={{ '--series-colour': ser.colour } as CSSProperties}>
            {spec.categories.map((c, ci) => {
              const v = spec.values[si]?.[ci] ?? 0;
              const x = left + ci * slot + (slot - groupW) / 2 + si * barW;
              const w = Math.max(2, barW - 3);
              const colour = spec.categoryColours?.[ci];
              return (
                <g key={c} style={colour ? ({ '--series-colour': colour } as CSSProperties) : undefined}>
                  <rect className={styles.bar} x={x} y={y(v)} width={w} height={top + plotH - y(v)} rx={2} />
                  {v > 0 ? (
                    <text className={styles.valueText} x={x + w / 2} y={y(v) - 5} textAnchor="middle">
                      {v}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        ))}
        <line className={styles.axis} x1={left} x2={width - right} y1={y(0)} y2={y(0)} />
        {spec.categories.map((c, ci) => (
          <text key={c} className={styles.axisText} x={left + ci * slot + slot / 2} y={height - bottom + 20} textAnchor="middle">
            {c}
          </text>
        ))}
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
