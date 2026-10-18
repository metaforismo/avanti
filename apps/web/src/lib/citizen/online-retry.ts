/** After «online», how long until what failed again for the network is retried once more. */
export const ONLINE_RETRY_MS = [3_000, 10_000] as const;

type Timers = {
  set: (callback: () => void, ms: number) => number;
  clear: (id: number) => void;
};

/**
 * Retries now when the browser says the connection is back, and twice more shortly after:
 * «online» can come a moment before requests get through again (a waiting-room Wi-Fi). A new
 * «online» starts the sequence over; `cancel` stops what is left of it.
 */
export function onlineRetries(
  retry: () => void,
  isOnline: () => boolean,
  timers: Timers = {
    set: (callback, ms) => window.setTimeout(callback, ms),
    clear: (id) => window.clearTimeout(id),
  },
) {
  let pending: number[] = [];
  const cancel = () => {
    pending.forEach(timers.clear);
    pending = [];
  };
  const onOnline = () => {
    cancel();
    retry();
    pending = ONLINE_RETRY_MS.map((ms) => timers.set(() => isOnline() && retry(), ms));
  };
  return { onOnline, cancel };
}
