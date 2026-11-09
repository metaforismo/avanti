import { describe, expect, it } from "vitest";
import type { PracticeSummary } from "@avanti/contracts";
import { candidatePractices } from "./candidates";

const practice = (id: PracticeSummary["id"], availability: PracticeSummary["availability"]) =>
  ({
    id,
    availability,
    name: id,
    description: "",
    category: "assistenza",
    referenceYear: null,
    estimatedMinutes: 10,
  }) as PracticeSummary;

const catalog = [
  practice("isee_ordinario", "available"),
  practice("modello_730", "beta"),
  practice("assegno_unico", "available"),
  practice("permesso_soggiorno", "available"),
  practice("naspi", "coming_soon"),
];

describe("candidatePractices", () => {
  it("offers the practices the story names, in the order it names them", () => {
    const ids = candidatePractices(
      "Mi serve l’assegno unico e quindi l’ISEE, vivo con mia moglie",
      catalog,
    ).map((p) => p.id);
    expect(ids).toEqual(["assegno_unico", "isee_ordinario"]);
  });

  it("fills up to four with what can be started when the story names one or none", () => {
    expect(candidatePractices("ISEE per favore", catalog).map((p) => p.id)).toEqual([
      "isee_ordinario",
      "modello_730",
      "assegno_unico",
      "permesso_soggiorno",
    ]);
    // A practice not startable yet is never offered, even when named.
    expect(candidatePractices("naspi", catalog).map((p) => p.id)).not.toContain("naspi");
  });
});
