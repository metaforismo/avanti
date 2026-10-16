import { createHash } from "node:crypto";
import { and, desc, eq, gte, inArray, lt, or } from "drizzle-orm";
import { events, operators, type Database, type EventMetadata } from "@avanti/db";
import {
  AuditAction,
  AuditDetails,
  AuditQuery,
  IsoDateTime,
  Id,
  type AuditEvent,
} from "@avanti/contracts";
import { timelineLabel } from "@avanti/core";
import { z } from "zod";
import { parse, type App, type Services } from "./context";
import { ApiFailure } from "./security";

export const AUDIT_RETENTION_DAYS = 365;
export const AUDIT_RETENTION_BATCH = 1000;
export const AUDIT_EXPORT_MAX_ROWS = 5000;

const labels: Partial<Record<AuditAction, string>> = {
  "copilot.asked": "Domanda dell’operatore al fascicolo",
  "family.searched": "Ricerca famiglia nel CAF",
  "case.reused": "Nucleo e documenti riusati per una nuova pratica",
  "document.reuse_checked": "Validità del documento riusato controllata",
  "family.erased": "Fascicoli collegati cancellati su richiesta dell’interessato",
  "case.deleted": "Fascicolo cancellato dall’amministratore",
  "case.retention_deleted": "Fascicolo cancellato per fine conservazione",
  "auth.login_succeeded": "Accesso operatore riuscito",
  "auth.login_failed": "Tentativo di accesso operatore fallito",
  "auth.password_changed": "Password modificata dall’operatore",
  "auth.mfa_enabled": "Verifica in due passaggi attivata",
  "auth.mfa_disabled": "Verifica in due passaggi disattivata",
  "auth.mfa_failed": "Verifica in due passaggi fallita",
  "auth.mfa_recovery_used": "Codice di recupero utilizzato",
  "auth.mfa_recovery_regenerated": "Codici di recupero rigenerati",
  "operator.mfa_reset": "Verifica in due passaggi azzerata dall’amministratore",
  "auth.logged_out": "Sessione operatore terminata",
  "operator.created": "Account operatore creato",
  "operator.updated": "Account operatore aggiornato",
  "operator.deactivated": "Account operatore disattivato",
  "operator.activated": "Account operatore riattivato",
  "operator.password_reset": "Password operatore reimpostata dall’amministratore",
  "quick_reply.created": "Risposta rapida creata",
  "quick_reply.updated": "Risposta rapida modificata",
  "quick_reply.deleted": "Risposta rapida eliminata",
  "quick_reply.reordered": "Risposte rapide riordinate",
  "settings.updated": "Impostazioni dell’organizzazione aggiornate",
  "near_ready.resumed": "Suggerimento «quasi pronta» riattivato dopo una sospensione",
  "office.created": "Sportello creato",
  "office.updated": "Sportello aggiornato",
  "organization.bootstrapped": "Organizzazione e primo amministratore creati",
  "organization.exported": "Dati dell’organizzazione esportati",
  "pilot_report.exported": "Rapporto del pilota",
  "audit.exported": "Registro attività esportato in CSV",
  "activity.recorded": "Attività registrata",
};
export function auditLabel(action: AuditAction, details: AuditDetails = {}) {
  if (action === "pilot_report.exported") {
    // Older events can lack format metadata: do not infer an export from the action name.
    if (details.reportPdf) return "Rapporto del pilota esportato (PDF)";
    if (details.reportCsv) return "Rapporto del pilota esportato (CSV)";
    if (details.reportJson) return "Rapporto del pilota consultato";
  }
  return labels[action] ?? timelineLabel(action);
}

export async function recordActivity(
  db: Database,
  organizationId: string | null,
  actorId: string | null,
  action: AuditAction,
  now: Date,
  subjectOperatorId: string | null = null,
  metadata: EventMetadata = {},
) {
  await db.insert(events).values({
    id: crypto.randomUUID(),
    organizationId,
    actor: actorId ? "operator" : "system",
    actorId,
    subjectOperatorId,
    type: action,
    at: now.toISOString(),
    metadata: AuditDetails.parse(metadata),
  });
}

