import { expect, it, vi } from "vitest";
import { lazyRuntime } from "./runtime";
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
