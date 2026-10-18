import {
  CitizenHandoff,
  Id,
  RecordCitizenHandoffRequest,
  type ChecklistItem,
  type DocumentSummary,
  type CitizenHandoffChannel,
  type CitizenHandoffItem,
  type Language,
} from "@avanti/contracts";
import { genericChecklistTitle, itemReadiness, splitRequestLabels } from "@avanti/core";
import { body, parse, type App, type Services } from "./context";
import { audit, caseById, citizenView, loadViewData, type CaseRow } from "./dossier";

/** What the citizen still has to bring: the same «da fare» their page counts (core readiness). */
function toBring(
  item: ChecklistItem,
  documents: DocumentSummary[],
): CitizenHandoffItem["status"] | null {
  if (itemReadiness(item, documents) !== "todo") return null;
  return item.status === "missing" || item.status === "rejected" ? item.status : "issue";
}

/** Printing puts personal data on paper: it is in the activity log like a PDF export. */
const EVENT: Record<CitizenHandoffChannel, string> = {
  whatsapp: "citizen.notice_whatsapp",
  sms: "citizen.notice_sms",
  copy: "citizen.notice_copied",
  print: "citizen.checklist_printed",
};

function catalogTitle(row: CaseRow, item: ChecklistItem, language: Language) {
  return row.practiceId
    ? genericChecklistTitle(item.requirementId, row.practiceId, row.answers, language)
    : null;
}

/** The message without the item list appended under it: the sheet prints the items itself. */
function withoutLabels(text: string, checklist: ChecklistItem[]) {
  // A request made only of items keeps its first line rather than printing nothing.
  return splitRequestLabels(text, checklist).body || text.split("\n")[0]!.trim();
}

/**
 * The same checklist the citizen sees, in their language, next to the Italian one the operator
 * reads. Built from one load so both lists describe the same version of the case.
 */
export async function citizenHandoff(
  s: Services,
  row: CaseRow,
  now: Date,
): Promise<CitizenHandoff> {
  const data = await loadViewData(s.db, row, now);
  const [local, italian] = await Promise.all([
    citizenView(s.db, row, now, row.language, false, data),
    row.language === "it" ? null : citizenView(s.db, row, now, "it", false, data),
  ]);
  const it = italian ?? local;
  const titlesIt = new Map(it.checklist.map((item) => [item.id, item.title]));
  const items: CitizenHandoffItem[] = local.checklist
    .flatMap((item) => {
      const status = toBring(item, local.documents);
      return status ? [{ ...item, status }] : [];
    })
    .map((item) => {
      const titleIt = titlesIt.get(item.id) ?? item.title;
      return {
        id: item.id,
        title: item.title,
        titleIt,
        genericTitle: catalogTitle(row, item, row.language) ?? item.title,
        genericTitleIt: catalogTitle(row, item, "it") ?? titleIt,
        howToGet: item.howToGet,
        memberName: item.memberName,
        required: item.required,
        status: item.status,
        note: item.note,
      };
    })
    // Required first, each group in checklist order: the paper list is read top to bottom.
    .sort((a, b) => Number(b.required) - Number(a.required));
  const asked =
    row.status === "needs_citizen"
      ? local.messages.findLast((m) => m.role === "operator")
      : undefined;
  const labelled = [...local.checklist, ...it.checklist];
  const request = asked
    ? {
        text: withoutLabels(asked.text, labelled),
        textIt: withoutLabels(asked.originalText ?? asked.text, labelled),
      }
    : null;
  return CitizenHandoff.parse({
    reference: row.reference,
    language: row.language,
    status: row.status,
    organization: local.organization,
    office: local.office,
    practice: local.practice
      ? { name: local.practice.name, nameIt: it.practice?.name ?? local.practice.name }
      : null,
    interviewComplete: local.step !== "need" && local.step !== "interview",
    items,
    request: request?.textIt ? request : null,
  });
}

export function mountCitizenHandoff(app: App, s: Services) {
  app.get("/cases/:id/citizen-handoff", async (c) => {
    const operator = c.get("operator");
    const row = await caseById(s.db, parse(Id, c.req.param("id")), operator.organizationId);
    return c.json(await citizenHandoff(s, row, s.clock()));
  });

  // Records that a notice or a printout was prepared, not that the citizen read it: the
  // message leaves through the operator's own WhatsApp, SMS app or printer.
  app.post("/cases/:id/citizen-handoff/events", async (c) => {
    const operator = c.get("operator");
    const { channel } = await body(c, RecordCitizenHandoffRequest);
    const row = await caseById(s.db, parse(Id, c.req.param("id")), operator.organizationId);
    await audit(s.db, row, "operator", EVENT[channel], s.clock(), operator.id);
    return c.body(null, 204);
  });
}
