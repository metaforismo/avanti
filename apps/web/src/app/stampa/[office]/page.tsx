import type { Metadata } from "next";
import { OfficePoster } from "@/components/console/office-poster";

export const metadata: Metadata = { title: "Cartello sportello", robots: { index: false } };

export default async function PosterPage({ params }: PageProps<"/stampa/[office]">) {
  const { office } = await params;
  return <OfficePoster officeSlug={office} />;
}
