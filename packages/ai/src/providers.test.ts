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
        maxOutputTokens: 50,
        signal: new AbortController().signal,
      }),
    ).toMatchObject({ output: { text: "ok" } });
    expect(body).toMatchObject({
      provider: { data_collection: "deny", zdr: true },
      models: ["test/a:free", "test/b:free"],
      reasoning: { effort: "minimal", exclude: true },
      response_format: { type: "json_schema" },
      max_tokens: 50,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
  }
});
