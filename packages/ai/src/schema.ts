import type { JSONSchema7 } from "ai";
import { z } from "zod";

export function wireSchema(schema: z.ZodType) {
  // Provider grammars do not consistently implement JavaScript Unicode regexes.
  // Keep lexical safety checks in the full local Zod schema.
  const json = z.toJSONSchema(schema, { target: "draft-7" });
  return JSON.parse(
    JSON.stringify(json, (key, value: unknown) => (key === "pattern" ? undefined : value)),
  ) as JSONSchema7;
}
