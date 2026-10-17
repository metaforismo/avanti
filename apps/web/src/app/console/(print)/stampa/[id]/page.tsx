import type { Metadata } from "next";
import { PlainType } from "@/components/brand/plain-type";
import { CitizenChecklistSheet } from "@/components/console/citizen-checklist-sheet";

export const metadata: Metadata = {
  title: "Documenti da portare · Console Avanti",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Outside the console shell: the page is the sheet, ready for the printer. */
export default async function ChecklistPrintPage({ params }: PageProps<"/console/stampa/[id]">) {
  const { id } = await params;
  return (
    <PlainType>
      <CitizenChecklistSheet caseId={id} />
    </PlainType>
  );
}
