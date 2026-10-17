/**
 * Plain values shared by server and browser. Kept free of zod so client bundles that only
 * need a list of languages or the upload limit don't ship the whole validation library.
 */

export const LANGUAGES = ["it", "en", "fr", "es", "ro", "uk", "ar", "bn"] as const;
export const RTL_LANGUAGES: readonly (typeof LANGUAGES)[number][] = ["ar"];

export const PRACTICE_IDS = [
  "isee_ordinario",
  "isee_universitario",
  "modello_730",
  "red",
  "assegno_unico",
  "successione_semplice",
  "permesso_soggiorno",
  "cittadinanza",
  "naspi",
] as const;

export const UPLOAD_LIMITS = {
  maxBytes: 4 * 1024 * 1024,
  mimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"],
} as const;

/** Minimum length for operator passwords chosen by people (temporary ones are generated). */
export const PASSWORD_MIN_LENGTH = 12;

/** Most cases an admin can assign in one go: two full queue pages. */
export const ASSIGN_CASES_MAX = 100;
