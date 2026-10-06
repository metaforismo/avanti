import { expect, it, vi } from "vitest";
import { lazyRuntime, processSingleton } from "./runtime";
it("12: only failed initialization is retried; handler failures keep the pool", async () => {
  const initialize = vi
    .fn()
    .mockRejectedValueOnce(new Error("init"))
    .mockResolvedValue({
      fetch: () => {
        throw new Error("request");
      },
    });
  const runtime = lazyRuntime<{ fetch: () => never }>(initialize);
  await expect(runtime()).rejects.toThrow("init");
  const app = await runtime();
  expect(() => app.fetch()).toThrow("request");
  expect(await runtime()).toBe(app);
  expect(initialize).toHaveBeenCalledTimes(2);
});

it("shares one instance across copies of the module and retries a failed start", async () => {
  const key = Symbol("test.singleton");
  const first = vi.fn().mockRejectedValueOnce(new Error("busy")).mockResolvedValue("db");
  const second = vi.fn().mockResolvedValue("other db");
  // Two bundles evaluating the same module each ask for the singleton.
  const fromRoutes = processSingleton(key, first);
  const fromPages = processSingleton(key, second);
  await expect(fromRoutes()).rejects.toThrow("busy");
  expect(await fromPages()).toBe("db");
  expect(await fromRoutes()).toBe("db");
  expect(second).not.toHaveBeenCalled();
});

it("deduplicates concurrent startup across a reimported bundle", async () => {
  const key = Symbol("test.concurrent");
  const initialize = vi.fn(async () => ({ pool: "one" }));
  const first = processSingleton(key, initialize);
  vi.resetModules();
  const copy = await import("./runtime");
  const second = copy.processSingleton(
    key,
    vi.fn(async () => ({ pool: "another" })),
  );
  const values = await Promise.all([first(), second(), first(), second()]);
  expect(values.every((value) => value === values[0])).toBe(true);
  expect(initialize).toHaveBeenCalledTimes(1);
});

it("retries a synchronous initialization failure", async () => {
  const initialize = vi.fn(() => {
    if (initialize.mock.calls.length === 1) throw new Error("sync setup");
    return Promise.resolve("pool");
  });
  const runtime = lazyRuntime(initialize);
  await expect(runtime()).rejects.toThrow("sync setup");
  expect(await runtime()).toBe("pool");
});

it("waits for pending initialization, closes once, and prevents reopening after shutdown", async () => {
  let ready: (value: string) => void = () => {
    throw new Error("Not started");
  };
  const runtime = processSingleton(
    Symbol("test.closing"),
    () =>
      new Promise<string>((resolve) => {
        ready = resolve;
      }),
  );
  const opening = runtime();
  await Promise.resolve();
  const dispose = vi.fn(async () => {});
  const closing = runtime.close(dispose);
  expect(runtime.close(dispose)).toBe(closing);
  await expect(runtime()).rejects.toThrow("closed");
  ready("pool");
  expect(await opening).toBe("pool");
  await closing;
  expect(dispose).toHaveBeenCalledExactlyOnceWith("pool");
  await expect(runtime()).rejects.toThrow("closed");
});

it("does not open a database just to close it", async () => {
  const initialize = vi.fn(async () => "pool");
  const runtime = lazyRuntime(initialize);
  await runtime.close(vi.fn());
  expect(initialize).not.toHaveBeenCalled();
  await expect(runtime()).rejects.toThrow("closed");
});

it("does not dispose an initialization failure and never opens a second pool after close fails", async () => {
  const failed = lazyRuntime(async () => {
    throw new Error("init");
  });
  const opening = failed();
  const dispose = vi.fn(async () => {});
  await expect(opening).rejects.toThrow("init");
  await failed.close(dispose);
  expect(dispose).not.toHaveBeenCalled();
  const runtime = lazyRuntime(async () => "pool");
  await runtime();
  await expect(
    runtime.close(async () => {
      throw new Error("close");
    }),
  ).rejects.toThrow("close");
  await expect(runtime()).rejects.toThrow("closed");
});
