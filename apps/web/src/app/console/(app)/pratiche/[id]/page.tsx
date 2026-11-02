import { DossierView } from "@/components/console/dossier/dossier-view";

// No Suspense boundary here: the dossier code loads on navigation, and React holds a revealed
// boundary back by ~300 ms. Without one, the queue stays on screen until the case is ready.
export default async function DossierPage({ params }: PageProps<"/console/pratiche/[id]">) {
  const { id } = await params;
  // Keyed: «Prossima pratica» and ⌘K go from case to case on this route, and nothing typed,
  // pending or open on one case may carry over to the next.
  return <DossierView key={id} caseId={id} />;
}
