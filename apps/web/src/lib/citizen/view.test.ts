import { describe, expect, it } from "vitest";
import type { ChecklistItem, ConversationTurn } from "@avanti/contracts";
import { askedBefore, resolveView, splitRequest } from "./view";

describe("resolveView", () => {
  it("follows the server step when the citizen has not navigated", () => {
    expect(resolveView(null, { step: "interview" })).toBe("interview");
    expect(resolveView(null, { step: "submitted" })).toBe("submitted");
  });

  it("lets the citizen go back to earlier steps", () => {
    expect(resolveView("interview", { step: "documents" })).toBe("interview");
  });

  it("never lets a stale local view skip ahead of the server", () => {
    expect(resolveView("documents", { step: "interview" })).toBe("interview");
    expect(resolveView("review", { step: "interview" })).toBe("interview");
  });

  it("opens the review only once documents are reachable", () => {
    expect(resolveView("review", { step: "documents" })).toBe("review");
  });
});

const turn = (
  role: ConversationTurn["role"],
  kind: ConversationTurn["kind"],
  questionId: string | null,
  text = "x",
): ConversationTurn => ({
  id: crypto.randomUUID(),
  role,
  kind,
  questionId,
  text,
  createdAt: "2026-10-18T10:00:00.000Z",
});

describe("askedBefore", () => {
  const answered = [
    { questionId: "q1", question: "Hai un'auto?", answer: "No" },
    { questionId: "q2", question: "Quante persone?", answer: "4" },
  ] as Parameters<typeof askedBefore>[2];

  it("quotes the question above a tapped answer the previous turn does not ask", () => {
    const turns = [turn("assistant", "message", null), turn("citizen", "confirmation", "q1", "No")];
    expect(askedBefore(turns, 1, answered)).toBe("Hai un'auto?");
  });

  it("does not repeat the question the turn just above asks", () => {
    const turns = [turn("assistant", "question", "q2"), turn("citizen", "confirmation", "q2", "4")];
    expect(askedBefore(turns, 1, answered)).toBeNull();
  });

  it("leaves typed messages, assistant turns and unknown questions alone", () => {
    const turns = [
      turn("citizen", "message", "q1"),
      turn("assistant", "confirmation", "q1"),
      turn("citizen", "confirmation", "q9"),
      turn("citizen", "confirmation", null),
    ];
    expect(turns.map((_, i) => askedBefore(turns, i, answered))).toEqual([null, null, null, null]);
  });
});

describe("splitRequest", () => {
  const item = (id: string, title: string, memberName: string | null = null) =>
    ({ id, title, memberName }) as ChecklistItem;
  const checklist = [
    item("a", "Documento d'identità", "Maria"),
    item("b", "Documento d'identità", "Luca"),
    item("c", "Contratto d'affitto"),
  ];

  it("turns the trailing item lines into links, in order", () => {
    const { body, items } = splitRequest(
      "La foto è sfocata.\nContratto d'affitto\nDocumento d'identità · Luca",
      checklist,
    );
    expect(body).toBe("La foto è sfocata.");
    expect(items.map((i) => i.id)).toEqual(["c", "b"]);
  });

  it("keeps a message that names no item as it is", () => {
    expect(splitRequest("Passa allo sportello.\nGrazie", checklist)).toEqual({
      body: "Passa allo sportello.\nGrazie",
      items: [],
    });
  });

  it("does not take an item named in the middle of the message", () => {
    const { body, items } = splitRequest("Contratto d'affitto\nmanca la seconda pagina", checklist);
    expect(body).toBe("Contratto d'affitto\nmanca la seconda pagina");
    expect(items).toEqual([]);
  });

  it("handles a request made only of items", () => {
    expect(splitRequest("Contratto d'affitto", checklist)).toEqual({
      body: "",
      items: [checklist[2]],
    });
  });
});
