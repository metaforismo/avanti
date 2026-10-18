import { describe, expect, it } from "vitest";
import type { ConversationTurn } from "@avanti/contracts";
import { askedBefore, resolveView } from "./view";

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
