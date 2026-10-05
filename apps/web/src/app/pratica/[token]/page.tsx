import type { Metadata } from "next";
import { CitizenApp } from "@/components/citizen/citizen-app";

// The token in the URL is a capability: never leak it via Referer or indexing.
export const metadata: Metadata = {
  title: "La tua pratica",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function CasePage({ params }: PageProps<"/pratica/[token]">) {
  const { token } = await params;
  return <CitizenApp token={token} />;
}
