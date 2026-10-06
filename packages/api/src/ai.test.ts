import { describe, it, expect, vi, beforeEach } from "vitest";
import { GatewayIntelligence, heuristicAnalysis } from "./ai";
vi.mock("ai", async () => {
  const original = await vi.importActual<typeof import("ai")>("ai");
  return { ...original, generateText: vi.fn() };
});
import { generateText } from "ai";
beforeEach(() => {
  vi.mocked(generateText).mockReset();
});
describe("AI boundary", () => {
  it("does not contact a provider without credentials", async () => {
    const ai = new GatewayIntelligence();
    const result = await ai.intake(
      "Devo fare ISEE, non ho macchina",
      "it",
      null,
      [],
      new Date("2027-01-01Z"),
    );
    expect(result.engine).toBe("heuristic");
    expect(generateText).not.toHaveBeenCalled();
    expect((await ai.analyze(new Uint8Array(), "image/png", "foto.png", ["identity"])).engine).toBe(
      "heuristic",
    );
    expect((await ai.translate("Porta la giacenza media", "ar")).text).not.toBe(
      "Porta la giacenza media",
    );
    expect(generateText).not.toHaveBeenCalled();
  });
  it("falls back on provider failures without propagating model contents", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("secret-provider-details"));
    const ai = new GatewayIntelligence({ key: "test-key" });
    expect((await ai.intake("ISEE", "it", null, [], new Date("2027-01-01Z"))).engine).toBe(
      "heuristic",
    );
    expect(
      (await ai.analyze(new Uint8Array(), "image/png", "identity.png", ["identity"])).engine,
    ).toBe("heuristic");
    expect((await ai.translate("Porta i documenti", "bn")).engine).toBe("heuristic");
    expect(generateText).toHaveBeenCalledTimes(3);
    for (const [options] of vi.mocked(generateText).mock.calls) {
      expect(options.providerOptions).toEqual({ gateway: { only: ["anthropic"] } });
    }
    for (const result of vi.mocked(generateText).mock.results) {
      expect(result.type).toBe("return");
      await expect(result.value).rejects.toThrow("secret-provider-details");
    }
  });
  it("rejects unknown vision requirements and malformed intake proposals", async () => {
    vi.mocked(generateText).mockResolvedValue({
      output: {
        engine: "ai",
        detectedRequirementId: "invented",
        detectedLabel: null,
        confidence: 1,
        ownerName: null,
        referenceYear: null,
        expiresOn: null,
        legible: true,
        pagesComplete: true,
      },
    } as Awaited<ReturnType<typeof generateText>>);
    const ai = new GatewayIntelligence({ key: "test-key" });
    expect(
      (await ai.analyze(new Uint8Array(), "image/png", "unknown.png", ["identity"])).engine,
    ).toBe("heuristic");
    vi.mocked(generateText).mockResolvedValue({
      output: { practiceId: "invented", confidence: 1, answers: {}, reply: "" },
    } as Awaited<ReturnType<typeof generateText>>);
    expect((await ai.intake("ISEE", "it", null, [], new Date("2027-01-01Z"))).engine).toBe(
      "heuristic",
    );
  });
  it("uses tax year of CU and 730 rather than nominal form year", () => {
    expect(heuristicAnalysis("CU 2026.pdf", ["income"]).referenceYear).toBe(2025);
    expect(heuristicAnalysis("730 2027.pdf", ["income"]).referenceYear).toBe(2026);
    expect(heuristicAnalysis("saldo 2025.pdf", ["account_balance"]).referenceYear).toBe(2025);
  });
});

describe("second review AI regressions", () => {
  it("7: Italian operator messages do not claim a translation engine", async () => {
    expect(
      (await new GatewayIntelligence().translate("Porta i documenti", "it")).engine,
    ).toBeUndefined();
  });
  it("13: HEIC never reaches vision even with credentials", async () => {
    const result = await new GatewayIntelligence({ key: "test-key" }).analyze(
      new Uint8Array(),
      "image/heic",
      "foto.heic",
      ["identity"],
    );
    expect(generateText).not.toHaveBeenCalled();
    expect(result.engine).toBe("heuristic");
  });
  it("20: filename heuristics cannot assert legibility", () => {
    expect(heuristicAnalysis("identity.pdf", ["identity"]).legible).toBe(false);
  });
});
it("13: provider fallback emits only safe telemetry and increments its counter", async () => {
  const logger = vi.fn();
  vi.mocked(generateText).mockRejectedValue(
    Object.assign(new Error("private-message"), { statusCode: 503 }),
  );
  const ai = new GatewayIntelligence({ key: "test-key", logger });
  await ai.intake("private-citizen-text", "it", null, [], new Date("2027-01-01Z"));
  expect(ai.fallbackCount).toBe(1);
  expect(logger).toHaveBeenCalledWith({
    op: "intake",
    errorName: "Error",
    statusCode: 503,
    model: "anthropic/claude-sonnet-5.5",
  });
  expect(JSON.stringify(logger.mock.calls)).not.toContain("private");
});

it("applies the citizen register and vocabulary to translation and intake instructions", async () => {
  vi.mocked(generateText).mockRejectedValue(new Error("unavailable"));
  const ai = new GatewayIntelligence({ key: "test-key", logger: vi.fn() });
  await ai.translate("Porta i documenti allo sportello", "fr");
  await ai.intake("ISEE", "uk", null, [], new Date("2027-01-01Z"));
  const [translation, intake] = vi
    .mocked(generateText)
    .mock.calls.map(([options]) => options.instructions);
  expect(translation).toContain("Address the citizen using vous");
  expect(translation).toContain('"desk":"guichet"');
  expect(intake).toContain("Address the citizen using Ви");
  expect(intake).toContain("Capitalize all Ukrainian courtesy pronouns");
  expect(translation).toContain("Do not add facts, deadlines, requirements or promises");
});
