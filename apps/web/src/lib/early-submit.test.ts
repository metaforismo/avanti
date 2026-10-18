import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  EARLY_SUBMIT_SCRIPT,
  EARLY_SUBMIT_SCRIPT_HASH,
  PENDING_KEY,
  READY_KEY,
} from "./early-submit";

type Listener = (event: FakeEvent) => void;
type FakeEvent = {
  target: unknown;
  submitter: unknown;
  defaultPrevented: boolean;
  preventDefault(): void;
};

/** Runs the inline script against a fake window and returns its submit listener. */
function install() {
  const added: { type: string; listener: Listener; capture: unknown }[] = [];
  new Function("addEventListener", EARLY_SUBMIT_SCRIPT)(
    (type: string, listener: Listener, capture: unknown) => added.push({ type, listener, capture }),
  );
  expect(added).toHaveLength(1);
  expect(added[0]).toMatchObject({ type: "submit", capture: true });
  return added[0]!.listener;
}

function submit(listener: Listener, target: unknown, submitter: unknown = null) {
  const event: FakeEvent = {
    target,
    submitter,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
  listener(event);
  return event;
}

const form = (marked: boolean) =>
  ({ hasAttribute: (name: string) => marked && name === "data-early-submit" }) as Record<
    string,
    unknown
  >;

describe("early submit script", () => {
  it("holds a marked form submitted before hydration, with the button pressed", () => {
    const listener = install();
    const target = form(true);
    const button = {};
    expect(submit(listener, target, button).defaultPrevented).toBe(true);
    expect(target[PENDING_KEY]).toBe(button);
  });

  it("records an Enter press as a submission without a button", () => {
    const listener = install();
    const target = form(true);
    expect(submit(listener, target, undefined).defaultPrevented).toBe(true);
    expect(PENDING_KEY in target).toBe(true);
    expect(target[PENDING_KEY]).toBeNull();
  });

  it("leaves the submission to React once the form is ready", () => {
    const listener = install();
    const target = form(true);
    target[READY_KEY] = true;
    expect(submit(listener, target).defaultPrevented).toBe(false);
    expect(PENDING_KEY in target).toBe(false);
  });

  it("ignores forms it was not asked to hold and targets that are not elements", () => {
    const listener = install();
    const plain = form(false);
    expect(submit(listener, plain).defaultPrevented).toBe(false);
    expect(PENDING_KEY in plain).toBe(false);
    expect(submit(listener, null).defaultPrevented).toBe(false);
    expect(submit(listener, {}).defaultPrevented).toBe(false);
  });
});

describe("early submit script hash", () => {
  it("is the CSP source of the script exactly as inlined", () => {
    const digest = createHash("sha256").update(EARLY_SUBMIT_SCRIPT).digest("base64");
    expect(EARLY_SUBMIT_SCRIPT_HASH).toBe(`'sha256-${digest}'`);
  });
});
