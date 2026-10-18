import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { expect, it } from "vitest";
import { Language } from "@avanti/contracts";

type Copy = { file: string; key: string; language: Language; text: string };
const languages = Language.options;
const token = (words: string) =>
  new RegExp(`(?<![\\p{L}\\p{M}])(?:${words})(?![\\p{L}\\p{M}])`, "u");
const forbidden: Partial<Record<Language, RegExp>> = {
  it: token(
    "[Ll]ei|[Ss]uo|[Ss]ua|[Ss]uoi|[Ss]ue|[Cc]arichi|[Ss]celga|[Ii]nserisca|[Cc]ompili|[Cc]ontatti|[Aa]vete|[Aa]vevate|possedevate|[Ss]iete",
  ),
  fr: token(
    "[Tt]u|[Tt]oi|[Tt]on|[Tt]a|[Tt]es|[Tt]e|[Cc]hoisis|[Aa]joute|[Ee]nvoie|[Tt]éléverse|[Rr]éponds|[Dd]emande|[Ii]ndique|[Pp]répare",
  ),
  es: token(
    "[Uu]sted|[Uu]stedes|[Ss]u|[Ss]us|[Cc]argue|[Ss]uba|[Ee]lija|[Ii]ndique|[Ii]ntroduzca|[Rr]esponda|[Cc]onsulte|[Tt]enían|[Tt]ienen|[Rr]ecibieron|[Pp]agaron|[Ss]ois",
  ),
  ro: token(
    "[Dd]umneavoastră|[Dd]vs|[Aa]veți|[Aa]veați|[Ss]unteți|[Aa]legeți|[Îî]ncărcați|[Ii]ndicați|[Cc]ontactați|[Ss]crieți|ați",
  ),
  uk: token(
    "[Тт]и|[Тт]ебе|[Тт]обі|[Тт]обою|[Тт]в[оі]\\p{L}*|ви|вас|вам|вами|ваш\\p{L}*|[Зз]авантаж|[Оо]бери|[Вв]ибери|[Вв]кажи|[Нн]апиши|[Зз]апитай",
  ),
  bn: token("তুমি|তোমার|তোমাকে|তোমাদের|তুই|তোর|করো|বলো|নাও|দাও|লেখো|জানাও"),
};
// These phrases describe two members together, rather than addressing the citizen formally.
// French nouns and third-person verbs, and Spanish third-person possessives, are scoped below.
const exceptions = [
  {
    language: "it",
    key: "texts.householdSpouseMinimum",
    text: "Hai detto che vivi con il tuo coniuge: siete almeno 2.",
    word: "siete",
  },
  {
    language: "ro",
    key: "texts.householdSpouseMinimum",
    text: "Ai spus că locuiești cu soțul sau soția: sunteți cel puțin 2.",
    word: "sunteți",
  },
  {
    language: "es",
    key: "texts.householdSpouseMinimum",
    text: "Has dicho que vives con tu cónyuge: sois al menos 2.",
    word: "sois",
  },
  ...[
    "extraPrompts.existing",
    "messages.checklist.rejected",
    "messages.document.other_practice",
    "messages.practice.auu_review",
    "documentDetails.permit_current",
    "texts.iseeDescription",
    "texts.intakeScope",
    "texts.unavailablePractice",
    "texts.unavailable",
    "choosePractice.fr",
    "citizenCopyStyle.fr.application",
    "translationNotice.fr",
    "automaticAssistanceNotice.fr",
    "copy.fr.requestSubject",
    "copy.fr.request.=1",
    "copy.fr.request.other",
    "copy.fr.generic",
    "copy.scope",
    "copy.next",
    "copy.fr.ready",
  ].map((key) => ({ language: "fr", key, text: "*", word: "demande" })),
  { language: "fr", key: "copy.next", text: "*", word: "prépare" },
  { language: "fr", key: "documentDetails.parent", text: "*", word: "indique" },
  { language: "fr", key: "automaticAssistanceNotice.fr", text: "*", word: "prépare" },
  { language: "es", key: "messages.practice.parent_review", text: "*", word: "Su" },
  { language: "es", key: "messages.practice.joint_ownership", text: "*", word: "sus" },
] as const;

