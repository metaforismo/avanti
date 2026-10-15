import type { Metadata } from "next";
import { OfficePoster } from "@/components/console/office-poster";
import { EditorialType } from "@/components/brand/editorial-type";

export const metadata: Metadata = { title: "Cartello sportello", robots: { index: false } };

export default async function PosterPage({ params }: PageProps<"/stampa/[office]">) {
  const { office } = await params;
  return (
    <EditorialType>
      <OfficePoster officeSlug={office} />
    </EditorialType>
  );
}
