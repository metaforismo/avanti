import type { Metadata } from "next";
import { OfficeStart } from "@/components/citizen/office-start";

export const metadata: Metadata = {
  title: "Prepara la tua pratica",
  robots: { index: false },
  referrer: "no-referrer",
};

export default async function OfficePage({ params }: PageProps<"/s/[office]">) {
  const { office } = await params;
  return <OfficeStart officeSlug={office} />;
}
