import type { Hono, Context } from "hono";
import type { Database } from "@avanti/db";
import type { FileStorage } from "./storage";
import type { Intelligence } from "./ai";
import type { CaseRow } from "./dossier";
import { operators } from "@avanti/db";
import type { z } from "zod";
import { ApiFailure } from "./security";

export interface ApiOptions {
  db: Database;
  storage: FileStorage;
  ai?: Intelligence;
  clock?: () => Date;
  publicUrl?: string;
  production?: boolean;
  trustProxy?: boolean;
  logger?: (record: {
    requestId: string;
    category: string;
    status: number;
    durationMs: number;
  }) => void;
}
export interface ApiEnv {
  Variables: { operator: typeof operators.$inferSelect; citizen: CaseRow; requestId: string };
}
export type App = Hono<ApiEnv>;
export type ApiContext = Context<ApiEnv>;
export interface Services extends ApiOptions {
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
