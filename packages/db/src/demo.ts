import { assertDemoSeedAllowed } from "./seed-guard";
import { createHash, randomBytes, scrypt as scryptCallback } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MemberInput } from "@avanti/contracts";
import type {
  AnswerValue,
  CaseStatus,
  ChecklistItem,
  DocumentAnalysis,
  Language,
  Member,
} from "@avanti/contracts";
import { buildChecklist, buildHousehold, getQuestions } from "@avanti/core";
import { eq, ne } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Database } from "./client";
import { nextReference } from "./reference";
import {
  cases,
  checklistReviews,
  documents,
  events,
  messages,
  offices,
  operators,
  organizations,
  settings,
} from "./schema";

export const DEMO_PASSWORD = "DemoAvanti2027!";
const demoNotice: Record<Language, string> = {
  it: "Fascicolo ESEMPIO. Le persone e i documenti sono fittizi.",
  en: "SAMPLE case. The people and documents are made up.",
  fr: "Dossier EXEMPLE. Les personnes et les documents sont fictifs.",
  es: "Expediente de EJEMPLO. Las personas y los documentos son ficticios.",
  ro: "Dosar EXEMPLU. Persoanele și documentele sunt fictive.",
  uk: "Зразок справи. Люди та документи вигадані.",
  ar: "ملف تجريبي. الأشخاص والوثائق غير حقيقيين.",
  bn: "এটি একটি নমুনা ফাইল। এখানে মানুষ ও নথি কাল্পনিক।",
};

const demoIntegrationRequest: Record<Language, string> = {
  it: "ESEMPIO: porta al CAF la giacenza media 2025 del conto.",
  en: "SAMPLE: bring the account's average balance for 2025 (giacenza media) to the CAF.",
  fr: "EXEMPLE : apportez au CAF le solde moyen du compte en 2025 (giacenza media).",
  es: "EJEMPLO: lleva al CAF el saldo medio de la cuenta en 2025 (giacenza media).",
  ro: "EXEMPLU: adu la CAF soldul mediu al contului din 2025 (giacenza media).",
  uk: "ЗРАЗОК: принесіть до CAF середній баланс рахунку за 2025 рік (giacenza media).",
  ar: "مثال: أحضر إلى CAF متوسط رصيد الحساب لعام 2025 (giacenza media).",
  bn: "নমুনা: CAF-এ ২০২৫ সালের হিসাবের গড় ব্যালেন্স (giacenza media) আনুন।",
};

async function demoPasswordHash(): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      DEMO_PASSWORD,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, value) => {
        if (error) reject(error);
        else resolve(value);
      },
    );
  });
  return `scrypt:32768:8:1:${salt}:${derived.toString("hex")}`;
}

export interface DemoSeedOptions {
  now: Date;
  uploadsDir: string;
  buildHousehold?: (answers: Record<string, AnswerValue>) => Member[];
  buildChecklist?: (answers: Record<string, AnswerValue>, household: Member[]) => ChecklistItem[];
}

