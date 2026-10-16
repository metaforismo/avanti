import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildKnowledge, KNOWLEDGE_POLICY } from "./build-knowledge.mjs";
import { knowledgeChunks } from "../src/knowledge-data.ts";

const approvedFiles = [
  "assegno-unico.md",
  "dsu-prospetto.md",
  "intake-safety-1522.md",
  "isee-2027.md",
  "isee-universita.md",
  "modello-730.md",
  "permesso-soggiorno.md",
];
const documents = Object.fromEntries(
  await Promise.all(
    approvedFiles.map(async (file) => [
      file,
      await readFile(new URL(`../../../docs/research/${file}`, import.meta.url), "utf8"),
    ]),
  ),
);

describe("reviewed operator knowledge boundary", () => {
  it("admits only the explicit files and editorial titles, and keeps the generated corpus current", () => {
    expect(Object.keys(KNOWLEDGE_POLICY).sort()).toEqual(approvedFiles);
    expect(buildKnowledge(documents)).toEqual(knowledgeChunks);
    expect([...new Set(knowledgeChunks.map((c) => c.file))].sort()).toEqual(approvedFiles);
    for (const chunk of knowledgeChunks) {
      expect(chunk.title).not.toMatch(
        /\b(?:PR|revision\w*|backend|frontend|pilot\w*|beta|implementativ\w*|market|competitor\w*|gtm|lingue)\b/i,
      );
      const policy = KNOWLEDGE_POLICY[chunk.file];
      expect(
        Object.values(policy.sections).some(
          (section) => chunk.title === (section ? `${policy.title} — ${section}` : policy.title),
        ),
      ).toBe(true);
      expect(chunk.sources.length).toBeGreaterThan(0);
      expect(chunk.text.length).toBeLessThanOrEqual(5000);
      expect(chunk.text).not.toMatch(
        /INPS, Portale unico ISEE,|AdE, CU 2026,|legge 128\/2019, art\. 7\./,
      );
    }
  });
  it("ignores unapproved files and sections even with authoritative links", () => {
    const decoy = "## Ricerca commerciale\n\nMARKET-ONLY [INPS](https://www.inps.it).";
    const input = {
      ...documents,
      "new-law.md": decoy,
      "market.md": decoy,
      "isee-2027.md": documents["isee-2027.md"] + "\n\n" + decoy,
    };
    expect(buildKnowledge(input)).toEqual(knowledgeChunks);
  });
  it("fails closed on missing approved sections or invalid provenance", () => {
    for (const replacement of [
      "## Unreviewed section\n[INPS](https://www.inps.it)",
      documents["isee-universita.md"].replaceAll(
        "https://www.lavoro.gov.it",
        "https://vendor.example",
      ),
      documents["isee-universita.md"].replace(/\[([^\]]+)\]\(https?:[^)]+\)/g, "$1"),
    ])
      expect(() => buildKnowledge({ ...documents, "isee-universita.md": replacement })).toThrow();
  });
});
