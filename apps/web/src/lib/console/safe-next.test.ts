import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it.each([
    ["/console", "/console"],
    ["/console/pratiche/abc", "/console/pratiche/abc"],
    ["/console?stato=ready", "/console?stato=ready"],
  ])("keeps console path %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    null,
    "",
    "https://evil.example/console",
    "//evil.example",
    "/consolex",
    "/console\\..\\x",
    "/pratica/x",
  ])("falls back to /console for %s", (input) => {
    expect(safeNext(input)).toBe("/console");
  });
});
