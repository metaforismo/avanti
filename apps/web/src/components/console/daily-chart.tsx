"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { Metrics } from "@avanti/contracts";
import { cn } from "@/lib/cn";

// Validated pair (light surface): passes lightness, chroma, CVD and contrast checks.
const SERIES = [
  { key: "started", label: "Avviate", color: "#b86e00" },
  { key: "submitted", label: "Inviate", color: "#2440b3" },
] as const;

const WIDTH = 720;
const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 32 };
const dayLabel = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });

function niceMax(value: number) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * magnitude * 4 >= value)! * magnitude;
  return step * 4;
}

export function DailyChart({ daily }: { daily: Metrics["daily"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const titleId = useId();

  const { max, x, y } = useMemo(() => {
    const top = niceMax(Math.max(0, ...daily.flatMap((d) => [d.started, d.submitted])));
    const innerW = WIDTH - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    return {
      max: top,
      x: (i: number) =>
        PAD.left + (daily.length <= 1 ? innerW / 2 : (i / (daily.length - 1)) * innerW),
      y: (v: number) => PAD.top + innerH - (v / top) * innerH,
    };
  }, [daily]);

  const empty = daily.every((d) => d.started === 0 && d.submitted === 0);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const labelEvery = Math.max(1, Math.ceil(daily.length / 6));
  const hovered = hover !== null ? daily[hover] : undefined;

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || daily.length === 0) return;
    const px = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const ratio = (px - PAD.left) / (WIDTH - PAD.left - PAD.right);
    setHover(Math.max(0, Math.min(daily.length - 1, Math.round(ratio * (daily.length - 1)))));
  }

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-lg bg-surface p-5 ring-1 ring-line sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={titleId} className="font-display text-xl font-semibold">
          Pratiche al giorno
        </h2>
        <div className="flex items-center gap-4">
          <ul className="flex gap-4 text-sm text-ink-2" aria-label="Legenda">
            {SERIES.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-0.5 w-4 rounded-full"
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
      </div>

      {empty ? (
        <p className="mt-6 rounded-md bg-sunk px-4 py-10 text-center text-ink-3">
          Nessuna pratica nel periodo.
        </p>
      ) : asTable ? (
        <div className="mt-4 max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-ink-3">
              <tr>
                <th className="py-2 font-normal">Giorno</th>
                <th className="py-2 text-end font-normal">Avviate</th>
                <th className="py-2 text-end font-normal">Inviate</th>
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
        <div className="relative mt-4">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-auto w-full touch-none select-none"
            role="img"
            aria-label="Pratiche avviate e inviate al giorno. Usa la tabella per i valori."
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={WIDTH - PAD.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke="var(--line)"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={y(tick)}
                  dy="0.32em"
                  textAnchor="end"
                  className="tabular fill-ink-3 text-[11px]"
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
                  className="fill-ink-3 text-[11px]"
                >
                  {dayLabel.format(new Date(d.date))}
                </text>
              ) : null,
            )}
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
          </svg>
          {hovered && hover !== null && (
            <div
              className={cn(
                "pointer-events-none absolute top-0 rounded-md bg-ink px-3 py-2 text-sm text-white shadow-float",
                hover > daily.length / 2 ? "-translate-x-[calc(100%+12px)]" : "translate-x-3",
              )}
              style={{ left: `${(x(hover) / WIDTH) * 100}%` }}
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
    </section>
  );
}
