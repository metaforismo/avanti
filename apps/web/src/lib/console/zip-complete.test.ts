import { describe, expect, it } from "vitest";
import { zipComplete } from "./zip-complete";

const end = [0x50, 0x4b, 0x05, 0x06, ...new Array<number>(18).fill(0)];

describe("zipComplete", () => {
  it("accepts an archive that ends with the end record", async () => {
    expect(await zipComplete(new Blob([new Uint8Array([1, 2, 3, ...end])]))).toBeNull();
    expect(await zipComplete(new Blob([new Uint8Array(end)]))).toBeNull();
  });

  it("refuses a download cut short or an empty body", async () => {
    const cut = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new Array<number>(40).fill(7)]);
    expect(await zipComplete(new Blob([cut]))).toMatch(/^Lo ZIP è arrivato incompleto/);
    expect(await zipComplete(new Blob([]))).toMatch(/incompleto/);
    // The end record somewhere else is not the end of the file.
    expect(await zipComplete(new Blob([new Uint8Array([...end, 9])]))).toMatch(/incompleto/);
  });
});
