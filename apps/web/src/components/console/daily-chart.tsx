"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import type { Metrics } from "@avanti/contracts";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";

// Validated pair (light surface): passes lightness, chroma, CVD and contrast checks.
const SERIES = [
  { key: "started", label: "Avviate", color: "var(--chart-started)" },
  { key: "submitted", label: "Inviate", color: "var(--chart-submitted)" },
] as const;

const HEIGHT = 220;
const PAD = { top: 12, right: 16, bottom: 28, left: 32 };
// With few days that have something in them a line is flat stretches and a jump: bars say what
// happened each day. Lines come back once most days have data, or when bars would be slivers.
const MIN_DAYS_FOR_LINES = 7;
const MIN_BAR_SLOT = 9;
const dayLabel = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });

/** A top for the axis on whole-number steps (1, 2, 5, 10, 20…), at most four of them. */
function axisOf(value: number) {
  for (let magnitude = 1; ; magnitude *= 10) {
    for (const base of [1, 2, 5]) {
      const step = base * magnitude;
      if (Math.ceil(value / step) <= 4)
        return { step, top: Math.max(2, Math.ceil(value / step)) * step };
    }
  }
}

export function DailyChart({ daily }: { daily: Metrics["daily"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const [width, setWidth] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const titleId = useId();

  // Drawn at the pixel size it is shown at: a 720-wide drawing shrunk to a phone made the
  // axis labels 5 px tall.
  const observer = useRef<ResizeObserver | null>(null);
  const frame = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!node) return;
    setWidth(Math.floor(node.clientWidth));
    observer.current = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry!.contentRect.width)),
    );
    observer.current.observe(node);
  }, []);

  const daysWithData = daily.filter((d) => d.started > 0 || d.submitted > 0).length;
  const sparse = daysWithData < MIN_DAYS_FOR_LINES || daysWithData < daily.length / 2;
  const bars = sparse && (width - PAD.left - PAD.right) / Math.max(1, daily.length) >= MIN_BAR_SLOT;

  const { axis, innerW, slot, x, y } = useMemo(() => {
    const axis = axisOf(Math.max(0, ...daily.flatMap((d) => [d.started, d.submitted])));
    const innerW = Math.max(0, width - PAD.left - PAD.right);
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const slot = daily.length === 0 ? 0 : innerW / daily.length;
    return {
      axis,
      innerW,
      slot,
      // Bars sit in the middle of their day's slot; lines run from the first day to the last.
      x: (i: number) =>
        bars
          ? PAD.left + slot * (i + 0.5)
          : PAD.left + (daily.length <= 1 ? innerW / 2 : (i / (daily.length - 1)) * innerW),
      y: (v: number) => PAD.top + innerH - (v / axis.top) * innerH,
    };
  }, [daily, width, bars]);

  const empty = daily.every((d) => d.started === 0 && d.submitted === 0);
  const ticks = Array.from({ length: axis.top / axis.step + 1 }, (_, i) => i * axis.step);
  const labelEvery = Math.max(1, Math.ceil(daily.length / Math.max(1, Math.floor(innerW / 72))));
  const hovered = hover !== null ? daily[hover] : undefined;

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || daily.length === 0) return;
    const px = event.clientX - rect.left - PAD.left;
    const index = bars ? Math.floor(px / slot) : Math.round((px / innerW) * (daily.length - 1));
    setHover(Math.max(0, Math.min(daily.length - 1, index)));
  }

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-lg bg-surface p-5 shadow-raised ring-1 ring-line sm:p-6"
    >
      <SectionHeader
        id={titleId}
        title="Pratiche al giorno"
        className="items-center"
        actions={
          <div className="flex items-center gap-4">
            <ul className="flex gap-4 text-sm text-ink-2" aria-label="Legenda">
              {SERIES.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn(bars ? "size-2.5 rounded-xs" : "h-0.5 w-4 rounded-full")}
                    style={{ background: s.color }}
                  />
                  {s.label}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setAsTable((v) => !v)}
              className="rounded-sm text-sm font-semibold text-stamp hover:underline"
            >
              {asTable ? "Mostra grafico" : "Mostra tabella"}
            </button>
          </div>
        }
      />

      {empty ? (
        <EmptyState icon={BarChart3} title="Nessuna pratica nel periodo." className="mt-6 py-10">
          Il grafico compare appena un cittadino avvia una pratica.
        </EmptyState>
      ) : asTable ? (
        <div className="mt-4 max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-ink-3">
              <tr>
                <th scope="col" className="py-2 text-start font-normal">
                  Giorno
                </th>
                <th scope="col" className="py-2 text-end font-normal">
                  Avviate
                </th>
                <th scope="col" className="py-2 text-end font-normal">
                  Inviate
                </th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-line">
              {daily.map((d) => (
                <tr key={d.date}>
                  <td className="py-1.5">{dayLabel.format(new Date(d.date))}</td>
                  <td className="py-1.5 text-end">{d.started}</td>
                  <td className="py-1.5 text-end">{d.submitted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={frame} className="relative mt-4" style={{ minHeight: HEIGHT }}>
          {width > 0 && (
            <svg
              ref={svgRef}
              width={width}
              height={HEIGHT}
              viewBox={`0 0 ${width} ${HEIGHT}`}
              className="block touch-pan-y select-none"
              role="img"
              aria-label="Pratiche avviate e inviate al giorno. Usa la tabella per i valori."
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
            >
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={y(tick)}
                    y2={y(tick)}
                    stroke="var(--line)"
                    strokeWidth={1}
                    strokeDasharray={tick === 0 ? undefined : "2 4"}
                  />
                  <text
                    x={PAD.left - 8}
                    y={y(tick)}
                    dy="0.32em"
                    textAnchor="end"
                    className="tabular fill-ink-3 text-[13px]"
                  >
                    {tick}
                  </text>
                </g>
              ))}
              {daily.map((d, i) =>
                i % labelEvery === 0 ? (
                  <text
                    key={d.date}
                    x={x(i)}
                    y={HEIGHT - 8}
                    textAnchor="middle"
                    className="fill-ink-3 text-[13px]"
                  >
                    {dayLabel.format(new Date(d.date))}
                  </text>
                ) : null,
              )}
              {bars ? (
                <>
                  {hover !== null && (
                    <rect
                      x={PAD.left + slot * hover}
                      y={PAD.top}
                      width={slot}
                      height={HEIGHT - PAD.top - PAD.bottom}
                      rx={4}
                      fill="var(--sunk)"
                    />
                  )}
                  {daily.map((d, i) => {
                    const w = Math.max(1.5, Math.min(8, (slot - 3) / 2));
                    return SERIES.map((s, k) => {
                      const value = d[s.key];
                      if (value === 0) return null;
                      const h = Math.max(2, y(0) - y(value));
                      return (
                        <rect
                          key={`${d.date}-${s.key}`}
                          x={x(i) - w - 1 + k * (w + 2)}
                          y={y(0) - h}
                          width={w}
                          height={h}
                          rx={Math.min(2, w / 2)}
                          fill={s.color}
                        />
                      );
                    });
                  })}
                </>
              ) : (
                <>
                  {hover !== null && (
                    <line
                      x1={x(hover)}
                      x2={x(hover)}
                      y1={PAD.top}
                      y2={HEIGHT - PAD.bottom}
                      stroke="var(--ink-3)"
                      strokeDasharray="3 3"
                    />
                  )}
                  {/* A flat tint under the sent line: the shape of the day reads before the numbers. */}
                  <polygon
                    fill="var(--chart-submitted)"
                    fillOpacity={0.08}
                    points={`${x(0)},${y(0)} ${daily.map((d, i) => `${x(i)},${y(d.submitted)}`).join(" ")} ${x(daily.length - 1)},${y(0)}`}
                  />
                  {SERIES.map((s) => (
                    <g key={s.key}>
                      <polyline
                        fill="none"
                        stroke={s.color}
                        strokeWidth={2.25}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={daily.map((d, i) => `${x(i)},${y(d[s.key])}`).join(" ")}
                      />
                      {hover !== null && hovered && (
                        <circle
                          cx={x(hover)}
                          cy={y(hovered[s.key])}
                          r={4.5}
                          fill={s.color}
                          stroke="var(--surface)"
                          strokeWidth={2}
                        />
                      )}
                    </g>
                  ))}
                </>
              )}
            </svg>
          )}
          {hovered && hover !== null && (
            <div
              className={cn(
                "pointer-events-none absolute top-0 z-10 rounded-md bg-contrast px-3 py-2 text-sm text-on-contrast shadow-float ring-1 ring-on-contrast/10",
                hover > daily.length / 2 ? "-translate-x-[calc(100%+12px)]" : "translate-x-3",
              )}
              style={{ left: x(hover) }}
            >
              <p className="font-semibold">{dayLabel.format(new Date(hovered.date))}</p>
              {SERIES.map((s) => (
                <p key={s.key} className="tabular flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ background: s.color }}
                  />
                  {s.label}: {hovered[s.key]}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
      {!empty && !asTable && bars && (
        <p className="mt-3 text-[0.8125rem] text-ink-3">
          Pochi giorni di dati: il grafico si riempie con l&apos;uso.
        </p>
      )}
    </section>
  );
}
