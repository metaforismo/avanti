import { eq } from "drizzle-orm";
import { cases, type Database } from "@avanti/db";
import {
  DeleteOwnCaseRequest,
  Id,
  type AssistantTurn,
  type CitizenCase,
  type DocumentSummary,
} from "@avanti/contracts";
import { renewalConsentEvidence } from "@avanti/core";
import { eraseCase } from "./case-erasure";
import { currentCitizenLink } from "./citizen-link";
import { body, parse, type App, type Services } from "./context";
import {
  audit,
  caseById,
  citizenView,
  loadViewData,
  mapAssistantTurns,
  type CaseRow,
} from "./dossier";
import { lockRenewalConsent, withdrawRenewalConsent } from "./renewal-consent";
import { administer } from "./routes/administration";
import { ApiFailure, hashBytes, sanitizeName } from "./security";
import { retryStorageDeletions } from "./storage-cleanup";
import { ArchiveIntegrityError, zipLength, zipStream, type ZipSource } from "./zip";

import { citizenMayDelete } from "./privacy-view";

export { citizenPrivacy } from "./privacy-view";

/** Names inside the citizen's copy: numbered so two files called «scan.jpg» both survive. */
export function citizenCopyNames(files: readonly Pick<DocumentSummary, "fileName" | "mimeType">[]) {
  const width = String(files.length).length;
  return files.map(
    (file, index) =>
      `documenti/${String(index + 1).padStart(Math.max(2, width), "0")}-${sanitizeName(file.fileName, file.mimeType)}`,
  );
}

/**
 * What the citizen gave or was told, nothing more: answers, household, contacts, the note sent
 * with the case, messages, the intake conversation and the assistant's, documents with their
 * automatic checks. Internal notes, the audit and other cases never enter the copy.
 */
export function citizenCopy(
  view: CitizenCase,
  now: Date,
  own: { citizenNote: string | null; assistant: readonly AssistantTurn[] },
) {
  return {
    format: "avanti-citizen-copy",
    version: 1,
    generatedAt: now.toISOString(),
    controller: { name: view.organization.name, office: view.office?.name ?? null },
    case: {
      reference: view.reference,
      practice: view.practice?.name ?? null,
      practiceYear: view.practiceYear ?? null,
      language: view.language,
      status: view.status,
      submittedAt: view.submittedAt,
      linkExpiresAt: view.expiresAt,
      deleteBy: view.privacy?.deleteBy ?? null,
      renewalContactConsent: view.renewalContactConsent ?? false,
    },
    contact: view.contact,
    citizenNote: own.citizenNote,
    answers: view.answered.map(({ question, answer, section }) => ({ section, question, answer })),
    household: view.household,
    documents: view.documents.map((document, index) => ({
      file: citizenCopyNames(view.documents)[index],
      originalName: document.fileName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      uploadedAt: document.uploadedAt,
      checklistItem:
        view.checklist.find((item) => item.id === document.checklistItemId)?.title ?? null,
      status: document.status,
      analysis: document.analysis,
      rejectedAt: document.rejectedAt ?? null,
    })),
    messages: view.messages.map(({ role, text, createdAt }) => ({ role, text, createdAt })),
    conversation: (view.conversation?.turns ?? []).map(({ role, text, createdAt }) => ({
      role,
      text,
      createdAt,
    })),
    assistant: own.assistant.map(({ role, text, createdAt }) => ({ role, text, createdAt })),
  };
}

function attachment(reference: string) {
  return `attachment; filename="avanti-${reference.replace(/[^A-Za-z0-9-]/g, "")}.zip"`;
}

async function lockOwnCase(tx: Database, authorized: CaseRow, now: Date) {
  // Tenant before case, as retention and renewal withdrawal do.
  await lockRenewalConsent(tx, authorized);
  return currentCitizenLink(tx, authorized, now, true);
}

