import type { ErrorRecord } from "./logging";
import type { Hono, Context } from "hono";
import type { Database } from "@avanti/db";
import type { FileStorage } from "./storage";
import type { Intelligence } from "./ai";
import type { CaseRow } from "./dossier";
import { operators } from "@avanti/db";
import type { z } from "zod";
import { ApiFailure } from "./security";
import type { NotificationOptions } from "./notification-config";

export interface ApiOptions {
  db: Database;
  notifications?: NotificationOptions;
  storage: FileStorage;
  ai?: Intelligence;
  clock?: () => Date;
  publicUrl?: string;
  production?: boolean;
  trustProxy?: boolean;
  errorLogger?: (record: ErrorRecord) => void;
  storageLogger?: (record: {
    op: string;
    caseId: string;
    documentId: string;
    errorName: string;
  }) => void;
  rateLimitSecret?: string;
  vercel?: boolean;
  cronSecret?: string;
  background?: (work: () => Promise<void>) => void;
  transport?: "fetch" | "node";
  clientAddress?: (context: ApiContext) => string | null;
  logger?: (record: {
    requestId: string;
    category: string;
    status: number;
    durationMs: number;
  }) => void;
}
export interface ApiEnv {
  Bindings: { incoming?: { socket: { remoteAddress?: string } } };
  Variables: {
    operator: typeof operators.$inferSelect;
    citizen: CaseRow;
    requestId: string;
    bodyTooLarge: boolean;
  };
}
export type App = Hono<ApiEnv>;
export type ApiContext = Context<ApiEnv>;
export interface Services extends ApiOptions {
  notifications: NotificationOptions;
  clock: () => Date;
  ai: Intelligence;
  publicUrl: string;
  production: boolean;
}
export async function body<T>(c: ApiContext, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw new ApiFailure("bad_request", 400, "Richiesta non valida.");
  }
  return parse(schema, raw);
}
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ApiFailure("bad_request", 400, "Controlla i dati inseriti.");
  return result.data;
}
export function mutableCitizen(row: CaseRow) {
  if (row.status !== "intake" && row.status !== "needs_citizen")
    throw new ApiFailure("conflict", 409, "Il fascicolo è in revisione. Contatta lo sportello.");
}
