"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Opens a form when a link pointed at it (`/console/impostazioni#nuovo-operatore`). In an effect,
 * not at render: on a client navigation the address bar changes only after the page renders.
 * `open` returns false when there is nothing to open; otherwise the anchor is dropped, so a
 * reload shows the page and not the form again.
 */
export function useOpenOnHash(hash: string, open: () => boolean) {
  const latest = useRef(open);
  useEffect(() => {
    latest.current = open;
  });
  useEffect(() => {
    if (window.location.hash !== hash || !latest.current()) return;
    const { pathname, search } = window.location;
    window.history.replaceState(window.history.state, "", pathname + search);
  }, [hash]);
}

/**
 * Brings a link's target into view once it exists: settings arrive after the navigation, too
 * late for the browser's own jump to the anchor. Runs once, so later reloads of the data don't
 * pull the page back while the admin is working elsewhere on it.
 */
export function useHashTarget(
  hashes: string[],
  ref: RefObject<HTMLElement | null>,
  ready = true,
  focus?: () => HTMLElement | null | undefined,
) {
  const done = useRef(false);
  const latest = useRef({ hashes, focus });
  useEffect(() => {
    latest.current = { hashes, focus };
  });
  useEffect(() => {
    if (done.current || !ready || !ref.current) return;
    if (!latest.current.hashes.includes(window.location.hash)) return;
    done.current = true;
    const field = latest.current.focus?.();
    if (field) {
      field.scrollIntoView({ block: "center" });
      field.focus({ preventScroll: true });
    } else {
      ref.current.scrollIntoView({ block: "start" });
    }
  }, [ready, ref]);
}
