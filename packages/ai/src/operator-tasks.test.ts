import { expect, it, vi } from "vitest";
import { AiRuntime } from "./runtime";
import { loadAiConfig } from "./config";
import {
  operatorAskTask,
  dsuReadTask,
  dsuPrefillTask,
  parseDocumentAmount,
  unambiguousPrefill,
} from "./operator-tasks";
import { normativeRetriever, citationFor } from "@avanti/core";
it("rejects invented citations and degrades to cited verbatim excerpts", async () => {
  const transport = vi.fn(async () => ({
    output: { answer: "Una regola inventata.", coverage: "full", citations: ["invented"] },
  }));
  const runtime = new AiRuntime(
    loadAiConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: "synthetic", AI_MAX_ATTEMPTS: "2" }),
    { transport },
  );
  const chunks = normativeRetriever
    .search("ISEE 2027 redditi 2025 patrimonio")
    .map(({ chunk }) => ({ ...citationFor(chunk), text: chunk.text }));
  const result = await runtime.runTask(operatorAskTask, {
    question: "Quale anno per redditi ISEE?",
    chunks,
  });
  expect(result.engine).toBe("heuristic");
  expect(result.output.coverage).toBe("partial");
  expect(result.output.citations.every((id) => chunks.some((c) => c.id === id))).toBe(true);
  expect(result.output.answer).not.toContain("inventata");
});
it("out-of-base questions never call the provider", async () => {
  const transport = vi.fn();
  const runtime = new AiRuntime(
    loadAiConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: "synthetic" }),
    { transport },
  );
  expect(
    (await runtime.runTask(operatorAskTask, { question: "Ricetta carbonara?", chunks: [] })).output
      .coverage,
  ).toBe("none");
  expect(transport).not.toHaveBeenCalled();
});
it("validates literal amounts, pages, slots and uncertainty", () => {
  expect(parseDocumentAmount("12.345,67 €")).toBe(12345.67);
  expect(parseDocumentAmount("1.000")).toBeNull();
  expect(parseDocumentAmount("zero")).toBeNull();
  const input = {
    bytes: new Uint8Array(),
    mime: "application/pdf" as const,
    documentId: "d",
    pages: 2,
    slots: [{ sectionId: "FC2", fieldId: "saldo", label: "Saldo", documentIds: ["d"] }],
  };
  const output = {
    fields: [
      {
        fieldId: "saldo",
        value: 12345.67,
        page: 2,
        confidence: 0.99,
        rawValue: "12.345,67",
        quote: "Saldo: 12.345,67 euro",
      },
    ],
  };
  expect(dsuReadTask.validate!(output, input)).toBe(true);
  expect(dsuReadTask.validate!({ fields: [{ ...output.fields[0]!, value: 900 }] }, input)).toBe(
    false,
  );
  expect(dsuReadTask.validate!({ fields: [{ ...output.fields[0]!, page: 3 }] }, input)).toBe(false);
  expect(
    dsuReadTask.validate!({ fields: [{ ...output.fields[0]!, confidence: 0.5 }] }, input),
  ).toBe(false);
});
it("keeps conflicts out of prefill and cannot fabricate a candidate", () => {
  const a = {
    sectionId: "FC2",
    fieldId: "saldo",
    label: "Saldo",
    value: 100,
    documentId: "d",
    page: 1,
    confidence: 0.99,
    note: null,
  };
  expect(unambiguousPrefill([a, { ...a, value: 200 }])).toEqual([]);
  expect(
    unambiguousPrefill([
      { ...a, fieldId: "saldo~one" },
      { ...a, fieldId: "saldo~two", value: 200 },
    ]),
  ).toEqual([]);
  expect(dsuPrefillTask.validate!({ fields: [{ ...a, value: 200 }] }, { candidates: [a] })).toBe(
    false,
  );
});
