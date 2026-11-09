"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a media query matches, kept in sync with the window. On the server (and during
 * hydration) it reports `serverValue`: pick the layout the first paint should assume.
 */
export function useMediaQuery(query: string, serverValue = true) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** The console's desktop layout starts at Tailwind's `lg` (64rem). */
export const useDesktop = () => useMediaQuery("(min-width: 64rem)");
