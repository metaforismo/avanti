import { describe, expect, it } from "vitest";
import type { CaseListResponse } from "@avanti/contracts";
import {
  moveInCachedList,
  nextInQueue,
  queueApiPath,
  readQueueParams,
  uniqueById,
} from "./queue-params";

const read = (query: string) => readQueueParams(new URLSearchParams(query));

describe("readQueueParams", () => {
  it("keeps valid filters from a shared link", () => {
    expect(
      read(
        "stato=submitted&pratica=isee_ordinario&assegnatario=me&priorita=near_ready&ordina=attesa&cancellazioni=1&q=Rossi",
      ),
    ).toEqual({
      status: "submitted",
      practice: "isee_ordinario",
      assignee: "me",
      priority: "near_ready",
      longestWaiting: true,
      erasure: true,
      q: "Rossi",
    });
  });

  it("drops values the API would reject instead of breaking the queue", () => {
    expect(read("stato=foo&pratica=nope&assegnatario=xyz&priorita=zzz&cancellazioni=true")).toEqual(
      {
        status: "submitted",
        practice: "",
        assignee: "",
        priority: "",
        longestWaiting: false,
        erasure: false,
        q: "",
      },
    );
  });

  it("ignores inherited object keys", () => {
    const params = read("stato=__proto__&priorita=toString&pratica=constructor");
    expect(params.status).toBe("submitted");
    expect(params.priority).toBe("");
    expect(params.practice).toBe("");
  });

  it("sorts by waiting time only on the submitted tab", () => {
    expect(read("stato=closed&ordina=attesa").longestWaiting).toBe(false);
    expect(read("ordina=attesa").longestWaiting).toBe(true);
  });

  it("cuts an over-long search to what the API accepts", () => {
    expect(read(`q=${"a".repeat(150)}`).q).toHaveLength(100);
    expect(read("q=%25_%27").q).toBe("%_'");
  });
});

describe("uniqueById", () => {
  it("keeps the first copy, i.e. the refreshed first page", () => {
    const fresh = { id: "a", v: 2 };
    expect(uniqueById([fresh, { id: "b", v: 1 }, { id: "a", v: 1 }])).toEqual([
      fresh,
      { id: "b", v: 1 },
    ]);
  });
});

describe("queueApiPath", () => {
  it("asks the API for exactly what the queue shows, search trimmed", () => {
    expect(
      queueApiPath(read("stato=ready&pratica=isee_ordinario&assegnatario=none&q=%20Rossi%20")),
    ).toBe("/api/cases?status=ready&limit=50&practiceId=isee_ordinario&assignee=none&q=Rossi");
  });

  it("keeps the longest-waiting order of the submitted tab", () => {
    expect(queueApiPath(read("ordina=attesa&priorita=near_ready"))).toBe(
      "/api/cases?status=submitted&limit=50&ai=near_ready&sort=waiting",
    );
  });

  it("lists the erasure requests in every status, whatever else the address had", () => {
    expect(queueApiPath(read("cancellazioni=1&stato=ready&q=Rossi"))).toBe(
      "/api/cases?erasure=requested&limit=50",
    );
  });

  it("is the default queue when nothing was remembered", () => {
    expect(queueApiPath(read(""))).toBe("/api/cases?status=submitted&limit=50");
  });
});

describe("nextInQueue", () => {
  const list = ["a", "b", "c"].map((id) => ({ id }));

  it("opens the first case when the current one has left the list", () => {
    expect(nextInQueue(list, "x")).toEqual({ id: "a" });
  });

  it("skips forward from a case still in the list, never back to it", () => {
    expect(nextInQueue(list, "a")).toEqual({ id: "b" });
    expect(nextInQueue(list, "b")).toEqual({ id: "c" });
  });

  it("has nothing after the last case or in an empty queue", () => {
    expect(nextInQueue(list, "c")).toBeNull();
    expect(nextInQueue([], "a")).toBeNull();
    expect(nextInQueue([{ id: "a" }], "a")).toBeNull();
  });
});

describe("moveInCachedList", () => {
  const counts = {
    intake: 0,
    submitted: 2,
    in_review: 1,
    needs_citizen: 0,
    ready: 0,
    closed: 0,
  };
  const list = {
    items: [{ id: "a" }, { id: "b" }],
    nextCursor: null,
    counts,
    priorityCounts: { near_ready: 0 },
    waitingOverdue: 0,
  } as unknown as CaseListResponse;

  it("takes a finished case out of the list and moves its count", () => {
    const moved = moveInCachedList(list, "a", "submitted", "ready");
    expect(moved?.items.map((item) => item.id)).toEqual(["b"]);
    expect(moved?.counts).toMatchObject({ submitted: 1, ready: 1, in_review: 1 });
    // The cached original is replaced, not changed under a screen that still shows it.
    expect(list.items).toHaveLength(2);
  });

  it("leaves lists that don't show the case, and unchanged statuses, alone", () => {
    expect(moveInCachedList(list, "z", "submitted", "ready")).toBeNull();
    expect(moveInCachedList(list, "a", "submitted", "submitted")).toBeNull();
  });

  it("never counts below zero", () => {
    const moved = moveInCachedList(list, "a", "needs_citizen", "in_review");
    expect(moved?.counts.needs_citizen).toBe(0);
  });
});
