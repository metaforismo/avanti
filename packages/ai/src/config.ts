import { z } from "zod";

const Provider = z.enum(["openrouter", "openai", "anthropic", "gateway", "none"]);
export type Provider = z.infer<typeof Provider>;
export type Tier = "fast" | "reasoning" | "vision" | "audio";
const Reasoning = z.enum(["off", "minimal", "low", "medium"]);
export type Reasoning = z.infer<typeof Reasoning>;
const identifier = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9_./:@+-]+$/);
const number = (value: string | undefined, fallback: number, min: number, max: number) =>
  z.coerce
    .number()
    .finite()
    .min(min)
    .max(max)
    .parse(value ?? fallback);
export interface AiConfig {
  provider: Provider;
  key?: string;
  models: Record<Tier, string>;
  fallbacks: string[];
  dataPolicy: "strict" | "permissive";
  gatewayProvider: string;
  attemptTimeoutMs: Record<Tier, number>;
  reasoning: Record<Tier, Reasoning>;
  prices: Record<string, [number, number]>;
  totalTimeoutMs: number;
  maxAttempts: number;
  monthlyBudgetEur: number;
  inputEurPerMillion: number;
  outputEurPerMillion: number;
  circuitFailures: number;
  circuitCooldownMs: number;
  deprecations: string[];
}
export function loadAiConfig(env: Record<string, string | undefined> = {}): AiConfig {
  const provider = Provider.parse(
    env.AI_PROVIDER?.trim() || (env.AI_GATEWAY_API_KEY ? "gateway" : "none"),
  );
  const keys = {
    openrouter: "OPENROUTER_API_KEY",
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    gateway: "AI_GATEWAY_API_KEY",
    none: "",
  };
  const defaults = {
    none: "disabled",
    openrouter: "openrouter/free",
    openai: "gpt-4.1-mini",
    anthropic: "claude-sonnet-4-5",
    gateway: "anthropic/claude-sonnet-5.5",
  };
  const fast = identifier.parse(env.AI_MODEL_FAST || env.AI_MODEL_TEXT || defaults[provider]);
  return {
    provider,
    key: env[keys[provider]]?.trim() || undefined,
    models: {
      fast,
      audio: identifier.parse(env.AI_MODEL_AUDIO || "google/gemini-3.5-flash-lite"),
      reasoning: identifier.parse(env.AI_MODEL_REASONING || fast),
      vision: identifier.parse(env.AI_MODEL_VISION || fast),
    },
    fallbacks: (
      env.AI_MODEL_FALLBACKS?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? []
    )
      .map((s) => identifier.parse(s))
      .slice(0, 5),
    dataPolicy: z.enum(["strict", "permissive"]).parse(env.AI_DATA_POLICY || "strict"),
    gatewayProvider: identifier.parse(env.AI_GATEWAY_PROVIDER || "anthropic"),
    attemptTimeoutMs: {
      fast: number(env.AI_ATTEMPT_TIMEOUT_MS_FAST ?? env.AI_ATTEMPT_TIMEOUT_MS, 6000, 10, 120000),
      reasoning: number(
        env.AI_ATTEMPT_TIMEOUT_MS_REASONING ?? env.AI_ATTEMPT_TIMEOUT_MS,
        25000,
        10,
        120000,
      ),
      vision: number(
        env.AI_ATTEMPT_TIMEOUT_MS_VISION ?? env.AI_ATTEMPT_TIMEOUT_MS,
        20000,
        10,
        120000,
      ),
      audio: number(
        env.AI_ATTEMPT_TIMEOUT_MS_AUDIO ?? env.AI_ATTEMPT_TIMEOUT_MS,
        20000,
        10,
        120000,
      ),
    },
    reasoning: {
      fast: Reasoning.parse(env.AI_REASONING_FAST ?? "off"),
      reasoning: Reasoning.parse(env.AI_REASONING_REASONING ?? "minimal"),
      vision: Reasoning.parse(env.AI_REASONING_VISION ?? "minimal"),
      // The audio transport calls OpenRouter directly and never sends a reasoning setting.
      audio: Reasoning.parse(env.AI_REASONING_AUDIO ?? "minimal"),
    },
    prices: z
      .record(
        identifier,
        z.tuple([z.number().finite().min(0).max(10000), z.number().finite().min(0).max(10000)]),
      )
      .parse(JSON.parse(env.AI_PRICES ?? "{}")),
    totalTimeoutMs: number(env.AI_TOTAL_TIMEOUT_MS, 45000, 10, 180000),
    maxAttempts: z
      .number()
      .int()
      .parse(number(env.AI_MAX_ATTEMPTS, 3, 1, 8)),
    monthlyBudgetEur: number(env.AI_MONTHLY_BUDGET_EUR, 50, 0, 100000),
    inputEurPerMillion: number(env.AI_INPUT_EUR_PER_MILLION, 3, 0, 10000),
    outputEurPerMillion: number(env.AI_OUTPUT_EUR_PER_MILLION, 15, 0, 10000),
    circuitFailures: 3,
    circuitCooldownMs: 30000,
    deprecations: ["AI_GATEWAY_API_KEY", "AI_MODEL_TEXT", "AI_GATEWAY_PROVIDER"].filter((k) =>
      Boolean(env[k]),
    ),
  };
}
export function publicAiConfig(config: AiConfig) {
  return {
    provider: config.provider,
    models: config.models,
    dataPolicy: config.dataPolicy,
    fallbacks: config.fallbacks,
    reasoning: config.reasoning,
    attemptTimeoutMs: config.attemptTimeoutMs,
    totalTimeoutMs: config.totalTimeoutMs,
    maxAttempts: config.maxAttempts,
    prices: config.prices,
    keyPresent: Boolean(config.key),
    monthlyBudgetEur: config.monthlyBudgetEur,
  };
}
