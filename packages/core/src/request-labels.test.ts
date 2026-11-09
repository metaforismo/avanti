import { describe, expect, it } from "vitest";
import { ownerSuffix, requestLabel, splitRequestLabels, withRequestLabels } from "./request-labels";

type Item = { id: string; title: string; memberName: string | null; status: string };
const item = (id: string, title: string, memberName: string | null = null, status = "missing") =>
  ({ id, title, memberName, status }) satisfies Item;

const checklist = [
  item("a", "Documento d'identità", "Maria"),
  item("b", "Documento d'identità", "Luca"),
  item("c", "Contratto d'affitto"),
];

describe("request labels", () => {
  it("reads back what the console writes", () => {
    const text = withRequestLabels("La foto è sfocata.", [checklist[2]!, checklist[1]!]);
    expect(text).toBe("La foto è sfocata.\nContratto d'affitto\nDocumento d'identità · Luca");
    const { body, items } = splitRequestLabels(text, checklist);
    expect(body).toBe("La foto è sfocata.");
    expect(items.map((i) => i.id)).toEqual(["c", "b"]);
  });

  it("writes only the items when there is no message", () => {
    expect(withRequestLabels("", [checklist[2]!])).toBe("Contratto d'affitto");
    expect(splitRequestLabels("Contratto d'affitto", checklist)).toEqual({
      body: "",
      items: [checklist[2]],
    });
  });

  it("keeps a message that names no item as it is", () => {
    expect(splitRequestLabels("Passa allo sportello.\nGrazie", checklist)).toEqual({
      body: "Passa allo sportello.\nGrazie",
      items: [],
    });
  });

  it("does not take an item named in the middle of the message", () => {
    const text = "Contratto d'affitto\nmanca la seconda pagina";
    expect(splitRequestLabels(text, checklist)).toEqual({ body: text, items: [] });
  });

  it("gives two relatives with the same name a card each, the rejected one first", () => {
    const twins = [
      item("x", "Documento d'identità", "Ana"),
      item("y", "Documento d'identità", "Ana", "rejected"),
    ];
    const label = requestLabel(twins[0]!);
    const one = splitRequestLabels(`Rifalla.\n${label}`, twins, (i) => i.status === "rejected");
    expect(one.items.map((i) => i.id)).toEqual(["y"]);
    const both = splitRequestLabels(`Rifalle.\n${label}\n${label}`, twins);
    expect(both.items.map((i) => i.id).sort()).toEqual(["x", "y"]);
    expect(both.body).toBe("Rifalle.");
    // A third line with the same name has no item left: it stays text.
    const three = splitRequestLabels(`${label}\n${label}\n${label}`, twins);
    expect(three.items).toHaveLength(2);
    expect(three.body).toBe(label);
  });
});

describe("owner suffix", () => {
  it("names the person once when the title already ends with them", () => {
    const account = item("d", "Saldo al 31/12/2025 e dati del rapporto · Prova", "Prova");
    expect(ownerSuffix(account)).toBeNull();
    expect(requestLabel(account)).toBe("Saldo al 31/12/2025 e dati del rapporto · Prova");
    expect(ownerSuffix(item("e", "Giacenza media 2025 · prova ", " PROVA"))).toBeNull();
  });

  it("keeps the person when the title names something else or only contains the name", () => {
    expect(ownerSuffix(item("f", "Saldo · Fineco", "Maria"))).toBe("Maria");
    // A word inside the title is not the bank segment: «Maria» stays.
    expect(ownerSuffix(item("g", "Visura Santa Maria · Fineco", "Maria"))).toBe("Maria");
    expect(ownerSuffix(item("h", "Documento d'identità", "  "))).toBeNull();
    expect(ownerSuffix(item("i", "Documento d'identità", null))).toBeNull();
  });

  it("reads back a request whose item already names its owner", () => {
    const account = item("d", "Saldo · Prova", "Prova");
    const text = withRequestLabels("Manca il saldo.", [account]);
    expect(text).toBe("Manca il saldo.\nSaldo · Prova");
    expect(splitRequestLabels(text, [account]).items).toEqual([account]);
  });
});
