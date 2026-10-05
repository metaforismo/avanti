import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // PGlite boots PostgreSQL WASM; serial workers avoid competing startup heaps on small Macs.
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
