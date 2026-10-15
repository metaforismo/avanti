import { expect, it, vi } from "vitest";
import { z } from "zod";
import { createTransport } from "./providers";
import { loadAiConfig } from "./config";
it("sends strict OpenRouter routing, fallbacks and bounded reasoning through the official SDK", async () => {
  let body: Record<string, unknown> = {};
  const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        id: "synthetic",
        model: "test/a:free",
        object: "chat.completion",
        created: 1,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: '{"text":"ok"}' },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
      { headers: { "content-type": "application/json" } },
    );
  });
  vi.stubGlobal("fetch", fetch);
  try {
    const transport = createTransport(
      loadAiConfig({ AI_PROVIDER: "openrouter", OPENROUTER_API_KEY: "synthetic" }),
    );
    expect(
      await transport({
        model: "test/a:free",
        models: ["test/a:free", "test/b:free"],
        system: "synthetic",
        prompt: "synthetic",
        schema: z.object({ text: z.string() }),
        structured: true,
        reasoning: "off",
        maxOutputTokens: 50,
        signal: new AbortController().signal,
      }),
    ).toMatchObject({ output: { text: "ok" } });
    expect(body).toMatchObject({
      provider: { data_collection: "deny", zdr: true },
      models: ["test/a:free", "test/b:free"],
      reasoning: { enabled: false },
      response_format: { type: "json_schema", json_schema: { strict: false } },
      max_tokens: 50,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
  }
});
it("keeps lexical Unicode validation local while sending a non-strict free-key schema", async () => {
  let body: Record<string, unknown> = {};
  const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        id: "synthetic",
        model: "test/model",
        object: "chat.completion",
        created: 1,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: '{"answers":{"count":4},"text":"ok"}' },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
      { headers: { "content-type": "application/json" } },
    );
  });
  vi.stubGlobal("fetch", fetch);
  try {
    await createTransport(
      loadAiConfig({ AI_PROVIDER: "openrouter", OPENROUTER_API_KEY: "synthetic" }),
    )({
      model: "test/model",
      models: ["test/model"],
      system: "synthetic",
      prompt: "synthetic",
      schema: z.object({
        answers: z.record(z.string(), z.number()),
        text: z.string().regex(/^[^\p{Surrogate}]*$/u),
      }),
      structured: true,
      reasoning: "minimal",
      maxOutputTokens: 50,
      signal: new AbortController().signal,
    });
    expect(body).toMatchObject({
      reasoning: { effort: "minimal", exclude: true },
      response_format: {
        json_schema: {
          strict: false,
          schema: { properties: { answers: { additionalProperties: { type: "number" } } } },
        },
      },
    });
    expect(JSON.stringify(body.response_format)).not.toContain('"pattern"');
  } finally {
    vi.unstubAllGlobals();
  }
});
it.each(["off", "minimal", "low", "medium", undefined] as const)(
  "maps direct OpenAI reasoning %s and disables strict schema",
  async (reasoning) => {
    let body: Record<string, unknown> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        body = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            id: "synthetic",
            object: "response",
            created_at: 1,
            status: "completed",
            model: "gpt-6-luna",
            output: [
              {
                id: "m",
                type: "message",
                role: "assistant",
                content: [{ type: "output_text", text: '{"text":"ok"}', annotations: [] }],
              },
            ],
            usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
          }),
          { headers: { "content-type": "application/json" } },
        );
      }),
    );
    try {
      await createTransport(loadAiConfig({ AI_PROVIDER: "openai", OPENAI_API_KEY: "synthetic" }))({
        model: "gpt-6-luna",
        models: ["gpt-6-luna"],
        system: "synthetic",
        prompt: "synthetic",
        schema: z.object({ text: z.string() }),
        structured: true,
        reasoning,
        maxOutputTokens: 50,
        signal: new AbortController().signal,
      });
      expect(body).toMatchObject({ text: { format: { type: "json_schema", strict: false } } });
      if (reasoning === undefined) expect(body).not.toHaveProperty("reasoning");
      else
        expect(body).toMatchObject({
          reasoning: {
            effort: reasoning === "off" ? "none" : reasoning === "minimal" ? "low" : reasoning,
          },
        });
    } finally {
      vi.unstubAllGlobals();
    }
  },
);
it.each(["off", "minimal", "low", "medium", undefined] as const)(
  "maps direct Anthropic reasoning %s",
  async (reasoning) => {
    let body: Record<string, unknown> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        body = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            id: "synthetic",
            type: "message",
            role: "assistant",
            model: "claude-sonnet-4-6",
            content: [{ type: "text", text: '{"text":"ok"}' }],
            stop_reason: "end_turn",
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { headers: { "content-type": "application/json" } },
        );
      }),
    );
    try {
      await createTransport(
        loadAiConfig({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "synthetic" }),
      )({
        model: "claude-sonnet-4-6",
        models: ["claude-sonnet-4-6"],
        system: "synthetic",
        prompt: "synthetic",
        schema: z.object({ text: z.string() }),
        structured: true,
        reasoning,
        maxOutputTokens: 50,
        signal: new AbortController().signal,
      });
      if (reasoning === undefined) expect(body).not.toHaveProperty("thinking");
      else if (reasoning === "off") expect(body).toMatchObject({ thinking: { type: "disabled" } });
      else
        expect(body).toMatchObject({
          thinking: { type: "adaptive" },
          output_config: { effort: reasoning === "minimal" ? "low" : reasoning },
        });
    } finally {
      vi.unstubAllGlobals();
    }
  },
);
it.each(["minimal", "low", "medium"] as const)(
  "bounds legacy Anthropic thinking at %s",
  async (reasoning) => {
    let body: Record<string, unknown> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init?: RequestInit) => {
        body = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            id: "synthetic",
            type: "message",
            role: "assistant",
            model: "claude-sonnet-4-5",
            content: [{ type: "text", text: '{"text":"ok"}' }],
            stop_reason: "end_turn",
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
          { headers: { "content-type": "application/json" } },
        );
      }),
    );
    try {
      await createTransport(
        loadAiConfig({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "synthetic" }),
      )({
        model: "claude-sonnet-4-5",
        models: ["claude-sonnet-4-5"],
        system: "synthetic",
        prompt: "synthetic",
        schema: z.object({ text: z.string() }),
        structured: true,
        reasoning,
        maxOutputTokens: 700,
        signal: new AbortController().signal,
      });
      const budget = { minimal: 1024, low: 2048, medium: 4096 }[reasoning];
      expect(body).toMatchObject({
        thinking: { type: "enabled", budget_tokens: budget },
        max_tokens: 700 + budget,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  },
);
