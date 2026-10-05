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
