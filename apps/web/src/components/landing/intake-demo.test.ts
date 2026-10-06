import { DEMO_STORIES } from "@avanti/core/demo-stories";
import { describe, expect, it } from "vitest";
import { SAMPLES, sampleText } from "./intake-demo-samples";

describe("homepage intake demo", () => {
  it("shows exactly the stories the extraction is tested on", () => {
    expect(Object.fromEntries(SAMPLES.map((sample) => [sample.lang, sampleText(sample)]))).toEqual(
      DEMO_STORIES,
    );
  });
});
