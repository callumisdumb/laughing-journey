'use client';

import { AGENCY_SHORT, type Agency, type ChronologyAnalysis, type ChronologyEvent, type LensResult } from '@mas/domain';
import { AGENCY_GLYPHS, AgencyMark } from '@mas/ui';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import type { Window } from './state';
import styles from './LanesChart.module.css';

export interface LanesChartProps {
  events: ChronologyEvent[];
  analyses: ChronologyAnalysis[];
  agencies: Agency[];
  domain: Window;
  lensResults: LensResult[];
  highlighted: Set<string>;
  selectedEventId: string | null;
  selectedAnalysisId: string | null;
  onSelectEvent: (id: string | null) => void;
  onSelectAnalysis: (id: string | null) => void;
  onBrush: (w: Window | null) => void;
  compact?: boolean;
  /** Plays the settle-in animation once. */
  settle?: boolean;
}

const RADIUS = { low: 3, moderate: 5, high: 7 } as const;
const AXIS = 28;

function ticksFor(from: Date, to: Date): Array<{ at: Date; label: string; major: boolean }> {
  const days = differenceInCalendarDays(to, from);
  const out: Array<{ at: Date; label: string; major: boolean }> = [];
  if (days > 900) {
    for (let y = from.getFullYear() + 1; y <= to.getFullYear(); y += 1) out.push({ at: new Date(y, 0, 1), label: String(y), major: true });
  } else if (days > 120) {
    const d = new Date(from.getFullYear(), from.getMonth() + 1, 1);
    while (d <= to) {
      out.push({ at: new Date(d), label: formatInTimeZone(d, 'Europe/London', d.getMonth() === 0 ? 'MMM yyyy' : 'MMM'), major: d.getMonth() === 0 });
      d.setMonth(d.getMonth() + 1);
    }
  } else {
    const step = days > 45 ? 7 : days > 14 ? 2 : 1;
    const d = new Date(from);
    d.setHours(0, 0, 0, 0);
    while (d <= to) {
      out.push({ at: new Date(d), label: formatInTimeZone(d, 'Europe/London', 'dd MMM'), major: d.getDate() === 1 });
      d.setDate(d.getDate() + step);
    }
  }
  return out;
}

