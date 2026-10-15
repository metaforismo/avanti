import type { z } from "zod";
import type { Language } from "@avanti/contracts";
import type { Tier } from "./config";

export type FallbackReason =
  | "not_configured"
  | "budget_exhausted"
  | "budget_unavailable"
  | "timeout"
  | "rate_limit"
  | "provider_error"
  | "invalid_output"
  | "guard_violation"
  | "circuit_open"
  | "unsupported_media";
export interface Task<I, O> {
  id: string;
  version: string;
  tier: Tier;
  input: z.ZodType<I>;
  output: z.ZodType<O>;
  system(input: I): string;
  data(input: I): {
    context: unknown;
    untrusted: {
      kind: "citizen_text" | "document" | "operator_text" | "knowledge";
      text: string;
    }[];
    file?: { bytes: Uint8Array; mime: string };
  };
  heuristic(input: I): O;
  validate?(output: O, input: I): boolean;
  guardText(output: O): string;
  language?(input: I): Language;
  languageText?(output: O): string;
  skip?(input: I): FallbackReason | undefined;
  limits: {
    maxOutputTokens: number;
    timeoutMs?: number;
    totalTimeoutMs?: number;
    maxInputChars: number;
    temperature?: number;
  };
}
export interface TaskResult<O> {
  output: O;
  engine: "ai" | "heuristic";
  model: string | null;
  attempts: number;
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number };
  costEstimate: number;
  fallbackReason: FallbackReason | null;
}
export interface Telemetry extends Omit<TaskResult<never>, "output"> {
  task: string;
  version: string;
  manipulationAttempts: number;
}
export interface TaskContext {
  organizationId?: string;
  reserve?(
    ceilingEur: number,
    task: { id: string; version: string; model: string },
  ): Promise<{ id: string } | { reason: "budget_exhausted" | "budget_unavailable" }>;
  record?(record: Telemetry, reservationId?: string): Promise<void>;
}
export interface TransportRequest {
  model: string;
  models: string[];
  system: string;
  prompt: string;
  schema: z.ZodType;
  structured: boolean;
  maxOutputTokens: number;
  temperature?: number;
  signal: AbortSignal;
  file?: { bytes: Uint8Array; mime: string; untrustedId?: string };
}
export interface TransportResult {
  output?: unknown;
  text?: string;
  model?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}
export type Transport = (request: TransportRequest) => Promise<TransportResult>;
