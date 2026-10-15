import { app } from "@avanti/api";
import type { Metadata } from "next";
import { PlainType } from "@/components/brand/plain-type";
import { OfficeStart, type OfficeInfo } from "@/components/citizen/office-start";

export const metadata: Metadata = {
  title: "Prepara la tua pratica",
  robots: { index: false },
  referrer: "no-referrer",
};

/**
 * The office is read with the page so its name is in the first paint: people arrive from the
 * waiting-room QR, often on a slow connection. Any failure falls back to the client fetch.
 */
async function loadOffice(slug: string): Promise<OfficeInfo | "missing" | null> {
  try {
    const response = await app.request(`/api/offices/${encodeURIComponent(slug)}`);
    if (response.status === 404) return "missing";
    return response.ok ? ((await response.json()) as OfficeInfo) : null;
  } catch {
    return null;
  }
}

export default async function OfficePage({ params }: PageProps<"/s/[office]">) {
  const { office } = await params;
  return (
    <PlainType>
      <OfficeStart officeSlug={office} initial={await loadOffice(office)} />
    </PlainType>
  );
}
