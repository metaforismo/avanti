import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");
const AREAS = ["app/(site)", "components/landing", "components/brand", "app/not-found.tsx"];
// What the citizen types, tested against the backend as typed: not site copy.
const EXEMPT = ["intake-demo-samples.ts"];

function filesIn(path: string): string[] {
  const full = join(ROOT, path);
  if (!statSync(full).isDirectory()) return [path];
  return readdirSync(full).flatMap((name) => filesIn(join(path, name)));
}

/** Comments explain code, they are not copy shown on the page: blanked out, lines kept. */
const withoutComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/^\s*\/\/.*$/gm, "");

describe("site copy", () => {
  const files = AREAS.flatMap(filesIn).filter(
    (file) =>
      /\.tsx?$/.test(file) && !/\.test\./.test(file) && !EXEMPT.some((e) => file.endsWith(e)),
  );

  it("finds the files to check", () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it("writes the apostrophe between two letters as ’, never as ' or &apos;", () => {
    const found = files.flatMap((file) =>
      withoutComments(readFileSync(join(ROOT, file), "utf8"))
        .split("\n")
        .map((line, i) => ({ file, line: i + 1, text: line }))
        .filter(({ text }) => /\p{L}'\p{L}|&apos;/u.test(text))
        .map(({ file, line }) => `${file}:${line}`),
    );
    expect(found).toEqual([]);
  });
});
