import {
  Atkinson_Hyperlegible_Mono,
  Atkinson_Hyperlegible_Next,
  Bricolage_Grotesque,
  Noto_Sans_Arabic,
  Noto_Sans_Bengali,
} from "next/font/google";

// Atkinson Hyperlegible was designed for low-vision readers: our citizens include elderly
// people and non-native speakers, so legibility beats fashion for body copy.
export const body = Atkinson_Hyperlegible_Next({
  subsets: ["latin", "latin-ext"],
  variable: "--font-body",
  display: "swap",
});

export const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display-face",
  axes: ["opsz", "wdth"],
  display: "swap",
});

export const code = Atkinson_Hyperlegible_Mono({
  subsets: ["latin"],
  variable: "--font-code",
  display: "swap",
});

// Script fallbacks are not preloaded: unicode-range means they download only when a page
// actually renders Bengali or Arabic text.
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

export const fontVariables = [body, display, code, bengali, arabic]
  .map((f) => f.variable)
  .join(" ");