export function LanesChart({ events, analyses, agencies, domain, lensResults, highlighted, selectedEventId, selectedAnalysisId, onSelectEvent, onSelectAnalysis, onBrush, compact = false, settle = false }: LanesChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [drag, setDrag] = useState<{ x0: number; x1: number } | null>(null);
  const pointRefs = useRef(new Map<string, SVGGElement>());

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.max(320, Math.floor(w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const laneHeight = compact ? 30 : 44;
  const lanes = useMemo<Array<{ key: string; agency?: Agency }>>(() => [...agencies.map((a) => ({ key: a, agency: a })), { key: 'analysis' }], [agencies]);
  const height = lanes.length * laneHeight + AXIS + 8;
  const from = parseISO(domain.from);
  const to = parseISO(domain.to);
  const span = Math.max(1, to.getTime() - from.getTime());
  const pad = 12;
  const x = useCallback((iso: string) => pad + ((parseISO(iso).getTime() - from.getTime()) / span) * (width - pad * 2), [from, span, width]);
  const invert = (px: number) => new Date(from.getTime() + ((px - pad) / (width - pad * 2)) * span);

  const sortedEvents = useMemo(() => [...events].sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1)), [events]);

  // Cluster handling: points in the same lane within 7px get a vertical offset; more than 3 collapse into a count.
  const placed = useMemo(() => {
    const byLane = new Map<string, ChronologyEvent[]>();
    for (const e of sortedEvents) {
      const list = byLane.get(e.agency) ?? [];
      list.push(e);
      byLane.set(e.agency, list);
    }
    const out: Array<{ event: ChronologyEvent; cx: number; cy: number; clusterCount?: number; hidden?: boolean }> = [];
    for (const [agency, list] of byLane) {
      const laneIndex = lanes.findIndex((l) => l.key === agency);
      const baseY = laneIndex * laneHeight + laneHeight / 2 + 8;
      let lastX = -Infinity;
      let stack = 0;
      for (let i = 0; i < list.length; i += 1) {
        const e = list[i]!;
        const cx = x(e.occurredAt);
        if (cx - lastX < 7) stack += 1;
        else stack = 0;
        lastX = cx;
        const offset = stack === 0 ? 0 : stack === 1 ? -8 : stack === 2 ? 8 : 0;
        out.push({ event: e, cx, cy: baseY + offset, hidden: stack > 2, clusterCount: undefined });
        if (stack === 3) {
          const anchor = out[out.length - 4];
          if (anchor) anchor.clusterCount = 4;
        } else if (stack > 3) {
          const anchor = out[out.length - 1 - stack];
          if (anchor && anchor.clusterCount) anchor.clusterCount += 1;
        }
      }
    }
    return out;
  }, [sortedEvents, lanes, laneHeight, x]);

  const ticks = useMemo(() => ticksFor(from, to), [from, to]);

  function onPointerDown(e: PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    setDrag({ x0: px, x1: px });
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent<SVGSVGElement>) {
    if (!drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setDrag({ x0: drag.x0, x1: Math.max(pad, Math.min(width - pad, e.clientX - rect.left)) });
  }
  function onPointerUp() {
    if (!drag) return;
    const a = Math.min(drag.x0, drag.x1);
    const b = Math.max(drag.x0, drag.x1);
    setDrag(null);
    if (b - a < 6) return;
    onBrush({ from: invert(a).toISOString(), to: invert(b).toISOString() });
  }

  function onPointKey(e: KeyboardEvent<SVGGElement>, index: number) {
    let next = index;
    if (e.key === 'ArrowRight') next = Math.min(sortedEvents.length - 1, index + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, index - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = sortedEvents.length - 1;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectEvent(sortedEvents[index]?.id ?? null);
      return;
    } else return;
    e.preventDefault();
    const target = sortedEvents[next];
    if (target) {
      onSelectEvent(target.id);
      pointRefs.current.get(target.id)?.focus();
    }
  }

  const activeSpans = lensResults.flatMap((r) => r.spans.map((s) => ({ ...s, lens: r.label })));
  const dimming = highlighted.size > 0;

  return (
    <div className={styles.chart} data-compact={compact ? 'true' : undefined} role="group" aria-label="Chronology lanes by agency">
      <div className={styles.labels} aria-hidden="true">
        {lanes.map((l) => (
          <div key={l.key} className={styles.label} data-lane={l.key}>
            {l.agency ? <AgencyMark agency={l.agency} /> : 'Analysis'}
          </div>
        ))}
        <div className={styles.axisLabel} />
      </div>
      <div className={styles.svgWrap} ref={wrapRef}>
        <svg className={styles.svg} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="application" aria-label={`${events.length} events across ${agencies.length} agencies. Use Tab to reach an event, arrow keys to move between events, Enter to open. Drag to zoom to a period.`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
          {lanes.map((l, i) => (
            <g key={l.key} className={settle ? 'settle-in' : undefined} data-lane={Math.min(i, 5)}>
              {l.key === 'analysis' ? <rect className={styles.analysisBand} x={0} y={i * laneHeight + 8} width={width} height={laneHeight} /> : null}
              <line className={styles.laneLine} x1={0} x2={width} y1={(i + 1) * laneHeight + 8} y2={(i + 1) * laneHeight + 8} />
            </g>
          ))}
          {ticks.map((t) => {
            const tx = x(t.at.toISOString());
            return (
              <g key={t.at.toISOString()}>
                <line className={styles.gridLine} x1={tx} x2={tx} y1={8} y2={height - AXIS} />
                <text className={styles.axisText} x={tx + 3} y={height - 8} fontWeight={t.major ? 700 : 400}>
                  {t.label}
                </text>
              </g>
            );
          })}
          {activeSpans.map((s, i) => {
            const sx = Math.max(pad, x(s.from));
            const ex = Math.min(width - pad, x(s.to));
            if (ex <= sx) return null;
            return (
              <g key={`${s.lens}-${i}`}>
                <rect className={styles.span} x={sx} y={8} width={ex - sx} height={height - AXIS - 8} />
                <text className={styles.spanLabel} x={Math.min(sx + 4, width - 8 - s.label.length * 6.2)} y={20 + (i % 2) * 12}>
                  {s.label}
                </text>
              </g>
            );
          })}
          {analyses.map((a, i) => {
            const linked = events.filter((e) => a.eventIds.includes(e.id));
            const dates = (linked.length > 0 ? linked : []).map((e) => e.occurredAt).sort();
            const startIso = dates[0] ?? a.recordedAt;
            const endIso = dates[dates.length - 1] ?? a.recordedAt;
            const sx = Math.max(pad, x(startIso));
            const ex = Math.max(sx + 6, Math.min(width - pad, x(endIso)));
            const laneIndex = lanes.length - 1;
            const rowGap = compact ? 11 : 12;
            const y = laneIndex * laneHeight + 8 + rowGap + (i % (compact ? 2 : 3)) * rowGap;
            const labelText = a.title.length > 34 ? `${a.title.slice(0, 32)}...` : a.title;
            const labelX = Math.max(pad, Math.min(sx, width - pad - labelText.length * 6.2));
            return (
              <g key={a.id} className={styles.analysis} data-selected={selectedAnalysisId === a.id ? 'true' : undefined} tabIndex={0} role="button" aria-label={`Analysis: ${a.title}, ${a.authorName}`} onClick={(e) => { e.stopPropagation(); onSelectAnalysis(a.id); }} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectAnalysis(a.id); } }}>
                <line x1={sx} x2={ex} y1={y} y2={y} />
                <line x1={sx} x2={sx} y1={y - 4} y2={y + 4} />
                <line x1={ex} x2={ex} y1={y - 4} y2={y + 4} />
                <text x={labelX} y={y - 5} textAnchor="start">
                  {labelText}
                </text>
              </g>
            );
          })}
          {placed.map((p) => {
            if (p.hidden) return null;
            const index = sortedEvents.findIndex((e) => e.id === p.event.id);
            const Glyph = AGENCY_GLYPHS[p.event.agency];
            const r = RADIUS[p.event.significance];
            const style = { '--agency': `var(--color-agency-${p.event.agency})` } as CSSProperties;
            const label = `${p.event.title}, ${p.event.occurredAt.slice(0, 10)}, ${AGENCY_SHORT[p.event.agency]}, ${p.event.significance} significance`;
            return (
              <g
                key={p.event.id}
                ref={(el) => {
                  if (el) pointRefs.current.set(p.event.id, el);
                  else pointRefs.current.delete(p.event.id);
                }}
                className={styles.point}
                style={style}
                data-significance={p.event.significance}
                data-selected={selectedEventId === p.event.id ? 'true' : undefined}
                data-highlight={highlighted.has(p.event.id) ? 'true' : undefined}
                data-dim={dimming && !highlighted.has(p.event.id) ? 'true' : undefined}
                tabIndex={0}
                role="button"
                aria-label={label}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEvent(p.event.id);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => onPointKey(e, index)}
              >
                <title>{label}</title>
                {highlighted.has(p.event.id) ? <circle className={styles.halo} cx={p.cx} cy={p.cy} r={r + 5} /> : null}
                <circle cx={p.cx} cy={p.cy} r={r} />
                {p.event.significance === 'high' && !compact ? (
                  <g className={styles.glyph} transform={`translate(${p.cx - 5}, ${p.cy - 5})`}>
                    <Glyph size={16} variant="outline" style={{ width: 10, height: 10 }} />
                  </g>
                ) : null}
                {p.clusterCount ? (
                  <text className={styles.cluster} x={p.cx + r + 2} y={p.cy - r - 2}>
                    {p.clusterCount}
                  </text>
                ) : null}
              </g>
            );
          })}
          {drag ? (
            <g>
              <rect className={styles.brush} x={Math.min(drag.x0, drag.x1)} y={8} width={Math.abs(drag.x1 - drag.x0)} height={height - AXIS - 8} />
              <line className={styles.brushHandle} x1={drag.x0} x2={drag.x0} y1={8} y2={height - AXIS} />
              <line className={styles.brushHandle} x1={drag.x1} x2={drag.x1} y1={8} y2={height - AXIS} />
            </g>
          ) : null}
        </svg>
        <div className={styles.hint}>Drag across the axis to zoom to a period. Point size is significance. Dashed halos mark events a pattern lens is prompting about.</div>
      </div>
    </div>
  );
}
