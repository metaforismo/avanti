import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  firstSteps,
  markFirstStep,
  queueIsIdle,
  readMarks,
  showFirstSteps,
  subscribeMarks,
  type SetupFacts,
} from "./first-steps";

const base: SetupFacts = {
  admin: true,
  offices: [{ openingHours: null }],
  mfaEnabled: false,
  counts: {},
  operators: [{ active: true }],
  baselineSet: false,
  marked: new Set(),
};

const allDone: SetupFacts = {
  ...base,
  offices: [{ openingHours: "lun–ven 9–13" }],
  counts: { intake: 1 },
  operators: [{ active: true }, { active: true }],
  baselineSet: true,
  mfaEnabled: true,
  marked: new Set(["poster"]),
};

describe("firstSteps", () => {
  it("puts the trial case last: once sent, it takes the panel's place in the queue", () => {
    expect(firstSteps(base).steps.map((s) => s.key)).toEqual([
      "office",
      "poster",
      "colleagues",
      "baseline",
      "mfa",
      "trial",
    ]);
    expect(firstSteps({ ...base, admin: false }).steps.map((s) => s.key)).toEqual([
      "guide",
      "poster",
      "mfa",
      "trial",
    ]);
  });

  it("ticks off what the console can see and what this browser remembers", () => {
    const result = firstSteps(allDone);
    expect(result.steps.every((s) => s.done)).toBe(true);
    expect(result).toMatchObject({ done: 6, total: 6, known: true, next: undefined });
  });

  it("offers the first step still to do as the next one", () => {
    expect(firstSteps({ ...allDone, baselineSet: false }).next).toBe("baseline");
  });

  it("wants opening hours on every office, and at least one office", () => {
    const offices = [{ openingHours: "9–13" }, { openingHours: "" }];
    expect(firstSteps({ ...base, offices }).steps[0]!.done).toBe(false);
    expect(firstSteps({ ...base, offices: [] }).steps[0]!.done).toBe(false);
  });

  it("does not count the administrator alone, or deactivated accounts, as colleagues", () => {
    const colleagues = (operators: SetupFacts["operators"]) =>
      firstSteps({ ...base, operators }).steps.find((s) => s.key === "colleagues")!.done;
    expect(colleagues([{ active: true }])).toBe(false);
    expect(colleagues([{ active: true }, { active: false }])).toBe(false);
    expect(colleagues([{ active: true }, { active: true }])).toBe(true);
  });

  it("neither ticks nor highlights a step whose data is still loading", () => {
    const loading = firstSteps({ ...base, operators: undefined });
    expect(loading.steps.find((s) => s.key === "colleagues")!.done).toBeUndefined();
    expect(loading).toMatchObject({ known: false, next: undefined });
    // Operators never load the admin lists: their steps are always known.
    expect(firstSteps({ ...base, admin: false, operators: undefined }).known).toBe(true);
  });

  it("shows a failed load as still to do instead of hiding the progress for good", () => {
    const failed = firstSteps({ ...base, operators: null, baselineSet: null });
    expect(failed.known).toBe(true);
    expect(failed.steps.find((s) => s.key === "colleagues")!.done).toBe(false);
    expect(failed.steps.find((s) => s.key === "baseline")!.done).toBe(false);
  });
});

describe("showFirstSteps", () => {
  const unfinished = firstSteps(base);
  const finished = firstSteps(allDone);

  it("is offered only while nothing waits for the CAF", () => {
    expect(queueIsIdle(undefined)).toBe(false);
    expect(queueIsIdle({ intake: 3, closed: 2 })).toBe(true);
    expect(queueIsIdle({ submitted: 1 })).toBe(false);
    expect(queueIsIdle({ ready: 1 })).toBe(false);
  });

  it("lasts while only cases being filled in exist", () => {
    expect(showFirstSteps({ intake: 2 }, finished)).toBe(true);
  });

  it("gives way to an open dossier, trial or real", () => {
    expect(showFirstSteps({ submitted: 1 }, unfinished)).toBe(false);
    expect(showFirstSteps({ needs_citizen: 1 }, unfinished)).toBe(false);
  });

  it("is not ended by an archived trial case while the setup is unfinished", () => {
    expect(showFirstSteps({ closed: 1 }, unfinished)).toBe(true);
  });

  it("ends once the setup is complete and a dossier has been through the queue", () => {
    expect(showFirstSteps({ closed: 1 }, finished)).toBe(false);
  });

  it("waits for the facts before coming back over archived cases", () => {
    expect(showFirstSteps({ closed: 1 }, firstSteps({ ...base, operators: undefined }))).toBe(
      false,
    );
  });
});

describe("marks kept in this browser", () => {
  let store: Map<string, string>;
  let win: EventTarget;

  beforeEach(() => {
    store = new Map();
    win = new EventTarget();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    });
    vi.stubGlobal("window", win);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps each operator's marks apart", () => {
    markFirstStep("op-1", "poster");
    expect([...readMarks("op-1")]).toEqual(["poster"]);
    expect(readMarks("op-2").size).toBe(0);
  });

  it("starts over from a damaged or foreign value without throwing", () => {
    for (const raw of ["{not json", "[1,2]", '"text"', '{"op-1":"poster"}', "null"]) {
      store.set("avanti:first-steps", raw);
      expect(readMarks("op-1").size).toBe(0);
    }
    store.set("avanti:first-steps", JSON.stringify({ "op-1": ["poster", "anything", 3] }));
    expect([...readMarks("op-1")]).toEqual(["poster"]);
  });

  it("follows a mark made in another tab", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMarks(listener);
    store.set("avanti:first-steps", JSON.stringify({ "op-1": ["guide"] }));
    win.dispatchEvent(new Event("storage"));
    expect(listener).toHaveBeenCalledOnce();
    expect([...readMarks("op-1")]).toEqual(["guide"]);
    unsubscribe();
  });

  it("returns the same snapshot until something changes, as React requires", () => {
    markFirstStep("op-1", "guide");
    expect(readMarks("op-1")).toBe(readMarks("op-1"));
  });

  it("keeps the mark for this page when storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    markFirstStep("op-9", "poster");
    expect([...readMarks("op-9")]).toEqual(["poster"]);
  });
});