function registerMismatch(copy: Copy): string | null {
  const pattern = forbidden[copy.language];
  if (!pattern) return null;
  const words = copy.text.match(new RegExp(pattern.source, "gu")) ?? [];
  return (
    words.find(
      (word) =>
        !exceptions.some(
          (exception) =>
            exception.language === copy.language &&
            (exception.key === "*" || exception.key === copy.key) &&
            (exception.text === "*" || exception.text === copy.text) &&
            exception.word === word,
        ),
    ) ?? null
  );
}

function collectCopy(directory: URL): Copy[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) return collectCopy(url);
    // Input dictionaries and quoted citizen stories are not the backend's speaking voice.
    if (
      !entry.name.endsWith(".ts") ||
      entry.name.endsWith(".test.ts") ||
      entry.name.startsWith("extraction") ||
      entry.name === "demo-stories.ts"
    )
      return [];
    const file = fileURLToPath(url);
    const source = ts.createSourceFile(
      file,
      readFileSync(url, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const copy: Copy[] = [];
    function visit(node: ts.Node, language?: Language, key = "") {
      if (ts.isVariableDeclaration(node)) key = node.name.getText(source);
      if (ts.isPropertyAssignment(node)) {
        const name = node.name.getText(source).replaceAll('"', "");
        key = key ? `${key}.${name}` : name;
        if (languages.includes(name as Language)) language = name as Language;
      }
      if (
        ts.isArrayLiteralExpression(node) &&
        node.elements.length === languages.length &&
        node.elements.every(ts.isStringLiteral)
      ) {
        node.elements.forEach((text, index) => {
          if (ts.isStringLiteral(text))
            copy.push({ file, key, language: languages[index]!, text: text.text });
        });
        return;
      }
      if (ts.isNewExpression(node) && node.expression.getText(source) === "ApiFailure") {
        const message = node.arguments?.[2];
        if (message && ts.isStringLiteral(message))
          copy.push({ file, key: "ApiFailure", language: "it", text: message.text });
      }
      if (ts.isStringLiteral(node) && language) copy.push({ file, key, language, text: node.text });
      ts.forEachChild(node, (child) => visit(child, language, key));
    }
    visit(source);
    return copy;
  });
}

const copy = [
  ...collectCopy(new URL("../../core/src/", import.meta.url)),
  ...collectCopy(new URL("../../db/src/", import.meta.url)),
  ...collectCopy(new URL("./", import.meta.url)),
];
for (const language of languages) {
  it(`${language}: citizen copy uses the agreed register`, () => {
    const localized = copy.filter((entry) => entry.language === language);
    expect(localized.length).toBeGreaterThan(0);
    expect(
      localized.flatMap((entry) => {
        const word = registerMismatch(entry);
        return word ? [`${entry.file} ${entry.key}: ${word} in ${entry.text}`] : [];
      }),
    ).toEqual([]);
  });
}
it("detects register drift and limits plural exceptions to the approved phrases", () => {
  for (const [language, text] of [
    ["it", "Carichi il documento"],
    ["es", "Suba su documento"],
    ["ro", "Încărcați documentul"],
    ["fr", "Choisis ton document"],
    ["uk", "Завантаж свій документ"],
    ["uk", "У вас є документ"],
    ["bn", "তোমার নথি দাও"],
  ] as const) {
    expect(registerMismatch({ file: "fixture", key: "fixture", language, text })).not.toBeNull();
  }
  expect(
    registerMismatch({
      file: "fixture",
      key: "texts.householdSpouseMinimum",
      language: "it",
      text: "Siete pronti a caricare?",
    }),
  ).not.toBeNull();
});
