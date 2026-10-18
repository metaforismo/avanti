import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ONLINE_RETRY_MS, onlineRetries } from "./online-retry";

const timers = {
  set: (callback: () => void, ms: number) => setTimeout(callback, ms) as unknown as number,
  clear: (id: number) => clearTimeout(id),
};

describe("onlineRetries", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("retries at once and again after each delay while the browser stays online", () => {
    const retry = vi.fn();
    const { onOnline } = onlineRetries(retry, () => true, timers);
    onOnline();
    expect(retry).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(ONLINE_RETRY_MS[0]);
    expect(retry).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(ONLINE_RETRY_MS[1] - ONLINE_RETRY_MS[0]);
    expect(retry).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(60_000);
    expect(retry).toHaveBeenCalledTimes(3);
  });

  it("skips a later try while the connection is gone again", () => {
    const retry = vi.fn();
    let online = true;
    const { onOnline } = onlineRetries(retry, () => online, timers);
    onOnline();
    online = false;
    vi.advanceTimersByTime(ONLINE_RETRY_MS[1]);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("starts over on a new «online» instead of stacking the tries", () => {
    const retry = vi.fn();
    const { onOnline } = onlineRetries(retry, () => true, timers);
    onOnline();
    vi.advanceTimersByTime(ONLINE_RETRY_MS[0] - 1);
    onOnline();
    vi.advanceTimersByTime(ONLINE_RETRY_MS[1]);
    // 2 immediate + 2 delayed of the second sequence; the first sequence's timers were dropped.
    expect(retry).toHaveBeenCalledTimes(4);
  });

  it("does nothing more once cancelled (the page left the documents step)", () => {
    const retry = vi.fn();
    const { onOnline, cancel } = onlineRetries(retry, () => true, timers);
    onOnline();
    cancel();
    vi.advanceTimersByTime(ONLINE_RETRY_MS[1]);
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
