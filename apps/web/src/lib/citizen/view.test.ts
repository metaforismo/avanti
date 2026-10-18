import { describe, expect, it } from "vitest";
import type { ChecklistItem, ConversationTurn } from "@avanti/contracts";
import { MESSAGES } from "./messages";
import {
  askedBefore,
  justAsked,
  OPEN_FLOOR,
  remainingText,
  resolveView,
  splitRequest,
} from "./view";

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
  const item = (id: string, status: ChecklistItem["status"]) =>
    ({ id, title: "Documento d'identità", memberName: "Ana", status }) as ChecklistItem;

  it("links a line two relatives share to the card the office rejected", () => {
    const checklist = [item("verified", "verified"), item("rejected", "rejected")];
    const { body, items } = splitRequest("Rifalla.\nDocumento d'identità · Ana", checklist);
    expect(body).toBe("Rifalla.");
    expect(items.map((i) => i.id)).toEqual(["rejected"]);
  });
});

describe("justAsked", () => {
  it("is true only when the assistant's last bubble asks this very question", () => {
    expect(justAsked([turn("assistant", "question", "q1")], "q1")).toBe(true);
    expect(justAsked([turn("assistant", "question", "q1")], "q2")).toBe(false);
    // A tapped answer comes after: the next question was not asked in the chat.
    expect(
      justAsked([turn("assistant", "question", "q1"), turn("citizen", "confirmation", "q1")], "q1"),
    ).toBe(false);
    expect(justAsked([turn("assistant", "message", null)], "q1")).toBe(false);
    expect(justAsked([], "q1")).toBe(false);
  });
});

describe("remainingText", () => {
  const m = MESSAGES.it;
  it("says where the citizen is while the floor is high and vague", () => {
    const high = { min: OPEN_FLOOR + 1, max: OPEN_FLOOR + 1, atLeast: true };
    expect(remainingText(high, "it", m, "Nucleo familiare")).toBe("Ora: Nucleo familiare");
    expect(remainingText(high, "it", m)).toBe("Solo le domande che servono, passo dopo passo");
  });

  it("counts again once the floor is small, the range tight or the count exact", () => {
    expect(
      remainingText({ min: OPEN_FLOOR, max: OPEN_FLOOR, atLeast: true }, "it", m, "Casa"),
    ).toBe(`Ancora almeno ${OPEN_FLOOR} domande`);
    expect(remainingText({ min: 3, max: 5 }, "it", m)).toBe("Ancora 3–5 domande");
    expect(remainingText({ min: 1, max: 1 }, "it", m)).toBe("Ultima domanda");
    expect(remainingText(null, "it", m)).toBeNull();
  });
});
