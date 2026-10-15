import {
  Atkinson_Hyperlegible_Mono,
  Atkinson_Hyperlegible_Next,
  Noto_Sans_Arabic,
  Noto_Sans_Bengali,
} from "next/font/google";

// Atkinson Hyperlegible was designed for low-vision readers: our citizens include elderly
// people and non-native speakers, so legibility beats fashion for body copy.
export const body = Atkinson_Hyperlegible_Next({
  subsets: ["latin", "latin-ext"],
  variable: "--font-body",
  display: "swap",
  // Next has no metric overrides for Atkinson yet; skip the (failing) fallback generation.
  adjustFontFallback: false,
});

// Used for codes and keys only, never above the fold: not worth a preload on every page.
export const code = Atkinson_Hyperlegible_Mono({
  subsets: ["latin"],
  variable: "--font-code",
  preload: false,
  display: "swap",
  adjustFontFallback: false,
});

// Script fonts are not preloaded and globals.css applies them only under :lang(bn) / :lang(ar),
// by their literal names: their variables also carry a generated fallback face (local Arial,
// every code point) that would draw Arabic before Noto Sans Arabic is reached.
export const bengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-bengali",
  preload: false,
  display: "swap",
});

export const arabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  preload: false,
  display: "swap",
});

// The display face is set per area: see components/brand/editorial-type.tsx.
export const fontVariables = [body, code, bengali, arabic].map((f) => f.variable).join(" ");
