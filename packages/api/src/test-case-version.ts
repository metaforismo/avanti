import { eq } from "drizzle-orm";
import { cases, type Database } from "@avanti/db";

/** Legacy flow fixtures model an operator who has just read the current dossier. */
export async function withCaseVersion(db: Database, path: string, method: string, input: unknown) {
  const match = /^\/(?:api\/)?cases\/([^/]+)(?:\/(requests|checklist\/.*\/review))?$/.exec(path);
  if (!match || !["POST", "PATCH"].includes(method) || !input || typeof input !== "object")
    return input;
  if (Object.hasOwn(input, "expectedUpdatedAt")) return input;
  const [row] = await db
    .select({ updatedAt: cases.updatedAt })
    .from(cases)
    .where(eq(cases.id, match[1]!));
  return row ? { ...input, expectedUpdatedAt: new Date(row.updatedAt).toISOString() } : input;
}
