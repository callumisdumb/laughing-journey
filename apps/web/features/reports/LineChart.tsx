'use client';

import type { CSSProperties } from 'react';
import { ChartFrame } from './ChartFrame';
import { GEOMETRY, ticksFor } from './geometry';
import type { ChartSpec } from './model';
import styles from './LineChart.module.css';

/** One line per series across ordered categories, every point marked and labelled. */
export function LineChart({ spec }: { spec: ChartSpec }) {
  const { width, height, left, right, top, bottom } = GEOMETRY;
  const n = spec.categories.length;
  const ticks = ticksFor(Math.max(0, ...spec.values.flat()));
  const scaleMax = ticks[ticks.length - 1] ?? 1;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const x = (ci: number) => (n > 1 ? left + (ci * plotW) / (n - 1) : left + plotW / 2);
  const y = (v: number) => top + plotH - (v / scaleMax) * plotH;
  const yTitleTransform = `translate(16 ${top + plotH / 2}) rotate(-90)`;
  const showValues = n <= 14;

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
        <line className={styles.axis} x1={left} x2={width - right} y1={y(0)} y2={y(0)} />
        {spec.series.map((ser, si) => {
          const points = spec.categories.map((_, ci) => `${x(ci).toFixed(1)},${y(spec.values[si]?.[ci] ?? 0).toFixed(1)}`).join(' ');
          return (
            <g key={ser.key} className={styles.series} data-series={si} style={{ '--series-colour': ser.colour } as CSSProperties}>
              {n > 1 ? <polyline className={styles.line} points={points} /> : null}
              {spec.categories.map((c, ci) => {
                const v = spec.values[si]?.[ci] ?? 0;
                return (
                  <g key={c}>
                    <circle className={styles.point} cx={x(ci)} cy={y(v)} r={4} />
                    {showValues ? (
                      <text className={styles.valueText} x={x(ci)} y={y(v) - 9} textAnchor="middle">
                        {v}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        })}
        {spec.categories.map((c, ci) => (
          <text key={c} className={styles.axisText} x={x(ci)} y={height - bottom + 20} textAnchor="middle">
            {c}
          </text>
        ))}
        <text className={styles.axisTitle} x={left + plotW / 2} y={height - 10} textAnchor="middle">
          {spec.xLabel}
        </text>
        <text className={styles.axisTitle} transform={yTitleTransform} textAnchor="middle">
          {spec.yLabel}
        </text>
      </svg>
    </ChartFrame>
  );
}
