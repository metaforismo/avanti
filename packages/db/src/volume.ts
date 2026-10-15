import { createHash } from "node:crypto";
import { CaseStatus, LANGUAGES, type AnswerValue } from "@avanti/contracts";
import { buildChecklist, buildHousehold, getQuestions } from "@avanti/core";
import { sql } from "drizzle-orm";
import type { Database } from "./client";
import { seedDemoOrganization } from "./demo";
import { assertDemoSeedAllowed } from "./seed-guard";
import { cases, documents, messages, checklistReviews, events } from "./schema";

export const VOLUME_NOW = "2027-01-15T12:00:00.000Z";
export const VOLUME_SEED = 202701;
export const volumeId = (n: number) => `volume-case-${String(n).padStart(7, "0")}`;
// These predictable capabilities are restricted to the same local demo guard as db:seed.
export const volumeToken = (n: number) =>
  createHash("sha256").update(`avanti-demo-volume:${VOLUME_SEED}:${n}`).digest("base64url");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export function volumeCasesArgument(args: string[]): number {
  const input = args[0] === "--" ? args.slice(1) : args;
  if (!input.length) return 5000;
  if (input.length !== 2 || input[0] !== "--cases" || !/^\d+$/.test(input[1]!))
    throw new Error("Usage: --cases N (1–100000)");
  const count = Number(input[1]);
  if (!Number.isSafeInteger(count) || count < 1 || count > 100000)
    throw new RangeError("cases must be between 1 and 100000");
  return count;
}

