"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import type { Metrics } from "@avanti/contracts";
import { PANEL, PanelTitle } from "@/components/console/admin/panel";
import { cn } from "@/lib/cn";

// One hue, on the series the screen is about (what reached the desk); the context series is
// grey. Told apart by tone and by position in each day's pair, never by two competing hues.
const SERIES = [
  { key: "started", label: "Avviate", color: "var(--line-strong)" },
  { key: "submitted", label: "Inviate", color: "var(--stamp)" },
] as const;

const PAD = { top: 12, right: 16, bottom: 28, left: 32 };
// With few days that have something in them a line is flat stretches and a jump: bars say what
// happened each day. Lines come back once most days have data, or when bars would be slivers.
const MIN_DAYS_FOR_LINES = 7;
const MIN_HEIGHT = 180;
// Below 9 px a day the pair no longer fits side by side: the two bars overlap, the grey one
// behind, so a 30-day phone chart still shows days and not a line between jumps.
const MIN_PAIR_SLOT = 9;
const MIN_BAR_SLOT = 3;
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

export function DailyChart({ daily, className }: { daily: Metrics["daily"]; className?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const width = size.width;
  // The plot takes the height its frame has: in a row it fills the panel to the neighbour's
  // foot (no blank band under the note); alone, the frame's minimum.
  const HEIGHT = Math.max(MIN_HEIGHT, size.height);
  const svgRef = useRef<SVGSVGElement>(null);
  const titleId = useId();

  // Drawn at the pixel size it is shown at: a 720-wide drawing shrunk to a phone made the
  // axis labels 5 px tall.
  const observer = useRef<ResizeObserver | null>(null);
  const frame = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!node) return;
    setSize({ width: Math.floor(node.clientWidth), height: Math.floor(node.clientHeight) });
    observer.current = new ResizeObserver(([entry]) =>
      setSize({
        width: Math.floor(entry!.contentRect.width),
        height: Math.floor(entry!.contentRect.height),
      }),
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
  }, [daily, width, bars, HEIGHT]);

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
    <section aria-labelledby={titleId} className={cn(PANEL, "flex min-w-0 flex-col p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <PanelTitle id={titleId}>Pratiche al giorno</PanelTitle>
        <div className="flex items-center gap-4">
          {!empty && (
            <ul className="flex gap-3 text-[0.8125rem] text-ink-2" aria-label="Legenda">
              {SERIES.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn(bars ? "size-2 rounded-[1px]" : "h-0.5 w-3.5 rounded-full")}
                    style={{ background: s.color }}
                  />
                  {s.label}
                </li>
              ))}
            </ul>
          )}
          {!empty && (
            <button
              type="button"
              onClick={() => setAsTable((v) => !v)}
              className="rounded-xs text-[0.8125rem] font-semibold text-stamp hover:underline focus-visible:ring-2 focus-visible:ring-stamp focus-visible:outline-none"
            >
              {asTable ? "Mostra grafico" : "Mostra tabella"}
            </button>
          )}
        </div>
      </div>

      {asTable && !empty ? (
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
        <div ref={frame} className="relative mt-3 min-h-[180px] flex-1 lg:min-h-[220px]">
          {width > 0 && (
            <svg
              ref={svgRef}
              width={width}
              height={HEIGHT}
              viewBox={`0 0 ${width} ${HEIGHT}`}
              className="absolute inset-0 block touch-pan-y select-none"
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
                    stroke={tick === 0 ? "var(--line-strong)" : "var(--line)"}
                    strokeWidth={1}
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
                    const paired = slot >= MIN_PAIR_SLOT;
                    const w = paired ? Math.min(8, (slot - 3) / 2) : Math.max(2, slot - 2);
                    return SERIES.map((s, k) => {
                      const value = d[s.key];
                      if (value === 0) return null;
                      const h = Math.max(2, y(0) - y(value));
                      // Overlapped, the sent bar is narrower: the started one shows at its sides.
                      const bw = paired || k === 0 ? w : Math.max(1.5, w * 0.5);
                      return (
                        <rect
                          key={`${d.date}-${s.key}`}
                          x={paired ? x(i) - w - 1 + k * (w + 2) : x(i) - bw / 2}
                          y={y(0) - h}
                          width={bw}
                          height={h}
                          rx={Math.min(1, bw / 2)}
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
                    fill="var(--stamp)"
                    fillOpacity={0.08}
                    points={`${x(0)},${y(0)} ${daily.map((d, i) => `${x(i)},${y(d.submitted)}`).join(" ")} ${x(daily.length - 1)},${y(0)}`}
                  />
                  {SERIES.map((s) => (
                    <g key={s.key}>
                      <polyline
                        fill="none"
                        stroke={s.color}
                        strokeWidth={2}
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
      {/* An empty period is drawn too: the axis and its zero line, and one sentence. */}
      {!asTable && (empty || bars) && (
        <p className="mt-2 text-[0.8125rem] text-ink-3">
          {empty
            ? "Nessuna pratica nel periodo: le barre compaiono appena un cittadino ne avvia una."
            : "Pochi giorni di dati: il grafico si riempie con l’uso."}
        </p>
      )}
    </section>
  );
}
