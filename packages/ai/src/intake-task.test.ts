import { expect, it, vi } from "vitest";
import { AiRuntime } from "./runtime";
import { loadAiConfig } from "./config";
import { intakeTask, IntakeOutput } from "./tasks";
const now = new Date("2027-01-15T12:00:00Z");
const input = { text: "ISEE", language: "it" as const, practiceId: null, questions: [], now };

it("requires intent and rejects AI classifications that hide locally visible danger", async () => {
  const output = {
    practiceId: "isee_ordinario",
    confidence: 1,
    answers: {},
    reply: "Ricevuto.",
    manipulation: false,
  };
  expect(IntakeOutput.safeParse(output).success).toBe(false);
  const transport = vi.fn(async () => ({ output: { ...output, intent: "need" } }));
  const result = await new AiRuntime(
    loadAiConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: "synthetic", AI_MAX_ATTEMPTS: "1" }),
    { transport },
  ).runTask(intakeTask, { ...input, text: "Mio marito mi picchia, ISEE" });
  expect(result.engine).toBe("heuristic");
  expect(result.output).toMatchObject({
    intent: "emergency",
    practiceId: null,
    answers: {},
    reply: "",
  });
});
it.each(["off_topic", "manipulation", "emergency"] as const)(
  "rejects practice facts attached to %s",
  (intent) => {
    expect(
      intakeTask.validate!(
        {
          intent,
          practiceId: "isee_ordinario",
          confidence: 1,
          answers: { household_count: 2 },
          reply: "",
          manipulation: false,
        },
        input,
      ),
    ).toBe(false);
  },
);
it("permits a harmless request for instructions and does not mistake family roles for violence", async () => {
  const runtime = new AiRuntime(loadAiConfig());
  const result = await runtime.runTask(intakeTask, {
    ...input,
    text: "Mio marito mi aiuta: vorrei istruzioni per ISEE",
  });
  expect(result.output.intent).toBe("need");
  expect(result.output.practiceId).toBe("isee_ordinario");
});
