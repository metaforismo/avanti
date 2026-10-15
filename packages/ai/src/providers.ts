import { wireSchema } from "./schema";
import type { AiConfig, Reasoning } from "./config";
import type { Transport } from "./types";

export function anthropicReasoningBudget(config: AiConfig, model: string, reasoning?: Reasoning) {
  const legacy =
    /^(?:claude-3-|claude-(?:sonnet|opus|haiku)-4-(?:[0-5])(?:-|$)|claude-(?:sonnet|opus)-4(?:$|-20\d))/.test(
      model,
    );
  if (config.provider !== "anthropic" || !legacy || !reasoning || reasoning === "off") return 0;
  return { minimal: 1024, low: 2048, medium: 4096 }[reasoning];
}

export function createTransport(config: AiConfig): Transport {
  return async (request) => {
    if (request.file?.mime.startsWith("audio/")) {
      if (config.provider !== "openrouter") throw new Error("UnsupportedAudioProvider");
      const format =
        request.file.mime === "audio/mp4"
          ? "m4a"
          : request.file.mime.slice(6).replace("x-wav", "wav");
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: request.signal,
        headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: request.model,
          provider:
            config.dataPolicy === "strict"
              ? { data_collection: "deny", zdr: true }
              : { data_collection: "allow" },
          messages: [
            { role: "system", content: request.system },
            {
              role: "user",
              content: [
                { type: "text", text: request.prompt },
                {
                  type: "input_audio",
                  input_audio: { data: Buffer.from(request.file.bytes).toString("base64"), format },
                },
              ],
            },
          ],
          max_tokens: request.maxOutputTokens,
          ...(request.structured ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (!response.ok)
        throw Object.assign(new Error("AudioProviderError"), { statusCode: response.status });
      const result = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
        model?: string;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      return {
        text: result.choices?.[0]?.message?.content,
        model: result.model,
        usage: {
          inputTokens: result.usage?.prompt_tokens,
          outputTokens: result.usage?.completion_tokens,
        },
      };
    }
    const { generateText, Output, jsonSchema } = await import("ai");
    let model;
    let providerOptions;
    const thinkingBudget = anthropicReasoningBudget(config, request.model, request.reasoning);
    if (config.provider === "openrouter") {
      const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
      model = createOpenRouter({ apiKey: config.key })(request.model, {
        models: request.models,
        structuredOutputs: { strict: false },
        extraBody: {
          ...(request.reasoning === undefined
            ? {}
            : {
                reasoning:
                  request.reasoning === "off"
                    ? { enabled: false }
                    : { effort: request.reasoning, exclude: true },
              }),

          provider:
            config.dataPolicy === "strict"
              ? { data_collection: "deny", zdr: true }
              : { data_collection: "allow" },
        },
      });
    } else if (config.provider === "openai") {
      const { createOpenAI } = await import("@ai-sdk/openai");
      model = createOpenAI({ apiKey: config.key })(request.model);
      providerOptions = {
        openai: {
          strictJsonSchema: false,
          ...(request.reasoning === undefined
            ? {}
            : {
                reasoningEffort:
                  request.reasoning === "off"
                    ? "none"
                    : request.reasoning === "minimal" && /^gpt-[6-9]/.test(request.model)
                      ? "low"
                      : request.reasoning,
              }),
        },
      };
    } else if (config.provider === "anthropic") {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      model = createAnthropic({ apiKey: config.key })(request.model);
      if (thinkingBudget)
        providerOptions = {
          anthropic: { thinking: { type: "enabled" as const, budgetTokens: thinkingBudget } },
        };
    } else if (config.provider === "gateway") {
      const { createGateway } = await import("ai");
      model = createGateway({ apiKey: config.key })(request.model);
      providerOptions = { gateway: { only: [config.gatewayProvider] } };
    } else throw new Error("ProviderDisabled");
    const result = await generateText({
      model,
      providerOptions,
      ...(config.provider === "anthropic" && !thinkingBudget && request.reasoning !== undefined
        ? { reasoning: request.reasoning === "off" ? ("none" as const) : request.reasoning }
        : {}),
      instructions: request.system,
      messages: [
        {
          role: "user",
          content: request.file
            ? [
                {
                  type: "text",
                  text:
                    request.prompt +
                    `\n<untrusted id="${request.file.untrustedId ?? "attachment"}" kind="document">`,
                },
                { type: "file", data: request.file.bytes, mediaType: request.file.mime },
                { type: "text", text: "</untrusted>" },
              ]
            : [{ type: "text", text: request.prompt }],
        },
      ],
      ...(request.structured
        ? { output: Output.object({ schema: jsonSchema(wireSchema(request.schema)) }) }
        : {}),
      maxOutputTokens: request.maxOutputTokens,
      temperature: request.temperature,
      maxRetries: 0,
      abortSignal: request.signal,
    });
    return {
      output: request.structured ? result.output : undefined,
      text: result.text,
      usage: result.usage,
      model: result.response?.modelId,
    };
  };
}