/** Shared local-only bootstrap; volume fixtures never need PDF bytes. */
export async function seedDemoOrganization(db: Database, now: Date): Promise<void> {
  assertDemoSeedAllowed();
  if (!Number.isFinite(now.getTime())) throw new RangeError("Invalid demo clock");
  const organizationId = "demo-caf-milano";
  const existing = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(ne(organizations.id, organizationId))
    .limit(1);
  if (existing.length) {
    throw new Error("Demo seed requires an empty database or the existing demo organization");
  }
  await db
    .insert(organizations)
    .values({ id: organizationId, name: "CAF Demo Milano", kind: "caf" })
    .onConflictDoNothing();
  await db
    .insert(settings)
    .values({ organizationId, baselineMinutesPerCase: 45, retentionDays: 180, linkDays: 60 })
    .onConflictDoNothing();
  await db
    .insert(offices)
    .values([
      {
        id: "demo-office-centro",
        organizationId,
        slug: "demo-milano-centro",
        name: "Milano Centro",
        address: "Via Esempio 10 (sportello fittizio)",
        city: "Milano",
        phone: "+39 02 00000000",
        openingHours: "Lun–Ven 09:00–13:00, 14:00–18:00",
      },
      {
        id: "demo-office-loreto",
        organizationId,
        slug: "demo-milano-loreto",
        name: "Milano Loreto",
        address: "Via Dimostrazione 20 (sportello fittizio)",
        city: "Milano",
        phone: "+39 02 00000001",
        openingHours: "Lun–Ven 09:00–17:00",
      },
    ])
    .onConflictDoNothing();
  const passwordHash = await demoPasswordHash();
  await db
    .insert(operators)
    .values([
      {
        id: "demo-admin",
        organizationId,
        name: "Amministratrice Demo",
        email: "admin@demo.avanti.local",
        passwordHash,
        role: "admin",
        createdAt: now.toISOString(),
      },
      {
        id: "demo-operator",
        organizationId,
        name: "Operatore Demo",
        email: "operatore@demo.avanti.local",
        passwordHash,
        role: "operator",
        createdAt: now.toISOString(),
      },
      {
        id: "demo-inactive-operator",
        organizationId,
        name: "Operatore Demo Disattivato",
        email: "disattivato@demo.avanti.local",
        passwordHash,
        role: "operator",
        active: false,
        createdAt: now.toISOString(),
      },
    ])
    .onConflictDoNothing();
}

