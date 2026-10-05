import { Suspense } from "react";
import { DossierView } from "@/components/console/dossier/dossier-view";

export default async function DossierPage({ params }: PageProps<"/console/pratiche/[id]">) {
  const { id } = await params;
  return (
    <Suspense>
      <DossierView caseId={id} />
    </Suspense>
  );
}
