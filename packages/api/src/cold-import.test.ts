import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("serves the first health request without loading PDF, fontkit or the AI SDK", async () => {
  const { stdout } = await promisify(execFile)(process.execPath, [
    "--import",
    "tsx",
    fileURLToPath(new URL("./bench-api.ts", import.meta.url)),
    "--cold",
  ]);
  expect(JSON.parse(stdout)).toMatchObject({
    eagerModules: { pdf: false, fontkit: false, ai: false },
  });
});
