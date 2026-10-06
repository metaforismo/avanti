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
