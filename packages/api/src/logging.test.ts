import { expect, it } from "vitest";
import { safeError } from "./logging";
it("12: keeps stack frames and error code without messages or database values", () => {
  const error = Object.assign(new Error("CF-secret@example.test"), {
    code: "23505",
    detail: "private document",
  });
  error.stack = "Error: CF-secret@example.test\n    at save (/app/dossier.ts:12:3)";
  const record = safeError(error);
  expect(record).toEqual({
    name: "Error",
    code: "23505",
    stack: "    at save (/app/dossier.ts:12:3)",
  });
  expect(JSON.stringify(record)).not.toContain("secret");
});
it("12: multiline database errors cannot masquerade as stack frames", () => {
  const error = new Error("private\n    at private-email@example.test (/fake/file.ts:1:1)");
  expect(safeError(error).stack).not.toContain("private-email");
});