export async function seedDemo(
  db: Database,
  options: DemoSeedOptions,
): Promise<{ created: number }> {
  assertDemoSeedAllowed();
  if (!Number.isFinite(options.now.getTime())) {
    throw new RangeError("Invalid demo clock");
  }
  await seedDemoOrganization(db, options.now);
  const organizationId = "demo-caf-milano";

  const statuses: readonly CaseStatus[] = [
    "intake",
    "submitted",
    "in_review",
    "needs_citizen",
    "ready",
    "closed",
    "intake",
    "submitted",
    "ready",
    "needs_citizen",
  ];
  const languages: readonly Language[] = [
    "it",
    "bn",
    "ar",
    "uk",
    "en",
    "fr",
    "es",
    "ro",
    "it",
    "bn",
  ];
  let created = 0;
  for (const [position, status] of statuses.entries()) {
    const id = `demo-case-${position + 1}`;
    if ((await db.select({ id: cases.id }).from(cases).where(eq(cases.id, id))).length) continue;
    const language = languages[position] ?? "it";
    const createdAt = new Date(options.now.getTime() - (10 - position) * 86_400_000).toISOString();
    const submittedAt =
      status === "intake"
        ? null
        : new Date(new Date(createdAt).getTime() + (18 + position) * 60_000).toISOString();
    const reviewed = ["in_review", "needs_citizen", "ready", "closed"].includes(status);
    const reviewStartedAt =
      submittedAt && reviewed
        ? new Date(new Date(submittedAt).getTime() + 90 * 60_000).toISOString()
        : null;
    const reviewCompletedAt =
      reviewStartedAt && ["ready", "closed"].includes(status)
        ? new Date(new Date(reviewStartedAt).getTime() + (6 + position) * 60_000).toISOString()
        : null;
    const expiresAt = new Date(options.now.getTime() + 60 * 86_400_000).toISOString();
    const answers: Record<string, AnswerValue> = {
      household_count: 2,
      members: [
        {
          role: "richiedente",
          firstName: "Persona",
          lastName: `Esempio ${position + 1}`,
          birthYear: 1985,
        },
        {
          role: "genitore",
          firstName: "Madre",
          lastName: `Esempio ${position + 1}`,
          birthYear: 1960,
        },
      ],
      accounts_count: 1,
      account_bank_0: "Fineco",
      account_type_0: "deposit",
      properties_count: 0,
      vehicles_count: 1,
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
    if (Array.isArray(answers.members))
      answers.members = MemberInput.array()
        .parse(answers.members)
        .map((member) => ({ ...member, id: crypto.randomUUID() }));
    const household = (options.buildHousehold ?? buildHousehold)(answers);
    for (const member of household) {
      answers[`income_present_${member.id}`] = true;
    }
    answers.account_owner_0 = household[0]?.id ?? "joint";
    answers.vehicle_owner_0 = household[0]?.id ?? "joint";
    completeDemoAnswers(answers);
    const checklist = options.buildChecklist
      ? options.buildChecklist(answers, household)
      : buildChecklist("isee_ordinario", answers, household, "it");
    const complete = [1, 4, 5, 8].includes(position);
    const selected = complete
      ? checklist
      : checklist.filter((item, index) => item.requirementId !== "account_average" && index < 3);
    const caseDirectory = join(options.uploadsDir, id);
    await mkdir(caseDirectory, { recursive: true, mode: 0o700 });
    const documentRows: Array<typeof documents.$inferInsert> = [];
    const attemptedFiles: string[] = [];
    try {
      for (const [itemPosition, item] of selected.entries()) {
        const documentId = `demo-doc-${position + 1}-${itemPosition + 1}`;
        const docBytes = await examplePdf(position + 1, item.title, item.memberName);
        const storageKey = `${id}/${documentId}.pdf`;
        attemptedFiles.push(storageKey);
        await writeFile(join(options.uploadsDir, storageKey), docBytes, { mode: 0o600 });
        const analysis: DocumentAnalysis = {
          engine: "heuristic",
          detectedRequirementId: item.requirementId,
          detectedLabel: item.title,
          confidence: 0.8,
          ownerName: item.memberName,
          referenceYear: [
            "income",
            "account_balance",
            "account_average",
            "property",
            "mortgage",
            "self_employed",
            "foreign_income",
            "foreign_assets",
          ].includes(item.requirementId)
            ? 2025
            : null,
          expiresOn:
            item.requirementId === "identity"
              ? position === 3
                ? "2020-01-01"
                : "2030-12-31"
              : null,
          legible: true,
          pagesComplete: true,
          findings: [],
        };
        documentRows.push({
          id: documentId,
          caseId: id,
          fileName: `ESEMPIO-${item.requirementId}.pdf`,
          mimeType: "application/pdf",
          sizeBytes: docBytes.byteLength,
          pages: 1,
          storageKey,
          sha256: createHash("sha256").update(docBytes).digest("hex"),
          uploadedAt: new Date(
            new Date(createdAt).getTime() + (itemPosition + 1) * 10_000,
          ).toISOString(),
          checklistItemId: item.id,
          memberId: item.memberId,
          status: "analyzed",
          analysis,
        });
      }
      const tokenHash = createHash("sha256").update(randomBytes(32)).digest("hex");
      await db.transaction(async (tx) => {
        const reference = await nextReference(
          tx,
          organizationId,
          new Date(createdAt).getUTCFullYear(),
        );
        await tx.insert(cases).values({
          id,
          organizationId,
          officeId: position % 2 === 0 ? "demo-office-centro" : "demo-office-loreto",
          tokenHash,
          reference,
          language,
          practiceId: "isee_ordinario",
          status,
          answers,
          contact:
            status === "intake"
              ? null
              : {
                  firstName: "Persona",
                  lastName: `Esempio ${position + 1}`,
                  email: `persona${position + 1}@example.invalid`,
                },
          citizenNote: "Fascicolo dimostrativo: nessun dato reale.",
          internalNotes: "DEMO: eventi e tempi sono simulati, non misure del pilota.",
          assigneeId: reviewed ? "demo-operator" : null,
          createdAt,
          updatedAt: reviewCompletedAt ?? reviewStartedAt ?? submittedAt ?? createdAt,
          submittedAt,
          reviewStartedAt,
          reviewCompletedAt,
          closedAt: status === "closed" ? reviewCompletedAt : null,
          expiresAt,
          firstSubmissionComplete: submittedAt ? complete : null,
        });
        if (documentRows.length) await tx.insert(documents).values(documentRows);
        if (["ready", "closed"].includes(status) && reviewCompletedAt && selected.length)
          await tx.insert(checklistReviews).values(
            selected.map((item) => ({
              caseId: id,
              itemId: item.id,
              decision: "verified" as const,
              note: "Verifica dimostrativa: documento ESEMPIO.",
              operatorId: "demo-operator",
              reviewedAt: reviewCompletedAt,
            })),
          );
        await tx.insert(messages).values({
          id: `demo-message-${position + 1}`,
          caseId: id,
          role: "system",
          text: demoNotice[language],
          originalText: null,
          createdAt,
        });
        const audit = [
          {
            id: `${id}-created`,
            caseId: id,
            caseReference: reference,
            organizationId,
            actor: "citizen" as const,
            actorId: null,
            type: "case.created",
            at: createdAt,
            metadata: {},
          },
        ];
        if (submittedAt)
          audit.push({
            id: `${id}-submitted`,
            caseId: id,
            caseReference: reference,
            organizationId,
            actor: "citizen",
            actorId: null,
            type: "case.submitted",
            at: submittedAt,
            metadata: {},
          });
        await tx.insert(events).values(audit);
        if (reviewStartedAt)
          await tx.insert(events).values({
            id: `${id}-review-start`,
            caseId: id,
            caseReference: reference,
            organizationId,
            actor: "operator",
            actorId: "demo-operator",
            type: "review.started",
            at: reviewStartedAt,
            metadata: {},
          });
        if (reviewCompletedAt)
          await tx.insert(events).values({
            id: `${id}-review-complete`,
            caseId: id,
            caseReference: reference,
            organizationId,
            actor: "operator",
            actorId: "demo-operator",
            type: "review.completed",
            at: reviewCompletedAt,
            metadata: {},
          });
        if (status === "needs_citizen" && reviewStartedAt) {
          await tx.insert(messages).values({
            id: `${id}-integration-message`,
            caseId: id,
            role: "operator",
            text: demoIntegrationRequest[language],
            originalText: language === "it" ? null : demoIntegrationRequest.it,
            createdAt: reviewStartedAt,
          });
          await tx.insert(events).values({
            id: `${id}-requested`,
            caseId: id,
            caseReference: reference,
            organizationId,
            actor: "operator",
            actorId: "demo-operator",
            type: "citizen.requested",
            at: reviewStartedAt,
            metadata: { itemsCount: 1, heuristic: true },
          });
        }
      });
    } catch (error) {
      await Promise.all(
        attemptedFiles.map((storageKey) =>
          rm(join(options.uploadsDir, storageKey), { force: true }),
        ),
      );
      throw error;
    }
    created++;
  }
  return { created };
}

async function examplePdf(
  number: number,
  label: string,
  ownerName: string | null,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 300]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText("ESEMPIO - NON VALIDO", {
    x: 30,
    y: 240,
    size: 24,
    font,
    color: rgb(0.7, 0.1, 0.1),
  });
  page.drawText(`Documento fittizio numero ${number}`, { x: 30, y: 190, size: 15, font });
  page.drawText(ownerName ?? `Nucleo Esempio ${number}`, { x: 30, y: 150, size: 15, font });
  page.drawText(label.replace(/[^\x20-\x7E\xA0-\xFF]/g, "").slice(0, 65), {
    x: 30,
    y: 125,
    size: 11,
    font,
  });
  page.drawText("Nessun dato personale reale. Non usare per pratiche.", {
    x: 30,
    y: 90,
    size: 11,
    font,
  });
  return pdf.save();
}

function completeDemoAnswers(answers: Record<string, AnswerValue>): void {
  for (;;) {
    const unanswered = getQuestions("isee_ordinario", answers, "it").filter(
      (question) => !Object.hasOwn(answers, question.id),
    );
    if (!unanswered.length) return;
    for (const question of unanswered) {
      // The fictional household has no additional special situations. Other facts need an explicit fixture.
      if (question.kind !== "yes_no") {
        throw new Error(`Demo fixture is missing an explicit answer for ${question.id}`);
      }
      answers[question.id] = false;
    }
  }
}
