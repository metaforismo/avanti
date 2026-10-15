"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiRequestError } from "@/lib/api";

export type Resource<T> =
  | { status: "loading"; data: null; error: null; refreshing: boolean }
  | { status: "ready"; data: T; error: null; refreshing: boolean }
  | { status: "error"; data: T | null; error: ApiRequestError; refreshing: boolean };

type Loaded<T> = { path: string | null; data: T | null; error: ApiRequestError | null };

/**
 * The last answer per path, in memory only (never browser storage): a screen opened again shows
 * what it showed before at once and refreshes behind it. Cleared on login, logout and 401, so a
 * colleague signing in on the same tab never sees the previous operator's data.
 */
const cache = new Map<string, unknown>();
const CACHE_SIZE = 50;

function remember(path: string, data: unknown) {
  cache.delete(path);
  cache.set(path, data);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
}

export function clearResourceCache() {
  cache.clear();
}

/**
 * GET a JSON resource. Previous data stays visible while a new path loads (`refreshing`),
 * so filters don't flash an empty screen. A 401 sends the operator back to login.
 */
export function useResource<T>(path: string | null) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded<T>>({ path: null, data: null, error: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    apiFetch<T>(path)
      .then((data) => {
        if (cancelled) return;
        remember(path, data);
        setLoaded({ path, data, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const err =
          error instanceof ApiRequestError
            ? error
            : new ApiRequestError(0, "internal", "Errore imprevisto.");
        if (err.status === 401) {
          clearResourceCache();
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          router.replace(`/console/accedi?motivo=sessione&next=${next}` as never);
          return;
        }
        setLoaded((current) => ({ path, data: current.data, error: err }));
      });
    return () => {
      cancelled = true;
    };
  }, [path, version, router]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback(
    (data: T) => {
      if (path) remember(path, data);
      setLoaded((current) => ({ ...current, data, error: null }));
    },
    [path],
  );

  const cached = path !== null && loaded.path !== path && cache.has(path);
  const data = cached ? (cache.get(path) as T) : loaded.data;
  const refreshing = loaded.path !== path && !cached;

  const state: Resource<T> =
    loaded.error && !refreshing && !cached
      ? { status: "error", data, error: loaded.error, refreshing }
      : data !== null
        ? { status: "ready", data, error: null, refreshing }
        : { status: "loading", data: null, error: null, refreshing };

  return { ...state, reload, setData };
}
