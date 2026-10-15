// Eval-only transport override while the parallel runtime session tunes provider parameters.
import { z } from "zod";
import type { AiConfig } from "../src/config";
import type { Transport } from "../src/types";
export function operatorEvalTransport(
  config: AiConfig,
  receipts: {
    status: number;
    model: string;
    policy: string;
    provider: string | null;
    costUsd: number | null;
    reason: string | null;
  }[],
): Transport {
  return async (request) => {
    const content: unknown[] = [{ type: "text", text: request.prompt }];
    if (request.file) {
      const url = `data:${request.file.mime};base64,${Buffer.from(request.file.bytes).toString("base64")}`;
      content.push(
        request.file.mime === "application/pdf"
          ? { type: "file", file: { filename: "synthetic.pdf", file_data: url } }
          : { type: "image_url", image_url: { url } },
      );
    }
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: request.signal,
      headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: request.model,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content },
        ],
        provider:
          config.dataPolicy === "strict"
            ? { data_collection: "deny", zdr: true }
            : { data_collection: "allow" },
        reasoning: request.model.startsWith("deepseek/")
          ? { enabled: false }
          : { effort: "minimal", exclude: true },
        ...(request.file?.mime === "application/pdf"
          ? { plugins: [{ id: "file-parser", pdf: { engine: "native" } }] }
          : {}),
        ...(request.structured
          ? {
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "operator_eval",
                  strict: false,
                  schema: z.toJSONSchema(request.schema),
                },
              },
            }
          : {}),
        max_tokens: request.maxOutputTokens,
        temperature: 0,
      }),
    });
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      model?: string;
      provider?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
      error?: { message?: string; metadata?: { raw?: string } };
    };
    const diagnostic = `${data.error?.message ?? ""} ${data.error?.metadata?.raw ?? ""}`;
    receipts.push({
      status: response.status,
      model: data.model ?? request.model,
      policy: config.dataPolicy,
      provider: data.provider ?? null,
      costUsd: data.usage?.cost ?? null,
      reason: response.ok
        ? null
        : /data policy|zero data|zdr|privacy/i.test(diagnostic)
          ? "policy_no_endpoint"
          : /schema|pattern|regex/i.test(diagnostic)
            ? "schema_rejected"
            : /parameter|temperature|reasoning/i.test(diagnostic)
              ? "parameter_rejected"
              : "provider_error",
    });
    if (!response.ok)
      throw Object.assign(new Error("EvalProviderFailure"), { statusCode: response.status });
    return {
      text: data.choices?.[0]?.message?.content ?? "",
      model: data.model,
      usage: {
        inputTokens: data.usage?.prompt_tokens,
        outputTokens: data.usage?.completion_tokens,
      },
    };
  };
}
