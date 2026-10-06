export function lazyRuntime<T>(initialize: () => Promise<T>) {
  let pending: Promise<T> | undefined;
  let shutdown: Promise<void> | undefined;
  const get = () => {
    if (shutdown) return Promise.reject(new Error("Runtime is closed"));
    if (!pending) {
      // Turn synchronous setup errors into the same retryable failure as async errors.
      pending = Promise.resolve()
        .then(initialize)
        .catch((error) => {
          pending = undefined;
          throw error;
        });
    }
    return pending;
  };
  get.close = (dispose: (value: T) => Promise<void>): Promise<void> => {
    if (!shutdown) {
      const starting = pending;
      shutdown = (async () => {
        if (!starting) return;
        let value: T;
        try {
          value = await starting;
        } catch {
          // Failed initialization owns its cleanup; no resource was returned.
          return;
        }
        await dispose(value);
      })();
    }
    return shutdown;
  };
  return get;
}

/**
 * Like `lazyRuntime`, but one per process. Next.js evaluates this package once per bundle
 * (route handlers, server pages) and again on every hot reload, while PGlite allows a single
 * open instance per data directory.
 */
export function processSingleton<T>(key: symbol, initialize: () => Promise<T>) {
  const store = globalThis as Record<symbol, ReturnType<typeof lazyRuntime<T>> | undefined>;
  return (store[key] ??= lazyRuntime(initialize));
}

export function activityGate() {
  let active = 0;
  let closing = false;
  let resolveDrain: (() => void) | undefined;
  let shutdown: Promise<void> | undefined;
  return {
    get closing() {
      return closing;
    },
    begin() {
      if (closing) throw new Error("Runtime is draining");
      active++;
      let finished = false;
      return () => {
        if (finished) return;
        finished = true;
        active--;
        if (!active) resolveDrain?.();
      };
    },
    close(dispose: () => Promise<void>) {
      if (!shutdown) {
        closing = true;
        shutdown = (async () => {
          if (active)
            await new Promise<void>((resolve) => {
              resolveDrain = resolve;
            });
          await dispose();
        })();
      }
      return shutdown;
    },
  };
}
