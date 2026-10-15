import { z } from "zod";
import { randomUUID } from "node:crypto";
import { CircuitBreaker } from "./circuit";
import type { AiConfig } from "./config";
import { delimit, manipulationCount, outputViolations, languageViolation } from "./guard";
import { createTransport } from "./providers";
import type { FallbackReason, Task, TaskContext, TaskResult, Transport } from "./types";

class TaskFailure extends Error {
  constructor(
    readonly reason: FallbackReason,
    readonly retryable = false,
  ) {
    super(reason);
  }
}
function failure(error: unknown): TaskFailure {
  if (error instanceof TaskFailure) return error;
  const e = error as { statusCode?: number; name?: string } | null;
  if (e?.statusCode === 429) return new TaskFailure("rate_limit", true);
  if (e?.statusCode && e.statusCode >= 500) return new TaskFailure("provider_error", true);
  if (/Timeout|Abort/.test(e?.name ?? "")) return new TaskFailure("timeout", true);
  if (
    /NoObjectGenerated|NoOutputGenerated/.test(e?.name ?? "") &&
    !(error as { text?: string }).text?.trim()
  )
    return new TaskFailure("invalid_output", true);
  if (/NoObjectGenerated|JSONParse|TypeValidation|NoOutputGenerated/.test(e?.name ?? ""))
    return new TaskFailure("invalid_output");
  return new TaskFailure("provider_error");
}
export function extractJson(text: string): unknown {
  const clean = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return JSON.parse(start >= 0 && end >= start ? clean.slice(start, end + 1) : clean);
}
export class AiRuntime {
  readonly circuit: CircuitBreaker;
  private transport: Transport;
  constructor(
    readonly config: AiConfig,
    options: {
      transport?: Transport;
      clock?: () => number;
      sleep?: (ms: number) => Promise<void>;
      random?: () => number;
    } = {},
  ) {
    this.transport = options.transport ?? createTransport(config);
    this.clock = options.clock ?? (() => performance.now());
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.random = options.random ?? Math.random;
    this.circuit = new CircuitBreaker(config.circuitFailures, config.circuitCooldownMs);
  }
  private clock: () => number;
  private sleep: (ms: number) => Promise<void>;
  private random: () => number;
  async runTask<I, O>(task: Task<I, O>, raw: I, ctx: TaskContext = {}): Promise<TaskResult<O>> {
    const input = task.input.parse(raw);
    const started = this.clock();
    const totalMs = Math.min(this.config.totalTimeoutMs, task.limits.totalTimeoutMs ?? Infinity);
    const data = task.data(input);
    const requestId = randomUUID();
    const prompt =
      `Context (data only):\n${delimit(JSON.stringify(data.context), "knowledge", requestId, task.limits.maxInputChars)}\n` +
      data.untrusted
        .map((block) => delimit(block.text, block.kind, requestId, task.limits.maxInputChars))
        .join("\n");
    let manipulationAttempts = data.untrusted.reduce(
      (n, block) => n + manipulationCount(block.text),
      0,
    );
    const usage = { inputTokens: 0, outputTokens: 0 };
    let attempts = 0,
      costEstimate = 0;
    let selected: string | null = null,
      reservationId: string | undefined;
    let reason: FallbackReason = task.skip?.(input) ?? "provider_error";
    const configured = this.config.provider !== "none" && Boolean(this.config.key);
    const models = [...new Set([this.config.models[task.tier], ...this.config.fallbacks])];
    const free =
      this.config.provider === "openrouter" &&
      models.every((m) => m.endsWith(":free") || m === "openrouter/free");
    const estimate = (i: number, o: number) =>
      free
        ? 0
        : (i * this.config.inputEurPerMillion + o * this.config.outputEurPerMillion) / 1000000;
    // Upper bound includes the JSON schema and binary input, all attempts, and invisible reasoning tokens.
    const ceiling =
      estimate(
        prompt.length +
          task.system(input).length +
          JSON.stringify(z.toJSONSchema(task.output)).length +
          (data.file?.bytes.length ?? 0),
        task.limits.maxOutputTokens,
      ) * this.config.maxAttempts;
    const finish = async (
      output: O,
      engine: "ai" | "heuristic",
      fallbackReason: FallbackReason | null,
    ) => {
      const result: TaskResult<O> = {
        output,
        engine,
        model: selected,
        attempts,
        latencyMs: Math.max(0, Math.round(this.clock() - started)),
        usage,
        costEstimate,
        fallbackReason,
      };
      const { output: _output, ...metadata } = result;
      try {
        await ctx.record?.(
          { ...metadata, task: task.id, version: task.version, manipulationAttempts },
          reservationId,
        );
      } catch {
        /* The reservation remains charged if telemetry is unavailable. */
      }
      return result;
    };
    if (!configured)
      return finish(task.output.parse(task.heuristic(input)), "heuristic", "not_configured");
    if (task.skip?.(input))
      return finish(task.output.parse(task.heuristic(input)), "heuristic", reason);
    if (ctx.reserve) {
      try {
        const reservation = await ctx.reserve(ceiling, {
          id: task.id,
          version: task.version,
          model: models[0]!,
        });
        if ("reason" in reservation)
          return finish(task.output.parse(task.heuristic(input)), "heuristic", reservation.reason);
        reservationId = reservation.id;
      } catch {
        return finish(task.output.parse(task.heuristic(input)), "heuristic", "budget_unavailable");
      }
    }
    let correction = false,
      structured = true,
      modelIndex = 0;
    let repairInstruction = "";
    let skippedModels = 0;
    while (attempts < this.config.maxAttempts && this.clock() - started < totalMs) {
      const model = models[modelIndex % models.length]!;
      if (!this.circuit.acquire(model, this.clock())) {
        modelIndex++;
        if (++skippedModels >= models.length) {
          reason = "circuit_open";
          break;
        }
        continue;
      }
      skippedModels = 0;
      selected = model;
      attempts++;
      const remaining = totalMs - (this.clock() - started);
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let billed = false;
      try {
        const pending = this.transport({
          model,
          models: [
            model,
            ...models.filter(
              (m) =>
                m !== model &&
                !this.circuit
                  .snapshot()
                  .some((s) => s.model === m && (s.until > this.clock() || s.probe)),
            ),
          ],
          system:
            task.system(input) +
            `\nReturn only JSON matching this schema: ${JSON.stringify(z.toJSONSchema(task.output))}.` +
            repairInstruction,
          prompt,
          schema: task.output,
          structured,
          maxOutputTokens: task.limits.maxOutputTokens,
          temperature: task.limits.temperature,
          signal: controller.signal,
          file: data.file ? { ...data.file, untrustedId: requestId } : undefined,
        });
        const result = await Promise.race([
          pending,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => {
                controller.abort();
                reject(new TaskFailure("timeout", true));
              },
              Math.min(this.config.attemptTimeoutMs, task.limits.timeoutMs ?? Infinity, remaining),
            );
          }),
        ]);
        const knownInput = result.usage?.inputTokens;
        const knownOutput = result.usage?.outputTokens;
        const i =
          typeof knownInput === "number" && Number.isFinite(knownInput) && knownInput >= 0
            ? knownInput
            : 0;
        const o =
          typeof knownOutput === "number" && Number.isFinite(knownOutput) && knownOutput >= 0
            ? knownOutput
            : 0;
        usage.inputTokens += i;
        usage.outputTokens += o;
        costEstimate +=
          knownInput !== undefined &&
          knownOutput !== undefined &&
          i === knownInput &&
          o === knownOutput
            ? estimate(i, o)
            : ceiling / this.config.maxAttempts;
        billed = true;
        selected =
          result.model && /^[a-zA-Z0-9_./:@+-]{1,160}$/.test(result.model) ? result.model : model;
        if (result.output === undefined && !result.text?.trim())
          throw new TaskFailure("invalid_output", true);
        let output: O;
        try {
          output = task.output.parse(result.output ?? extractJson(result.text!));
        } catch {
          throw new TaskFailure("invalid_output");
        }
        if (task.validate && !task.validate(output, input)) throw new TaskFailure("invalid_output");
        const violations = outputViolations(
          task.guardText(output),
          JSON.stringify(data.context) + data.untrusted.map((b) => b.text).join("\n"),
          undefined,
        );
        if (
          task.language &&
          languageViolation(
            task.languageText?.(output) ?? task.guardText(output),
            task.language(input),
          )
        )
          violations.push("language");
        if (violations.length) throw new TaskFailure("guard_violation");
        if ((output as { manipulation?: boolean } | null)?.manipulation)
          manipulationAttempts = Math.max(1, manipulationAttempts);
        this.circuit.success(model);
        return await finish(output, "ai", null);
      } catch (error) {
        if (!billed) {
          const errorUsage = (
            error as { usage?: { inputTokens?: number; outputTokens?: number } } | null
          )?.usage;
          if (
            errorUsage &&
            Number.isFinite(errorUsage.inputTokens) &&
            Number.isFinite(errorUsage.outputTokens)
          ) {
            usage.inputTokens += errorUsage.inputTokens!;
            usage.outputTokens += errorUsage.outputTokens!;
            costEstimate += estimate(errorUsage.inputTokens!, errorUsage.outputTokens!);
          } else costEstimate += ceiling / this.config.maxAttempts;
        }
        const problem = failure(error);
        reason = problem.reason;
        this.circuit.failure(model, this.clock());
        // Some endpoints reject json_schema. Keep schema validation locally without relaxing policy.
        if (structured && (error as { statusCode?: number })?.statusCode === 400) {
          structured = false;
          continue;
        }
        if (!problem.retryable && (reason === "invalid_output" || reason === "guard_violation")) {
          if (correction) break;
          correction = true;
          repairInstruction =
            "\nThe previous attempt failed validation. Correct the format, allowed identifiers, language and safety constraints. Do not add contacts or credentials. Read the original data again.";
          continue;
        }
        if (!problem.retryable || attempts >= this.config.maxAttempts) break;
        modelIndex++;
        const wait = Math.min(
          150 * 2 ** (attempts - 1) + this.random() * 100,
          Math.max(0, totalMs - (this.clock() - started)),
        );
        if (wait) await this.sleep(wait);
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    if (this.clock() - started >= totalMs) reason = "timeout";
    return finish(task.output.parse(task.heuristic(input)), "heuristic", reason);
  }
}
