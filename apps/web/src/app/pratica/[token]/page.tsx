import type { Metadata } from "next";
import { headers } from "next/headers";
import { preload } from "react-dom";
import { CitizenApp } from "@/components/citizen/citizen-app";
import { PlainType } from "@/components/brand/plain-type";
import { casePath, reusesFetchPreload } from "@/lib/citizen/case-path";

// The token in the URL is a capability: never leak it via Referer or indexing.
export const metadata: Metadata = {
  title: "La tua pratica",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function CasePage({ params }: PageProps<"/pratica/[token]">) {
  const { token } = await params;
  // The case is fetched by the client: let the browser start it with the scripts instead of
  // after them, which saves a round trip on a slow phone. In a Chromium production build the
  // app's first fetch reuses this response (same URL, mode and credentials), so the API sees a
  // single read; in development StrictMode runs the effect twice and the second one reads
  // again. Browsers that would download it twice get no preload (see reusesFetchPreload).
  if (reusesFetchPreload((await headers()).get("user-agent"))) {
    preload(casePath(token), { as: "fetch", crossOrigin: "anonymous" });
  }
  return (
    <PlainType>
      <CitizenApp token={token} />
    </PlainType>
  );
}
