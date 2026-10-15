import { DossierView } from "@/components/console/dossier/dossier-view";

// No Suspense boundary here: the dossier code loads on navigation, and React holds a revealed
// boundary back by ~300 ms. Without one, the queue stays on screen until the case is ready.
export default async function DossierPage({ params }: PageProps<"/console/pratiche/[id]">) {
  const { id } = await params;
  return <DossierView caseId={id} />;
}
