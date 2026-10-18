import { Bricolage_Grotesque } from "next/font/google";
import type { ReactNode } from "react";

/*
 * Citizen pages: weight axis only (40 KB, see editorial-type.tsx). Their headings are small and
 * never condensed, and a phone on a weak connection should spend its bytes on the form.
 */
const plain = Bricolage_Grotesque({
  // Preloads Latin only; latin-ext stays available on demand (see lib/fonts.ts).
  subsets: ["latin"],
  variable: "--font-display-face",
  display: "swap",
});

/** Sets the plain display face for a subtree without adding a box. */
export function PlainType({ children }: { children: ReactNode }) {
  return <div className={`${plain.variable} contents`}>{children}</div>;
}
