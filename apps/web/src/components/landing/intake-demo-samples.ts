/**
 * The stories animated on the homepage. The backend tests the same sentences
 * (`@avanti/core/demo-stories`), so the page never promises what extraction can't do.
 */

export type Segment = string | { text: string; fact: number };

export type Sample = {
  lang: string;
  label: string;
  dir: "ltr" | "rtl";
  segments: Segment[];
};

export const SAMPLES: Sample[] = [
  {
    lang: "it",
    label: "Italiano",
    dir: "ltr",
    segments: [
      "Devo ",
      { text: "fare l'ISEE", fact: 0 },
      ", ",
      { text: "vivo con mia madre", fact: 1 },
      ", ",
      { text: "mio padre non vive con noi", fact: 2 },
      ", ho ",
      { text: "un conto Fineco", fact: 3 },
      " e ",
      { text: "una macchina", fact: 4 },
      ".",
    ],
  },
  {
    lang: "bn",
    label: "বাংলা",
    dir: "ltr",
    segments: [
      "আমাকে ",
      { text: "ISEE করতে হবে", fact: 0 },
      ", আমি ",
      { text: "আমার মায়ের সাথে থাকি", fact: 1 },
      ", ",
      { text: "আমার বাবা আমাদের সাথে থাকেন না", fact: 2 },
      ", আমার ",
      { text: "একটি Fineco অ্যাকাউন্ট", fact: 3 },
      " আর ",
      { text: "একটি গাড়ি", fact: 4 },
      " আছে।",
    ],
  },
  {
    lang: "ar",
    label: "العربية",
    dir: "rtl",
    segments: [
      "أحتاج إلى ",
      { text: "عمل الـ ISEE", fact: 0 },
      "، ",
      { text: "أعيش مع أمي", fact: 1 },
      "، و",
      { text: "أبي لا يعيش معنا", fact: 2 },
      "، لدي ",
      { text: "حساب في Fineco", fact: 3 },
      " و",
      { text: "سيارة", fact: 4 },
      ".",
    ],
  },
  {
    lang: "uk",
    label: "Українська",
    dir: "ltr",
    segments: [
      "Мені потрібно ",
      { text: "зробити ISEE", fact: 0 },
      ", я ",
      { text: "живу з мамою", fact: 1 },
      ", ",
      { text: "тато з нами не живе", fact: 2 },
      ", у мене є ",
      { text: "рахунок у Fineco", fact: 3 },
      " і ",
      { text: "машина", fact: 4 },
      ".",
    ],
  },
  {
    lang: "en",
    label: "English",
    dir: "ltr",
    segments: [
      "I need to ",
      { text: "do the ISEE", fact: 0 },
      ". I ",
      { text: "live with my mother", fact: 1 },
      ", ",
      { text: "my father doesn't live with us", fact: 2 },
      ", I have ",
      { text: "a Fineco account", fact: 3 },
      " and ",
      { text: "a car", fact: 4 },
      ".",
    ],
  },
];

export const sampleText = (sample: Sample) =>
  sample.segments.map((segment) => (typeof segment === "string" ? segment : segment.text)).join("");
