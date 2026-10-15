import type { DocumentAnalysis, Language, PracticeId, Question } from "@avanti/contracts";
import { loadAiConfig, publicAiConfig, type AiConfig } from "@avanti/ai/config";
import type { AiRuntime, TaskResult, Transport } from "@avanti/ai";
import { aiContext } from "./ai-context";
export { heuristicAnalysis } from "@avanti/ai/heuristics";
export type IntakeProposal = {
  practiceId: PracticeId | null;
  confidence: number;
  answers: Record<string, import("@avanti/contracts").AnswerValue>;
  reply: string;
  engine: "ai" | "heuristic";
};
export interface Intelligence {
  readonly configured?: boolean;
  readonly fallbackCount?: number;
  readonly configuration?: ReturnType<typeof publicAiConfig>;
  intake(
    text: string,
    language: Language,
    practiceId: PracticeId | null,
    questions: Question[],
    now: Date,
  ): Promise<IntakeProposal>;
  analyze(
    bytes: Uint8Array,
    mime: string,
    fileName: string,
    requirements: string[],
  ): Promise<DocumentAnalysis>;
  translate(
    text: string,
    language: Language,
  ): Promise<{ text: string; engine?: "ai" | "heuristic" }>;
}
export type AiFallbackRecord = {
  op: string;
  errorName: string;
  statusCode: number | null;
  model: string;
};
export class AiIntelligence implements Intelligence {
  fallbackCount = 0;
  private runtime?: Promise<AiRuntime>;
  private config: AiConfig;
  readonly configuration: ReturnType<typeof publicAiConfig>;
  get configured() {
    return this.configuration.keyPresent && this.configuration.provider !== "none";
  }
  constructor(
    private options: {
      config?: AiConfig;
      transport?: Transport;
      key?: string;
      textModel?: string;
      visionModel?: string;
      provider?: string;
      logger?: (record: AiFallbackRecord) => void;
    } = {},
  ) {
    const config =
      options.config ??
      loadAiConfig({
        AI_GATEWAY_API_KEY: options.key,
        AI_MODEL_TEXT: options.textModel,
        AI_MODEL_VISION: options.visionModel,
        AI_GATEWAY_PROVIDER: options.provider,
      });
    this.config = config;
    this.configuration = publicAiConfig(config);
  }
  private getRuntime() {
    return (this.runtime ??= import("@avanti/ai/runtime").then(
      ({ AiRuntime }) => new AiRuntime(this.config, { transport: this.options.transport }),
    ));
  }
  private observe<O>(op: string, result: TaskResult<O>) {
    if (result.engine === "heuristic" && this.configured) {
      this.fallbackCount++;
      this.options.logger?.({
        op,
        errorName: result.fallbackReason ?? "Error",
        statusCode: result.fallbackReason === "rate_limit" ? 429 : null,
        model: result.model ?? this.configuration.models[op === "analyze" ? "vision" : "fast"],
      });
    }
    return result;
  }
  async intake(
    text: string,
    language: Language,
    practiceId: PracticeId | null,
    questions: Question[],
    now: Date,
  ): Promise<IntakeProposal> {
    const [runtime, { intakeTask }] = await Promise.all([
      this.getRuntime(),
      import("@avanti/ai/tasks"),
    ]);
    const result = this.observe(
      "intake",
      await runtime.runTask(
        intakeTask,
        { text, language, practiceId, questions, now },
        aiContext.getStore(),
      ),
    );
    const { manipulation: _manipulation, ...output } = result.output;
    return { ...output, engine: result.engine };
  }
  async analyze(
    bytes: Uint8Array,
    mime: string,
    fileName: string,
    requirements: string[],
  ): Promise<DocumentAnalysis> {
    // Upload validation already restricts MIME; unsupported legacy types fail closed locally.
    const [runtime, { documentTask }] = await Promise.all([
      this.getRuntime(),
      import("@avanti/ai/tasks"),
    ]);
    const parsedMime = documentTask.input.safeParse({ bytes, mime, fileName, requirements });
    if (!parsedMime.success) {
      const { heuristicAnalysis } = await import("@avanti/ai/heuristics");
      return heuristicAnalysis(fileName, requirements);
    }
    const result = this.observe(
      "analyze",
      await runtime.runTask(documentTask, parsedMime.data, aiContext.getStore()),
    );
    const { pages: _pages, manipulation: _manipulation, findings, ...output } = result.output;
    return {
      ...output,
      engine: result.engine,
      findings: findings.map((message, index) => ({
        id: `ai-observation-${index}`,
        code: "document.observation",
        severity: "info",
        checklistItemId: null,
        documentId: null,
        memberId: null,
        message,
      })),
    };
  }
  async translate(
    text: string,
    language: Language,
  ): Promise<{ text: string; engine?: "ai" | "heuristic" }> {
    if (language === "it") return { text };
    const [runtime, { translateTask }] = await Promise.all([
      this.getRuntime(),
      import("@avanti/ai/tasks"),
    ]);
    const result = this.observe(
      "translate",
      await runtime.runTask(translateTask, { text, language }, aiContext.getStore()),
    );
    return { ...result.output, engine: result.engine };
  }
}
// Source compatibility for existing callers; all implementation lives in the provider-neutral adapter.
export { AiIntelligence as GatewayIntelligence };
