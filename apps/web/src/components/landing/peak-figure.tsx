"use client";

import { useId, useState } from "react";

/** INPS, Osservatorio DSU e ISEE (febbraio 2026): the share of DSU filed from January to March. */
const FIRST_QUARTER_SHARE = 0.71;
const DEFAULT_YEARLY = 1200;

const format = new Intl.NumberFormat("it-IT");

/**
 * The figure is the visitor's own: their yearly DSU, times the national share that arrives in
 * the first quarter. The server renders the default, so without JavaScript the figure is there
 * and true for that number.
 */
export function PeakFigure() {
  const [yearly, setYearly] = useState(DEFAULT_YEARLY);
  const id = useId();
  const peak = Math.round(yearly * FIRST_QUARTER_SHARE);

  return (
    <>
      <div data-ui className="mt-7 w-full max-w-[25rem] rounded-[10px] bg-on-stamp/10 p-4">
        <label htmlFor={id} className="flex items-baseline justify-between gap-4 text-on-stamp">
          <span className="text-[0.9375rem]">DSU del vostro sportello in un anno</span>
          <output htmlFor={id} className="tabular text-lg font-semibold">
            {format.format(yearly)}
          </output>
        </label>
        <input
          id={id}
          type="range"
          min={100}
          max={5000}
          step={50}
          value={yearly}
          onChange={(event) => setYearly(Number(event.target.value))}
          className="mt-2 h-11 w-full cursor-pointer accent-marker focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marker"
        />
      </div>

      <p className="mt-auto flex flex-wrap items-baseline gap-x-5 pt-16 text-on-stamp">
        <span
          aria-live="polite"
          className="tabular font-display text-[clamp(7rem,19vw,20rem)] leading-[0.8] font-bold tracking-[-0.02em]"
        >
          {format.format(peak)}
        </span>
        <span className="font-display text-[clamp(1.25rem,0.6rem+2.2vw,2.5rem)] leading-tight font-semibold">
          tra gennaio e marzo
        </span>
      </p>
    </>
  );
}