export function mountCitizenPrivacy(app: App, s: Services) {
  // Art. 15(3) and 20: a copy in a common, machine-readable format, with the files as sent.
  // Built while it is sent and never stored, like the operator's archive.
  app.get("/c/:token/export", async (c) => {
    const row = c.get("citizen");
    const now = s.clock();
    const data = await loadViewData(s.db, row, now);
    const view = await citizenView(s.db, row, now, row.language, false, data);
    const json = new TextEncoder().encode(
      `${JSON.stringify(
        citizenCopy(view, now, {
          citizenNote: row.citizenNote,
          assistant: mapAssistantTurns(data.chat.filter((m) => m.kind === "citizen_assistant")),
        }),
        null,
        2,
      )}\n`,
    );
    const stored = new Map(data.storedDocs.map((document) => [document.id, document]));
    const names = citizenCopyNames(view.documents);
    const sources: ZipSource[] = [
      { name: "dati.json", modified: now, size: json.length, read: async () => json },
      ...view.documents.map((summary, index): ZipSource => {
        const document = stored.get(summary.id)!;
        return {
          name: names[index]!,
          modified: new Date(document.uploadedAt),
          size: document.sizeBytes,
          read: async (signal) => {
            try {
              const bytes = await s.storage.get(document.storageKey, signal);
              if (bytes.length !== document.sizeBytes || hashBytes(bytes) !== document.sha256)
                throw new ArchiveIntegrityError("Stored file differs from the recorded one");
              return bytes;
            } catch (error) {
              (s.storageLogger ?? console.error)({
                op: "citizen_export",
                caseId: row.id,
                documentId: document.id,
                errorName: error instanceof Error ? error.name : "Error",
              });
              throw error;
            }
          },
        };
      }),
    ];
    c.header("Content-Type", "application/zip");
    c.header("Content-Disposition", attachment(row.reference));
    c.header("Content-Length", String(zipLength(sources)));
    c.header("Cache-Control", "no-store");
    c.header("X-Content-Type-Options", "nosniff");
    if (c.req.method === "HEAD") return c.body(null);
    await audit(s.db, row, "citizen", "citizen.data_exported", now, null, {
      documents: view.documents.length,
      bytes: view.documents.reduce((total, document) => total + document.sizeBytes, 0),
    });
    return c.body(zipStream(sources));
  });

  app.delete("/c/:token", async (c) => {
    await body(c, DeleteOwnCaseRequest);
    const authorized = c.get("citizen");
    await s.db.transaction(async (tx) => {
      const now = s.clock();
      const current = await lockOwnCase(tx, authorized, now);
      if (!(await citizenMayDelete(tx, current)))
        throw new ApiFailure(
          "conflict",
          409,
          "La pratica è già presso lo sportello: chiedi al CAF di cancellarla.",
        );
      await eraseCase(tx, current, now, "citizen");
    });
    c.set("citizenErased", true);
    await retryStorageDeletions(s, undefined, authorized.id);
    return c.body(null, 204);
  });

  app.post("/c/:token/erasure-request", async (c) => {
    const authorized = c.get("citizen");
    const row = await s.db.transaction(async (tx) => {
      const now = s.clock();
      const current = await lockOwnCase(tx, authorized, now);
      if (await citizenMayDelete(tx, current))
        throw new ApiFailure(
          "conflict",
          409,
          "La pratica non è ancora stata inviata: puoi cancellarla direttamente.",
        );
      if (current.erasureRequestedAt) return current;
      // Asking to be forgotten also withdraws the one consent the citizen gave (art. 7(3)):
      // no renewal invitation should reach someone waiting for their data to go.
      if (current.renewalContactConsentAt !== null) {
        await withdrawRenewalConsent(tx, current, now);
        await audit(tx, current, "citizen", "renewal.consent_updated", now, null, {
          consented: false,
          ...renewalConsentEvidence(current.language),
        });
      }
      // Not content: updatedAt (the concurrency version) and the near-ready version stay put.
      const [updated] = await tx
        .update(cases)
        .set({ erasureRequestedAt: now.toISOString() })
        .where(eq(cases.id, current.id))
        .returning();
      await audit(tx, current, "citizen", "citizen.erasure_requested", now);
      return updated!;
    });
    return c.json(await citizenView(s.db, row, s.clock()));
  });

  // The CAF keeps the case (a legal duty to retain it, an identity it could not verify) and has
  // told the citizen why, as art. 12(4) requires: the request leaves the queue. Erasing instead
  // goes through DELETE /cases/:id or family-erasure, which remove the flag with the case.
  app.delete("/cases/:id/erasure-request", async (c) => {
    const actor = c.get("operator");
    const id = parse(Id, c.req.param("id"));
    await administer(s, c, async (tx) => {
      const row = await caseById(tx, id, actor.organizationId, true);
      if (!row.erasureRequestedAt) return;
      await tx.update(cases).set({ erasureRequestedAt: null }).where(eq(cases.id, row.id));
      await audit(tx, row, "operator", "case.erasure_declined", s.clock(), actor.id);
    });
    return c.body(null, 204);
  });
}
