export function lazyRuntime<T>(initialize: () => Promise<T>) {
  let pending: Promise<T> | undefined;
  return () => {
    if (!pending) {
      pending = initialize().catch((error) => {
        pending = undefined;
        throw error;
      });
    }
    return pending;
  };
}

/**
 * Like `lazyRuntime`, but one per process. Next.js evaluates this package once per bundle
 * (route handlers, server pages) and again on every hot reload, while PGlite allows a single
 * open instance per data directory.
 */
export function processSingleton<T>(key: symbol, initialize: () => Promise<T>) {
  const store = globalThis as Record<symbol, (() => Promise<T>) | undefined>;
  return (store[key] ??= lazyRuntime(initialize));
}
