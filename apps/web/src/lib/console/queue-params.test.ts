import { describe, expect, it } from "vitest";
import { readQueueParams, uniqueById } from "./queue-params";

const read = (query: string) => readQueueParams(new URLSearchParams(query));

describe("readQueueParams", () => {
  it("keeps valid filters from a shared link", () => {
    expect(
      read(
        "stato=submitted&pratica=isee_ordinario&assegnatario=me&priorita=near_ready&ordina=attesa&q=Rossi",
      ),
    ).toEqual({
      status: "submitted",
      practice: "isee_ordinario",
      assignee: "me",
      priority: "near_ready",
      longestWaiting: true,
      q: "Rossi",
    });
  });

  it("drops values the API would reject instead of breaking the queue", () => {
    expect(read("stato=foo&pratica=nope&assegnatario=xyz&priorita=zzz")).toEqual({
      status: "submitted",
      practice: "",
      assignee: "",
      priority: "",
      longestWaiting: false,
      q: "",
    });
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
