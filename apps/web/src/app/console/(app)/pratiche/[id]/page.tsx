import { DossierView } from "@/components/console/dossier/dossier-view";

export default async function DossierPage({ params }: PageProps<"/console/pratiche/[id]">) {
  const { id } = await params;
  return <DossierView caseId={id} />;
}
