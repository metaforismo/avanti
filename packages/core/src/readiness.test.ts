import { describe, expect, it } from "vitest";
import type { ChecklistStatus, DocumentAnalysis, DocumentStatus } from "@avanti/contracts";
import { checklistStatus, documentCounts, itemReadiness } from "./readiness";

const analysis = { engine: "heuristic" } as DocumentAnalysis;
const item = (id: string, status: ChecklistStatus, required = true) => ({ id, status, required });
const doc = (checklistItemId: string | null, status: DocumentStatus) => ({
  checklistItemId,
  status,
  analysis: status === "analyzed" ? analysis : null,
});

describe("checklistStatus", () => {
  it("keeps the desk's decision over what was uploaded or found", () => {
    for (const decision of ["verified", "rejected", "waived"] as const)
      expect(checklistStatus(decision, { attached: false, blocked: true })).toBe(decision);
  });

  it("derives missing, uploaded and issue from files and blockers", () => {
    expect(checklistStatus("missing", { attached: false, blocked: true })).toBe("missing");
    expect(checklistStatus("missing", { attached: true, blocked: false })).toBe("uploaded");
    expect(checklistStatus("uploaded", { attached: true, blocked: true })).toBe("issue");
    // An item marked to look at goes back to uploaded once the blocking file is gone.
    expect(checklistStatus("issue", { attached: true, blocked: false })).toBe("uploaded");
    expect(checklistStatus("issue", { attached: false, blocked: false })).toBe("missing");
  });
});

describe("itemReadiness", () => {
  it("counts an upload still being read as checking, not ready and not missing", () => {
    expect(itemReadiness(item("a", "uploaded"), [doc("a", "processing")])).toBe("checking");
  });

  it("waits for every attached file: the back of a card can still show a problem", () => {
    expect(
      itemReadiness(item("a", "uploaded"), [doc("a", "analyzed"), doc("a", "processing")]),
    ).toBe("checking");
    expect(itemReadiness(item("a", "uploaded"), [doc("a", "analyzed"), doc("a", "analyzed")])).toBe(
      "ready",
    );
  });

  it("ignores files attached to other items", () => {
    expect(itemReadiness(item("a", "uploaded"), [doc("b", "analyzed")])).toBe("todo");
  });

  it("does not trust an analyzed file without its reading", () => {
    expect(
      itemReadiness(item("a", "uploaded"), [
        { checklistItemId: "a", status: "analyzed", analysis: null },
      ]),
    ).toBe("todo");
  });

  it("asks the citizen again for issues and redos even with files attached", () => {
    expect(itemReadiness(item("a", "issue"), [doc("a", "analyzed")])).toBe("todo");
    expect(itemReadiness(item("a", "rejected"), [doc("a", "analyzed")])).toBe("todo");
  });

  it("is ready when the desk verified or waived it, files or not", () => {
    expect(itemReadiness(item("a", "verified"), [])).toBe("ready");
    expect(itemReadiness(item("a", "waived"), [doc("a", "processing")])).toBe("ready");
  });
});

describe("documentCounts", () => {
  it("splits required items so the three counts always add up to the total", () => {
    const checklist = [
      item("ready", "uploaded"),
      item("checking", "uploaded"),
      item("missing", "missing"),
      item("issue", "issue"),
      item("waived", "waived"),
      item("optional", "missing", false),
    ];
    const documents = [
      doc("ready", "analyzed"),
      doc("checking", "processing"),
      doc("issue", "failed"),
      doc("optional", "processing"),
      doc(null, "analyzed"),
    ];
    expect(documentCounts(checklist, documents)).toEqual({
      required: 5,
      ready: 2,
      checking: 1,
      todo: 2,
    });
  });

  it("returns zeros for a checklist with nothing required", () => {
    expect(documentCounts([item("a", "missing", false)], [])).toEqual({
      required: 0,
      ready: 0,
      checking: 0,
      todo: 0,
    });
  });
});
