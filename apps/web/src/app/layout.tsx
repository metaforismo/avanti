import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_APP_URL ?? "http://localhost:3400"),
  title: {
    default: "Avanti — il front office AI per CAF e patronati",
    template: "%s · Avanti",
  },
  description:
    "Il cittadino racconta cosa deve fare, nella sua lingua. Avanti prepara checklist, controlla i documenti e consegna all'operatore un fascicolo pronto.",
  applicationName: "Avanti",
  openGraph: { type: "website", locale: "it_IT", siteName: "Avanti" },
};

export const viewport: Viewport = {
  themeColor: "#f7f8f6",
  width: "device-width",
  initialScale: 1,
  // Lets env(safe-area-inset-*) work for the fixed bars on notched phones.
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={fontVariables}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
