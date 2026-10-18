import { Bricolage_Grotesque } from "next/font/google";
import type { ReactNode } from "react";

/*
 * The display face comes in two cuts, both behind --font-display-face, each in its own module:
 * Next preloads a font wherever its module is imported, so a page must never import the other.
 *
 * Site and console: optical size and width axes for the large, condensed headlines (128 KB).
 */
const editorial = Bricolage_Grotesque({
  // Preloads Latin only; latin-ext stays available on demand (see lib/fonts.ts).
  subsets: ["latin"],
  variable: "--font-display-face",
  axes: ["opsz", "wdth"],
  display: "swap",
});

/** Sets the editorial display face for a subtree without adding a box. */
export function EditorialType({ children }: { children: ReactNode }) {
  return <div className={`${editorial.variable} contents`}>{children}</div>;
}
