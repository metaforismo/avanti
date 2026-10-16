import { readFile, writeFile } from "node:fs/promises";
import { format, resolveConfig } from "prettier";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

// An institutional link proves provenance, not relevance. Only reviewed practice guidance
// belongs here: never auto-admit new research files or new sections (market, GTM,
// demographics, project decisions and implementation notes are not operator guidance).
// Section titles are editorial labels, deliberately independent of internal research titles.
export const KNOWLEDGE_POLICY = {
  "isee-2027.md": {
    title: "ISEE ordinario 2027",
    practiceIds: ["isee_ordinario", "isee_universitario"],
    sections: {
      "Versione e anni": "Modello e anni di riferimento",
      "Nucleo e patrimonio": "Nucleo e patrimonio",
      "Conti cointestati: saldo e giacenza media": "Conti cointestati: saldo e giacenza media",
      "Raccolta documentale condizionata": "Documenti da raccogliere",
      "Casi che richiedono verifica dell'operatore": "Casi da verificare con il CAF",
      "Esclusione di 50.000 euro e novità 2026": "Esclusioni e prestazioni familiari",
      "Istruzioni di caricamento (revisione backend PR #3)":
        "Attestazioni bancarie e copie dei documenti",
    },
  },
  "isee-universita.md": {
    title: "ISEE per l’università",
    practiceIds: ["isee_ordinario", "isee_universitario"],
    // Exclude implementation decisions and mixed commercial/institutional bank research.
    sections: { "Fonti ufficiali e percorso": "Moduli, genitori e autonomia dello studente" },
  },
  "assegno-unico.md": {
    title: "Assegno unico: documenti e verifiche",
    practiceIds: ["assegno_unico"],
    sections: { "": "" },
  },
  "modello-730.md": {
    title: "Modello 730: documenti e verifiche",
    practiceIds: ["modello_730"],
    // Keep each expense topic beside its own official source, rather than citing the CU page.
    sections: {
      "": "",
      "Spese da valutare": "Spese da valutare",
      "Spese sanitarie e pagamenti": "Spese sanitarie e pagamenti",
    },
  },
  "permesso-soggiorno.md": {
    title: "Permesso di soggiorno: documenti e canali",
    practiceIds: ["permesso_soggiorno"],
    sections: { "": "" },
  },
  "dsu-prospetto.md": {
    title: "Prospetto DSU",
    practiceIds: ["isee_ordinario", "isee_universitario"],
    // The sourced overview explains model limits; the other sections map internal fields
    // and contracts, with no self-contained official citations, so are not normative excerpts.
    sections: { "Modello verificato e aggiornamenti": "Modelli e limiti dei quadri DSU" },
  },
  "intake-safety-1522.md": {
    title: "Sicurezza e orientamento ai servizi pubblici",
    practiceIds: [],
    // Public service information is useful at the desk; classifier/audit details are not.
    sections: { "Servizio pubblico 1522": "Numero antiviolenza e antistalking 1522" },
  },
};
export const INTERNAL_TITLE =
  /\b(?:PR|revision[ei]|backend|frontend|pilot[ai-o]|beta|implementativ\w*|coming_soon|market|competitor\w*|gtm)\b/i;
const root = new URL("../../../docs/research/", import.meta.url);
const official = (host) =>
  [
    "inps.it",
    "agenziaentrate.gov.it",
    "lavoro.gov.it",
    "interno.gov.it",
    "gazzettaufficiale.it",
    "normattiva.it",
    "pariopportunita.gov.it",
    "portaleimmigrazione.it",
  ].some((d) => host === d || host.endsWith("." + d));
const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

function prose(section) {
  return (
    section
      .replace(/^#{1,6} .+(?:\n|$)/gm, "")
      // A source-only line is metadata, never an answer paragraph. Inline links in a
      // sentence retain their label; all source URLs remain available in citations.
      .split("\n")
      .filter((line) => {
        const withoutLinks = line.replace(linkPattern, "").replace(/[\s.,;:()\d–—-]/g, "");
        return !/^(?:e)?$/.test(withoutLinks) || !line.match(linkPattern);
      })
      .join("\n")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\*\*/g, "")
      // Join Markdown soft wraps; preserve paragraphs, tables and list-item boundaries.
      .replace(/([^\n])\n(?!\n|\s*[-*|\d])/g, "$1 ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

export function buildKnowledge(documents) {
  const chunks = [];
  for (const file of Object.keys(KNOWLEDGE_POLICY).sort()) {
    const policy = KNOWLEDGE_POLICY[file];
    const md = documents[file];
    if (typeof md !== "string") throw new Error(`Missing approved knowledge file: ${file}`);
    const sections = new Map(
      md.split(/(?=^## )/m).map((section) => [section.match(/^## (.+)/m)?.[1] ?? "", section]),
    );
    for (const [heading, label] of Object.entries(policy.sections)) {
      const section = sections.get(heading);
      if (!section) throw new Error(`Missing approved knowledge section: ${file}#${heading}`);
      const title = label ? `${policy.title} — ${label}` : policy.title;
      if (INTERNAL_TITLE.test(title)) throw new Error(`Internal knowledge title: ${title}`);
      const links = [...section.matchAll(linkPattern)].map((m) => ({ source: m[1], url: m[2] }));
      // Fail closed if a reviewed section loses provenance or gains a commercial source.
      if (!links.length || links.some((s) => !official(new URL(s.url).hostname)))
        throw new Error(`Invalid official provenance: ${file}#${heading}`);
      const sources = [...new Map(links.map((s) => [s.url, s])).values()];
      const text = prose(section);
      const sectionId = createHash("sha256")
        .update(file + "#" + (heading || md.match(/^# (.+)/m)?.[1]))
        .digest("hex")
        .slice(0, 12);
      const parts = [];
      let part = "";
      // Keep complete paragraphs together, including wrapped sentences and source context.
      for (const paragraph of text.split(/\n\n/)) {
        if (part.length + paragraph.length > 2800 && part) {
          parts.push(part);
          part = "";
        }
        part += (part ? "\n\n" : "") + paragraph;
      }
      if (part) parts.push(part);
      parts.forEach((text, n) =>
        chunks.push({
          id: `kb:${sectionId}:${n}`,
          title,
          source: sources
            .map((s) => s.source)
            .join("; ")
            .slice(0, 500),
          url: sources[0].url,
          sources,
          file,
          practiceIds: policy.practiceIds,
          text,
        }),
      );
    }
  }
  return chunks;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const documents = Object.fromEntries(
    await Promise.all(
      Object.keys(KNOWLEDGE_POLICY).map(async (file) => [
        file,
        await readFile(new URL(file, root), "utf8"),
      ]),
    ),
  );
  const chunks = buildKnowledge(documents);
  const version = createHash("sha256").update(JSON.stringify(chunks)).digest("hex").slice(0, 16);
  const output = new URL("../src/knowledge-data.ts", import.meta.url);
  await writeFile(
    output,
    await format(
      `// Generated by scripts/build-knowledge.mjs from explicitly approved research sections.\nexport const KNOWLEDGE_VERSION = ${JSON.stringify(version)};\nexport const knowledgeChunks = ${JSON.stringify(chunks, null, 2)};\n`,
      { ...(await resolveConfig(fileURLToPath(output))), parser: "typescript" },
    ),
  );
  console.log(JSON.stringify({ version, chunks: chunks.length }));
}