export async function seedVolume(db: Database, count = 5000) {
  assertDemoSeedAllowed();
  volumeCasesArgument(["--cases", String(count)]);
  await seedDemoOrganization(db, new Date(VOLUME_NOW));
  const started = performance.now();
  // One transaction per block bounds parameters and memory and makes interrupted runs resumable.
  for (let offset = 0; offset < count; offset += 100) {
    const caseRows: (typeof cases.$inferInsert)[] = [];
    const docs: (typeof documents.$inferInsert)[] = [];
    const chat: (typeof messages.$inferInsert)[] = [];
    const reviews: (typeof checklistReviews.$inferInsert)[] = [];
    const audit: (typeof events.$inferInsert)[] = [];
    for (let n = offset + 1; n <= Math.min(offset + 100, count); n++) {
      const id = volumeId(n);
      const status = CaseStatus.options[(n - 1) % 6]!;
      const language = LANGUAGES[(n * 7) % LANGUAGES.length]!;
      const created =
        Date.parse(VOLUME_NOW) -
        (1 + (parseInt(hash(`${VOLUME_SEED}:${n}`).slice(0, 8), 16) % 180)) * 86400000;
      const at = (minutes: number) => new Date(created + minutes * 60000).toISOString();
      const submittedAt = status === "intake" ? null : at(18 + (n % 40));
      const reviewed = !["intake", "submitted"].includes(status);
      const completed = ["ready", "closed"].includes(status);
      const reference = `VOL-2027-${String(n).padStart(7, "0")}`;
      const members = Array.from({ length: 1 + (n % 4) }, (_, j) => ({
        id: `volume-member-${n}-${j}`,
        firstName: j ? "Familiare" : "Persona",
        lastName: `Esempio ${n}`,
        role: j ? ("figlio" as const) : ("richiedente" as const),
        birthYear: j ? 2010 : 1980,
      }));
      const answers: Record<string, AnswerValue> = {
        household_count: members.length,
        members,
        accounts_count: 1 + (n % 2),
        properties_count: 0,
        vehicles_count: 0,
        housing: "hosted",
        disability: false,
        nonresident_parent: false,
        university: false,
        self_employed: false,
        foreign_income: false,
        foreign_assets: false,
        maintenance: false,
        exempt_income: false,
        excluded_savings: false,
      };
      for (let j = 0; j < Number(answers.accounts_count); j++) {
        answers[`account_bank_${j}`] = "Banca Esempio";
        answers[`account_type_${j}`] = "deposit";
        answers[`account_owner_${j}`] = members[0]!.id;
      }
      for (const member of members)
        answers[`income_present_${member.id}`] = member.role === "richiedente";
      // Keep the synthetic interviews complete when new yes/no catalogue questions are added.
      for (;;) {
        const unanswered = getQuestions("isee_ordinario", answers, "it").filter(
          (q) => !Object.hasOwn(answers, q.id),
        );
        if (!unanswered.length) break;
        for (const q of unanswered) {
          if (q.kind !== "yes_no") throw new Error(`Volume fixture missing ${q.id}`);
          answers[q.id] = false;
        }
      }
      const checklist = buildChecklist("isee_ordinario", answers, buildHousehold(answers), "it");
      const selected = completed ? checklist : checklist.slice(0, 3 + (n % 4));
      caseRows.push({
        id,
        organizationId: "demo-caf-milano",
        officeId: n % 2 ? "demo-office-centro" : "demo-office-loreto",
        tokenHash: hash(volumeToken(n)),
        reference,
        status,
        language,
        practiceId: "isee_ordinario",
        answers,
        contact: {
          firstName: "Persona",
          lastName: `Esempio ${n}`,
          email: `volume-${n}@example.invalid`,
        },
        citizenNote: "ESEMPIO sintetico",
        internalNotes: "DEMO volume: tempi simulati, nessun dato reale.",
        assigneeId: reviewed ? "demo-operator" : null,
        createdAt: at(0),
        updatedAt: at(180),
        submittedAt,
        reviewStartedAt: reviewed ? at(120) : null,
        reviewCompletedAt: completed ? at(130 + (n % 20)) : null,
        closedAt: status === "closed" ? at(180) : null,
        expiresAt: "2027-04-15T12:00:00.000Z",
        firstSubmissionComplete: submittedAt ? completed : null,
      });
      selected.forEach((item, j) => {
        docs.push({
          id: `${id}-doc-${j}`,
          caseId: id,
          fileName: `ESEMPIO-${item.requirementId}.pdf`,
          mimeType: "application/pdf",
          sizeBytes: 1024,
          pages: 1,
          storageKey: `volume-metadata-only/${id}/${j}`,
          sha256: hash(`${id}:${j}`),
          uploadedAt: at(5 + j),
          checklistItemId: item.id,
          memberId: item.memberId,
          status: "analyzed",
          analysis: {
            engine: "heuristic",
            detectedRequirementId: item.requirementId,
            detectedLabel: item.title,
            confidence: 0.8,
            ownerName: item.memberName,
            referenceYear: 2025,
            expiresOn: "2030-12-31",
            legible: true,
            pagesComplete: true,
            findings: [],
          },
        });
        if (completed)
          reviews.push({
            caseId: id,
            itemId: item.id,
            decision: "verified",
            operatorId: "demo-operator",
            reviewedAt: at(150),
          });
      });
      for (let j = 0; j < 6; j++)
        chat.push({
          id: `${id}-message-${j}`,
          caseId: id,
          role: j % 2 ? "assistant" : "citizen",
          text: "ESEMPIO: conversazione sintetica per il fascicolo ISEE.",
          createdAt: at(j),
        });
      const addEvent = (type: string, minute: number, operator = false) =>
        audit.push({
          id: `${id}-${type}`,
          caseId: id,
          caseReference: reference,
          organizationId: "demo-caf-milano",
          actor: operator ? "operator" : "citizen",
          actorId: operator ? "demo-operator" : null,
          type,
          at: at(minute),
          metadata: type === "review.completed" ? { durationMinutes: 10 + (n % 20) } : {},
        });
      addEvent("case.created", 0);
      if (submittedAt) addEvent("case.submitted", 18 + (n % 40));
      if (reviewed) addEvent("review.started", 120, true);
      if (status === "needs_citizen") addEvent("case.requested", 125, true);
      if (completed) addEvent("review.completed", 130 + (n % 20), true);
    }
    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(cases)
        .values(caseRows)
        .onConflictDoNothing()
        .returning({ id: cases.id });
      const createdIds = new Set(inserted.map((row) => row.id));
      if (!createdIds.size) return;
      // Re-running a seed must preserve edits and document removals in existing demo cases.
      const newDocs = docs.filter((row) => createdIds.has(row.caseId));
      const newReviews = reviews.filter((row) => createdIds.has(row.caseId));
      if (newDocs.length) await tx.insert(documents).values(newDocs);
      if (newReviews.length) await tx.insert(checklistReviews).values(newReviews);
      await tx.insert(messages).values(chat.filter((row) => createdIds.has(row.caseId)));
      await tx
        .insert(events)
        .values(audit.filter((row) => row.caseId && createdIds.has(row.caseId)));
    });
  }
  await db.execute(sql`analyze`);
  return {
    requested: count,
    seed: VOLUME_SEED,
    elapsedMs: Math.round(performance.now() - started),
  };
}
