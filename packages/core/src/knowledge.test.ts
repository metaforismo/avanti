import { expect, it } from "vitest";
import { heuristicKnowledge, normativeRetriever, knowledgeChunks } from "./knowledge";

it.each([
  [
    "Come si considera il conto cointestato nella giacenza media?",
    "partial",
    /50%/,
    "isee-2027.md",
  ],
  ["Per ISEE 2027 quale anno di redditi e patrimonio?", "partial", /2025/, "isee-2027.md"],
  [
    "Lo studente fuori sede è autonomo per ISEE università?",
    "partial",
    /non prova/,
    "isee-universita.md",
  ],
  [
    "Assegno unico senza ISEE: posso fare domanda?",
    "partial",
    /facoltativo.*minimo/,
    "assegno-unico.md",
  ],
  [
    "Per il 730 devo avere il POS per tutte le spese sanitarie?",
    "partial",
    /eccezioni.*POS/,
    "modello-730.md",
  ],
  ["Con ISEE basso posso ottenere la NASPI?", "none", /non copre/, null],
] as const)(
  "answers honestly and readably without AI: %s",
  (question, coverage, expected, file) => {
    const found = normativeRetriever.search(question);
    const result = heuristicKnowledge(
      found.map((r) => r.chunk),
      question,
    );
    expect(result.coverage).toBe(coverage);
    expect(result.answer).toMatch(expected);
    expect(result.answer).not.toMatch(
      /\n|\||https?:|\[kb:|INPS, Portale|AdE, CU|legge 128\/2019|PR #|backend/,
    );
    expect(result.answer).toMatch(/[.!?]$/);
    const sentences = [
      ...new Intl.Segmenter("it", { granularity: "sentence" }).segment(result.answer),
    ];
    expect(sentences.length).toBeGreaterThanOrEqual(1);
    expect(sentences.length).toBeLessThanOrEqual(3);
    if (file) {
      expect(result.citations).toHaveLength(1);
      const cited = knowledgeChunks.find((c) => c.id === result.citations[0])!;
      expect(cited.file).toBe(file);
      if (question.includes("POS")) expect(cited.url).toContain("/spese-sanitarie");
      expect(cited.text.replace(/\s+/g, " ")).toContain(result.answer);
    } else expect(result.citations).toEqual([]);
  },
);

it("abstains on source inventories, tables, clipped text and weak lexical matches", () => {
  for (const text of [
    "INPS, Portale unico ISEE,\n\nAdE, CU 2026,\n\nlegge 128/2019, art. 7.",
    "| Redditi ISEE | 2025 |\n| --- | --- |",
    "La giacenza media annuale del conto cointestato è",
    "Fonti ufficiali: INPS, ISEE e istruzioni sul conto cointestato e giacenza media.",
    "Il conto corrente richiede una verifica della documentazione bancaria.",
  ]) {
    expect(
      heuristicKnowledge([{ id: "test", text }], "Conto cointestato e giacenza media").coverage,
    ).toBe("none");
  }
});

it("keeps practice filters and safety guidance available to all operators", () => {
  for (const practiceId of ["isee_ordinario", "isee_universitario"] as const) {
    const found = normativeRetriever.search("conto cointestato giacenza media", practiceId);
    expect(found.some((r) => r.chunk.text.includes("50%"))).toBe(true);
    expect(found.every((r) => r.chunk.practiceIds.includes(practiceId))).toBe(true);
  }
  expect(normativeRetriever.search("conto cointestato giacenza media", "modello_730")).toEqual([]);
  const safety = normativeRetriever.search("1522 violenza stalking", "modello_730");
  expect(safety[0]?.chunk.file).toBe("intake-safety-1522.md");
});

it("does not append bibliography to a complete safety-service explanation", () => {
  const question = "Il 1522 è disponibile per violenza e stalking?";
  const result = heuristicKnowledge(
    normativeRetriever.search(question).map((r) => r.chunk),
    question,
  );
  expect(result.coverage).toBe("partial");
  expect(result.answer).toContain("24 ore su 24");
  expect(result.answer).not.toMatch(/Riscontro|relazione trimestrale|Fonte ufficiale/);
});

it("abstains when only the practice name matches, without support for the requested requirement", () => {
  const question = "Quali requisiti di residenza servono per Assegno unico?";
  const found = normativeRetriever.search(question);
  expect(found.length).toBeGreaterThan(0);
  expect(
    heuristicKnowledge(
      found.map((r) => r.chunk),
      question,
    ).coverage,
  ).toBe("none");
});
