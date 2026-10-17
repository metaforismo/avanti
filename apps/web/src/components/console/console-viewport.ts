import type { Viewport } from "next";

/** The console follows the system theme: the browser bar matches the page in both. */
export const consoleViewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0e131d" },
  ],
};
