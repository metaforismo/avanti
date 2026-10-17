import type { Metadata } from "next";
import { preload } from "react-dom";
import { CitizenApp } from "@/components/citizen/citizen-app";
import { PlainType } from "@/components/brand/plain-type";
import { casePath } from "@/lib/citizen/case-path";

// The token in the URL is a capability: never leak it via Referer or indexing.
export const metadata: Metadata = {
  title: "La tua pratica",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function CasePage({ params }: PageProps<"/pratica/[token]">) {
  const { token } = await params;
  // The case is fetched by the client: let the browser start it with the scripts instead of
  // after them, which saves a round trip on a slow phone. useCitizenCase's first fetch reuses
  // this response (same URL, mode and credentials), so the API still sees a single read.
  preload(casePath(token), { as: "fetch", crossOrigin: "anonymous" });
  return (
    <PlainType>
      <CitizenApp token={token} />
    </PlainType>
  );
}
