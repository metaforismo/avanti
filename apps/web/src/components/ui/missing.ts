import type { Tone } from "@/lib/console/labels";

/**
 * The colour of a required document that is still missing, one per audience (DESIGN.md,
 * «Documento mancante»). For the operator it is a blocker of the case: `danger`. For the citizen
 * it is a step still to take, not their mistake: `warn`. Pictures of the product on the site
 * follow the area they show (the dossier in the hero is the operator's, so `danger`).
 */
export const MISSING: Record<
  "operator" | "citizen",
  { tone: Tone; text: string; wash: string; dot: string }
> = {
  operator: {
    tone: "danger",
    text: "text-danger",
    wash: "bg-danger-wash",
    dot: "bg-danger",
  },
  citizen: {
    tone: "warn",
    text: "text-warn",
    wash: "bg-warn-wash",
    dot: "bg-warn",
  },
};
