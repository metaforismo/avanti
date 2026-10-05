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
        if (!cancelled) setLoaded({ path, data, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const err =
          error instanceof ApiRequestError
            ? error
            : new ApiRequestError(0, "internal", "Errore imprevisto.");
        if (err.status === 401) {
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
    (data: T) => setLoaded((current) => ({ ...current, data, error: null })),
    [],
  );
  const refreshing = loaded.path !== path;

  const state: Resource<T> =
    loaded.error && !refreshing
      ? { status: "error", data: loaded.data, error: loaded.error, refreshing }
      : loaded.data !== null
        ? { status: "ready", data: loaded.data, error: null, refreshing }
        : { status: "loading", data: null, error: null, refreshing };

  return { ...state, reload, setData };
}
