"use client";

import { useEffect, useRef } from "react";

/**
 * A figure that counts up once when it scrolls into view. The server renders the final value,
 * so without JavaScript, with reduced motion, or when it is already on screen at load, the
 * number is simply there. Only the text changes: the box keeps its size (tabular figures).
 */
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return;

    let frame = 0;
    const format = (n: number) => `${Math.round(n)}${suffix}`;
    node.textContent = format(0);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const duration = 1100;
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          // easeOutExpo: most of the count happens at once, the last digits settle.
          const eased = t === 1 ? 1 : 1 - 2 ** (-10 * t);
          node.textContent = format(value * eased);
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      node.textContent = format(value);
    };
  }, [value, suffix]);

  return (
    <>
      <span className="sr-only">{`${value}${suffix}`}</span>
      <span ref={ref} aria-hidden className="tabular">
        {`${value}${suffix}`}
      </span>
    </>
  );
}
