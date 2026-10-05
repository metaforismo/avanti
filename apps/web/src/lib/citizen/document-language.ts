"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Language } from "@avanti/contracts";
import { LANGUAGES, RTL_LANGUAGES } from "@avanti/contracts/constants";

/** First supported language among the browser's preferences, Italian otherwise. */
export function browserLanguage(): Language {
  if (typeof navigator === "undefined") return "it";
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.slice(0, 2).toLowerCase();
    if ((LANGUAGES as readonly string[]).includes(base)) return base as Language;
  }
  return "it";
}

export const directionOf = (language: Language) =>
  RTL_LANGUAGES.includes(language) ? "rtl" : "ltr";

/**
 * Sets lang/dir on <html>, not just on a wrapper: screen readers, hyphenation, browser
 * translation and the scrollbar side all read the document element.
 */
export function useDocumentLanguage(language: Language) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = { lang: root.lang, dir: root.dir };
    root.lang = language;
    root.dir = directionOf(language);
    return () => {
      root.lang = previous.lang;
      root.dir = previous.dir;
    };
  }, [language]);
}

const noSubscribe = () => () => {};

/** Browser language without hydration mismatches: Italian on the server and during hydration. */
export function useBrowserLanguage(): Language {
  return useSyncExternalStore(noSubscribe, browserLanguage, () => "it");
}
