import { Id } from "@avanti/contracts";
import { documentArchiveName, documentArchivePlan } from "@avanti/core";
import { parse, type App, type Services } from "./context";
import { audit, caseById, citizenView, loadViewData } from "./dossier";
import { ApiFailure } from "./security";
import { zipStream } from "./zip";

function attachment(name: string) {
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  // The ASCII fallback carries no name: only browsers that read filename* see the person's.
  return `attachment; filename="documenti.zip"; filename*=UTF-8''${encoded}`;
}

export function mountDocumentArchive(app: App, s: Services) {
  // Every original of the case in one ZIP, named and ordered for the CAF's software. Built while
  // it is sent and never stored, so erasure and retention have nothing extra to delete.
  app.get("/cases/:id/documents/archive", async (c) => {
    const operator = c.get("operator");
    const row = await caseById(s.db, parse(Id, c.req.param("id")), operator.organizationId);
    const now = s.clock();
    const data = await loadViewData(s.db, row, now);
    const view = await citizenView(s.db, row, now, "it", true, data);
    const plan = documentArchivePlan(view.checklist, view.documents);
    if (!plan.entries.length)
      throw new ApiFailure(
        "not_found",
        404,
        "In questa pratica non ci sono documenti da scaricare.",
      );
    const keys = new Map(data.storedDocs.map((document) => [document.id, document.storageKey]));
    const citizen = {
      firstName: row.contact?.firstName ?? null,
      lastName: row.contact?.lastName ?? null,
    };
    // Recorded before the first byte: a download stopped halfway has still exposed files.
    await audit(s.db, row, "operator", "documents.archive_downloaded", now, operator.id, {
      documents: plan.entries.length,
      bytes: plan.totalBytes,
    });
    c.header("Content-Type", "application/zip");
    c.header("Content-Disposition", attachment(documentArchiveName(row.reference, citizen)));
    c.header("Cache-Control", "no-store");
    c.header("X-Content-Type-Options", "nosniff");
    return c.body(
      zipStream(
        plan.entries.map((entry) => ({
          name: entry.name,
          modified: new Date(entry.uploadedAt),
          read: async () => {
            try {
              return await s.storage.get(keys.get(entry.documentId)!);
            } catch (error) {
              (s.storageLogger ?? console.error)({
                op: "archive",
                caseId: row.id,
                documentId: entry.documentId,
                errorName: error instanceof Error ? error.name : "Error",
              });
              throw error;
            }
          },
        })),
      ),
    );
  });
}
