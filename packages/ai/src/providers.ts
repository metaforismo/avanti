import type { AiConfig } from "./config";
import type { Transport } from "./types";

export function createTransport(config: AiConfig): Transport {
  return async (request) => {
    const { generateText, Output } = await import("ai");
    let model;
    let providerOptions;
    if (config.provider === "openrouter") {
      const { createOpenRouter } = await import("@openrouter/ai-sdk-provider");
      model = createOpenRouter({ apiKey: config.key })(request.model, {
        models: request.models,
        reasoning: { effort: "minimal", exclude: true },
        extraBody: {
          provider:
            config.dataPolicy === "strict"
              ? { data_collection: "deny", zdr: true }
              : { data_collection: "allow" },
        },
      });
    } else if (config.provider === "openai") {
      const { createOpenAI } = await import("@ai-sdk/openai");
      model = createOpenAI({ apiKey: config.key })(request.model);
      if (/^(o\d|gpt-[5-9])/.test(request.model))
        providerOptions = { openai: { reasoningEffort: "minimal" } };
    } else if (config.provider === "anthropic") {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      model = createAnthropic({ apiKey: config.key })(request.model);
      providerOptions = { anthropic: { thinking: { type: "disabled" } } };
    } else if (config.provider === "gateway") {
      const { createGateway } = await import("ai");
      model = createGateway({ apiKey: config.key })(request.model);
      providerOptions = { gateway: { only: [config.gatewayProvider] } };
    } else throw new Error("ProviderDisabled");
    const result = await generateText({
      model,
      providerOptions,
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
      ...(request.structured ? { output: Output.object({ schema: request.schema }) } : {}),
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
