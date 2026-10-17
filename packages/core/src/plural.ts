/**
 * Plural forms of one message, keyed by CLDR plural category (the same categories
 * `Intl.PluralRules` returns), plus the exact matches "=0" and "=1" as in ICU MessageFormat.
 *
 * Categories are not "singular/plural": Ukrainian has one (1, 21, 31…), few (2–4, 22–24…) and
 * many (0, 5–20, 11–14…); Arabic has zero, one, two, few (3–10), many (11–99) and other (100…);
 * Romanian adds "de" from 20 on (few: 2–19, other: 20–100). French "one" also covers 0 and
 * Bengali "one" covers 0 and 1, so a form that names the quantity ("un conto", "його") belongs
 * under "=1", never under "one" when the language's "one" means more than exactly 1.
 *
 * A message whose only key is `other` declares itself invariant in that language (Bengali
 * classifiers, abbreviations like "хв"). `other` is always required: it is the fallback.
 */
export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";
export type PluralForms = { readonly other: string } & {
  readonly [K in Exclude<PluralCategory, "other"> | "=0" | "=1"]?: string;
};

const PLURAL_KEYS: ReadonlySet<string> = new Set([
  "zero",
  "one",
  "two",
  "few",
  "many",
  "other",
  "=0",
  "=1",
]);

const rules = new Map<string, Intl.PluralRules>();

export function pluralCategory(language: string, n: number): PluralCategory {
  let rule = rules.get(language);
  if (!rule) {
    rule = new Intl.PluralRules(language);
    rules.set(language, rule);
  }
  return rule.select(n) as PluralCategory;
}

/**
 * The form of `forms` that agrees with `n` in `language`, with `{n}` and any other `{name}`
 * placeholder filled in. Unknown placeholders stay visible so they get noticed.
 */
export function plural(
  language: string,
  n: number,
  forms: PluralForms,
  values: Record<string, string | number> = {},
): string {
  const exact = n === 0 ? forms["=0"] : n === 1 ? forms["=1"] : undefined;
  const template = exact ?? forms[pluralCategory(language, n)] ?? forms.other;
  const all: Record<string, string | number> = { n, ...values };
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in all ? String(all[key]) : match,
  );
}

/** True for a `PluralForms` object, as opposed to a plain string or a group of messages. */
export function isPluralForms(value: unknown): value is PluralForms {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return (
    typeof (value as { other?: unknown }).other === "string" &&
    entries.every(([key, form]) => PLURAL_KEYS.has(key) && typeof form === "string")
  );
}

/**
 * The categories a language uses for whole numbers up to `upTo`: what a translator must write
 * unless the message is invariant. Fractions ("other" in Ukrainian) and millions ("many" in
 * Italian, French, Spanish) never reach the interface, so they are not required.
 */
export function integerCategories(language: string, upTo = 1000): PluralCategory[] {
  const found = new Set<PluralCategory>();
  for (let n = 0; n <= upTo; n++) found.add(pluralCategory(language, n));
  return [...found];
}
