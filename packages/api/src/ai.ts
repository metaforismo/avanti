import type { ConverseInput, ConverseOutput } from "@avanti/ai";
import type { DocumentAnalysis, Language, PracticeId, Question } from "@avanti/contracts";
import { loadAiConfig, publicAiConfig, type AiConfig } from "@avanti/ai/config";
import type { AiRuntime, TaskResult, Task, TaskContext, Transport } from "@avanti/ai";
import { aiContext } from "./ai-context";
export { heuristicAnalysis } from "@avanti/ai/heuristics";
export type IntakeProposal = {
  intent?: import("@avanti/core").IntakeIntent;
  practiceId: PracticeId | null;
  confidence: number;
  answers: Record<string, import("@avanti/contracts").AnswerValue>;
  reply: string;
  engine: "ai" | "heuristic";
};
export interface Intelligence {
  runTask?<I, O>(task: Task<I, O>, input: I, context?: TaskContext): Promise<TaskResult<O>>;
  readonly configured?: boolean;
  readonly fallbackCount?: number;
  readonly configuration?: ReturnType<typeof publicAiConfig>;
  assistant?(
    input: import("@avanti/ai").AssistantInput,
  ): Promise<import("@avanti/ai").AssistantOutput & { engine: "ai" | "heuristic" }>;
  transcribe?(input: {
    bytes: Uint8Array;
    mime: string;
    language: Language;
  }): Promise<{ text: string; language: Language; engine: "ai" | "heuristic" }>;
  intake(
    text: string,
    language: Language,
    practiceId: PracticeId | null,
    questions: Question[],
    now: Date,
  ): Promise<IntakeProposal>;
  converse?(input: ConverseInput): Promise<ConverseOutput & { engine: "ai" | "heuristic" }>;
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
  private speechRuntimes = new Map<string, AiRuntime>();
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
  async assistant(input: import("@avanti/ai").AssistantInput) {
    const [runtime, { citizenAssistantTask, safeAssistantOutput }] = await Promise.all([
      this.getRuntime(),
      import("@avanti/ai"),
    ]);
    const result = this.observe(
      "assistant",
      await runtime.runTask(citizenAssistantTask, input, aiContext.getStore()),
    );
    const safe = safeAssistantOutput(result.output, input);
    return { ...safe, engine: safe === result.output ? result.engine : ("heuristic" as const) };
  }
  async transcribe(input: { bytes: Uint8Array; mime: string; language: Language }) {
    const [{ AiRuntime }, { speechTask }] = await Promise.all([
      import("@avanti/ai/runtime"),
      import("@avanti/ai"),
    ]);
    // Audio has its own reserve chain; text/vision fallbacks cannot ingest a recording.
    const run = (model: string) => {
      let runtime = this.speechRuntimes.get(model);
      if (!runtime) {
        runtime = new AiRuntime(
          {
            ...this.config,
            models: { ...this.config.models, audio: model },
            fallbacks: [],
            maxAttempts: 1,
          },
          { transport: this.options.transport },
        );
        this.speechRuntimes.set(model, runtime);
      }
      return runtime.runTask(speechTask, input, aiContext.getStore());
    };
    let result = await run(this.config.models.audio);
    if (result.engine !== "ai" && this.config.models.audio !== "qwen/qwen3.8-omni-flash")
      result = await run("qwen/qwen3.8-omni-flash");
    this.observe("transcribe", result);
    return { text: result.output.text, language: input.language, engine: result.engine };
  }

  async runTask<I, O>(task: Task<I, O>, input: I, context?: TaskContext): Promise<TaskResult<O>> {
    return this.observe(
      task.id,
      await (await this.getRuntime()).runTask(task, input, context ?? aiContext.getStore()),
    );
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
  async converse(input: ConverseInput): Promise<ConverseOutput & { engine: "ai" | "heuristic" }> {
    const [runtime, { converseTask }] = await Promise.all([
      this.getRuntime(),
      import("@avanti/ai/tasks"),
    ]);
    const result = this.observe(
      "converse",
      await runtime.runTask(converseTask, input, aiContext.getStore()),
    );
    return { ...result.output, engine: result.engine };
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