const rome = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZoneName: "longOffset",
});
export function romeInstant(at: string) {
  const date = new Date(at);
  const parts = Object.fromEntries(rome.formatToParts(date).map((p) => [p.type, p.value]));
  const offset = parts.timeZoneName!.replace("GMT", "") || "+00:00";
  const fraction = /[T ]\d{2}:\d{2}:\d{2}\.(\d+)/.exec(at)?.[1] ?? "000";
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.${fraction}${offset}`;
}

function eventView(row: typeof events.$inferSelect): AuditEvent {
  const action = AuditAction.safeParse(row.type);
  // Legacy/unrecognized types and metadata keys must not become a free-text disclosure channel.
  const details = AuditDetails.safeParse(row.metadata);
  const caseId = row.caseId ?? row.deletedCaseId;
  return {
    id: row.id,
    at: romeInstant(row.at),
    timeZone: "Europe/Rome",
    actor: {
      type: row.actor === "ai" ? "system" : row.actor,
      id: row.actor === "operator" ? row.actorId : null,
    },
    subjectOperatorId: row.subjectOperatorId,
    action: action.success ? action.data : "activity.recorded",
    label: auditLabel(
      action.success ? action.data : "activity.recorded",
      details.success ? details.data : {},
    ),
    case: caseId
      ? { id: caseId, reference: row.caseReference, deleted: row.caseId === null }
      : null,
    details: details.success ? details.data : {},
  };
}

const Cursor = z
  .object({ at: IsoDateTime, id: Id, scope: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
function cursorScope(org: string, query: AuditQuery) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        org,
        query.from ?? null,
        query.to ?? null,
        query.operatorId ?? null,
        query.reference ?? null,
        query.action ?? null,
      ]),
    )
    .digest("hex");
}
function eventFilter(org: string, query: AuditQuery) {
  const filters = [eq(events.organizationId, org)];
  if (query.from) filters.push(gte(events.at, query.from));
  if (query.to) filters.push(lt(events.at, query.to));
  if (query.operatorId)
    filters.push(
      or(eq(events.actorId, query.operatorId), eq(events.subjectOperatorId, query.operatorId))!,
    );
  if (query.reference) filters.push(eq(events.caseReference, query.reference));
  if (query.action) filters.push(eq(events.type, query.action));
  if (query.cursor) {
    let raw: unknown;
    try {
      raw = JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8"));
    } catch {
      throw new ApiFailure("bad_request", 400, "Cursore non valido.");
    }
    const cursor = parse(Cursor, raw);
    if (cursor.scope !== cursorScope(org, query))
      throw new ApiFailure("bad_request", 400, "Cursore non valido per questi filtri.");
    filters.push(
      or(lt(events.at, cursor.at), and(eq(events.at, cursor.at), lt(events.id, cursor.id)))!,
    );
  }
  return and(...filters);
}

export function csvCell(value: string) {
  // Strip controls before checking the first non-space character; quoting alone does not stop formulas.
  const clean = value.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ");
  const safe = /^[\s\uFEFF]*[=+\-@]/u.test(clean) ? `'${clean}` : clean;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function auditCsv(rows: AuditEvent[]) {
  const records = [
    [
      "Istante (Europe/Rome)",
      "Attore",
      "ID operatore",
      "Account interessato",
      "Azione",
      "Codice azione",
      "Pratica",
      "ID pratica",
      "Cancellata",
      "Dettagli",
      "ID evento",
    ],
    ...rows.map((e) => [
      e.at,
      { operator: "Operatore", citizen: "Cittadino", system: "Sistema" }[e.actor.type],
      e.actor.id ?? "",
      e.subjectOperatorId ?? "",
      e.label,
      e.action,
      e.case?.reference ?? "",
      e.case?.id ?? "",
      e.case?.deleted ? "Sì" : "",
      JSON.stringify(e.details),
      e.id,
    ]),
  ];
  return "\uFEFF" + records.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export async function purgeAuditEvents(db: Database, now: Date) {
  const cutoff = new Date(now.getTime() - AUDIT_RETENTION_DAYS * 86400000).toISOString();
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: events.id })
      .from(events)
      .where(lt(events.at, cutoff))
      .orderBy(events.at, events.id)
      .limit(AUDIT_RETENTION_BATCH)
      .for("update", { skipLocked: true });
    if (rows.length)
      await tx.delete(events).where(
        inArray(
          events.id,
          rows.map((r) => r.id),
        ),
      );
    return rows.length;
  });
}

export function mountAuditRoutes(app: App, s: Services) {
  for (const path of ["/audit", "/audit/export.csv"])
    app.get(path, async (c) => {
      const actor = c.get("operator");
      if (actor.role !== "admin")
        throw new ApiFailure("forbidden", 403, "Operazione riservata agli amministratori.");
      const query = parse(AuditQuery, c.req.query());
      const exporting = path.endsWith(".csv");
      const limit = exporting ? AUDIT_EXPORT_MAX_ROWS : query.limit;
      const result = await s.db.transaction(async (tx) => {
        // Hold a shared actor lock until the read/export commits, including its audit event.
        const [current] = await tx
          .select()
          .from(operators)
          .where(
            and(eq(operators.id, actor.id), eq(operators.organizationId, actor.organizationId)),
          )
          .for("share");
        if (!current?.active || current.mustChangePassword || current.role !== "admin")
          throw new ApiFailure("forbidden", 403, "Operazione riservata agli amministratori.");
        const rows = await tx
          .select()
          .from(events)
          .where(eventFilter(actor.organizationId, query))
          .orderBy(desc(events.at), desc(events.id))
          .limit(limit + 1);
        if (exporting && rows.length > limit)
          throw new ApiFailure(
            "bad_request",
            400,
            "L’export supera 5.000 eventi. Restringi il periodo o i filtri.",
          );
        const items = rows.slice(0, limit).map(eventView);
        if (exporting) {
          const csv = auditCsv(items);
          await recordActivity(
            tx,
            actor.organizationId,
            actor.id,
            "audit.exported",
            s.clock(),
            null,
            { rows: items.length },
          );
          return { csv, items, nextCursor: null };
        }
        const last = rows[limit - 1];
        const nextCursor =
          rows.length > limit && last
            ? Buffer.from(
                JSON.stringify({
                  at: last.at.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"),
                  id: last.id,
                  scope: cursorScope(actor.organizationId, query),
                }),
              ).toString("base64url")
            : null;
        return { csv: null, items, nextCursor };
      });
      if (result.csv !== null) {
        c.header("Content-Type", "text/csv; charset=utf-8");
        c.header("Content-Disposition", 'attachment; filename="registro-attivita.csv"');
        return c.body(result.csv);
      }
      return c.json({ items: result.items, nextCursor: result.nextCursor });
    });
}
