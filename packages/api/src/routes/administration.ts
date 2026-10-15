import { randomInt } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { offices, operators, organizations, sessions, settings, type Database } from "@avanti/db";
import {
  MfaResetRequest,
  Id,
  CreateOperatorRequest,
  DeleteCaseRequest,
  OfficeInput,
  UpdateOfficeRequest,
  UpdateOperatorRequest,
  UpdateSettingsRequest,
  type OperatorSummary,
  type OrganizationSettings,
} from "@avanti/contracts";
import { parse, body, type App, type Services, type ApiContext } from "../context";
import { ApiFailure, hashPassword, notFound } from "../security";
import { iso, caseById } from "../dossier";
import { eraseCase } from "../case-erasure";
import { retryStorageDeletions } from "../storage-cleanup";
import { officeView } from "../views";
import { recordActivity } from "../audit-log";
import { lockOperatorAccess } from "../operator-access";

type OperatorRow = typeof operators.$inferSelect;
const forbidden = () =>
  new ApiFailure("forbidden", 403, "Operazione riservata agli amministratori.");
function requireAdmin(operator: OperatorRow) {
  if (operator.role !== "admin") throw forbidden();
}

// All admin mutations serialize per tenant and recheck the actor after acquiring the lock.
export async function administer<T>(
  s: Services,
  c: ApiContext,
  action: (tx: Database) => Promise<T>,
) {
  const actor = c.get("operator");
  requireAdmin(actor);
  return s.db.transaction(async (tx) => {
    await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, actor.organizationId))
      // Retention holds case locks before inserting audit FKs to this organization.
      // Keep KEY SHARE compatible while still excluding other operator mutations.
      .for("no key update");
    const [current] = await tx
      .select()
      .from(operators)
      .where(and(eq(operators.id, actor.id), eq(operators.organizationId, actor.organizationId)))
      .for("update");
    if (!current?.active || current.mustChangePassword || current.role !== "admin")
      throw forbidden();
    await lockOperatorAccess(tx, c, s);
    return action(tx);
  });
}

function operatorSummary(row: OperatorRow): OperatorSummary {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active,
    mfaEnabled: row.mfaEnabledAt !== null,
    lastLoginAt: row.lastLoginAt ? iso(row.lastLoginAt) : null,
    createdAt: iso(row.createdAt),
  };
}
function settingsView(row?: typeof settings.$inferSelect): OrganizationSettings {
  return {
    nearReadyMode: row?.nearReadyMode ?? "shadow",
    nearReadyCriticalThreshold: row?.nearReadyCriticalThreshold ?? 0.98,
    nearReadyOtherThreshold: row?.nearReadyOtherThreshold ?? 0.95,
    nearReadySuspendedAt: row?.nearReadySuspendedAt ? iso(row.nearReadySuspendedAt) : null,
    mfaRequired: row?.mfaRequired ?? false,
    aiMonthlyBudgetEur: row?.aiMonthlyBudgetEur ?? null,
    aiCopilot: row?.aiCopilot ?? true,
    aiCitizenAssistant: row?.aiCitizenAssistant ?? true,
    baselineMinutesPerCase: row?.baselineMinutesPerCase ?? null,
    linkDays: row?.linkDays ?? 60,
    retentionDays: row?.retentionDays ?? 180,
    notifyCitizenReady: row?.notifyCitizenReady ?? false,
    notifyCitizenSubmission: row?.notifyCitizenSubmission ?? false,
    notifyOperatorDigest: row?.notifyOperatorDigest ?? false,
    notifyCitizenReminders: row?.notifyCitizenReminders ?? false,
    citizenReminderDays: row?.citizenReminderDays ?? [3, 4],
  };
}
function temporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 20 }, () => alphabet[randomInt(alphabet.length)]).join("");
}
async function tenantOperator(db: Database, id: string, organizationId: string) {
  const [row] = await db
    .select()
    .from(operators)
    .where(and(eq(operators.id, id), eq(operators.organizationId, organizationId)))
    .for("update");
  if (!row) throw notFound();
  return row;
}
function slugPart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureOfficeNameAvailable(
  db: Database,
  organizationId: string,
  name: string,
  currentId?: string,
) {
  const normalized = name.trim().toLowerCase();
  const rows = await db
    .select({ id: offices.id, name: offices.name })
    .from(offices)
    .where(eq(offices.organizationId, organizationId));
  if (
    rows.some(
      (office) => office.id !== currentId && office.name.trim().toLowerCase() === normalized,
    )
  ) {
    throw new ApiFailure("conflict", 409, "C'è già uno sportello con questo nome.");
  }
}
function officeSlugBase(city: string, name: string): string {
  const cityPart = slugPart(city) || "citta";
  const namePart = slugPart(name) || "sportello";
  const startsWithCity = namePart === cityPart || namePart.startsWith(`${cityPart}-`);
  const base = startsWithCity ? namePart : `${cityPart}-${namePart}`;
  return base.slice(0, 75).replace(/-$/, "");
}

export function mountAdministrationRoutes(app: App, s: Services) {
  app.get("/settings", async (c) => {
    const actor = c.get("operator");
    requireAdmin(actor);
    const [row] = await s.db
      .select()
      .from(settings)
      .where(eq(settings.organizationId, actor.organizationId));
    return c.json(settingsView(row));
  });
  app.patch("/settings", async (c) => {
    const actor = c.get("operator");
    requireAdmin(actor);
    const input = await body(c, UpdateSettingsRequest);
    const row = await administer(s, c, async (tx) => {
      await tx
        .insert(settings)
        .values({ organizationId: actor.organizationId })
        .onConflictDoNothing();
      if (!Object.keys(input).length) {
        const [current] = await tx
          .select()
          .from(settings)
          .where(eq(settings.organizationId, actor.organizationId));
        return current;
      }
      const [updated] = await tx
        .update(settings)
        .set(input)
        .where(eq(settings.organizationId, actor.organizationId))
        .returning();
      await recordActivity(tx, actor.organizationId, actor.id, "settings.updated", s.clock());
      return updated;
    });
    return c.json(settingsView(row));
  });
  app.get("/operators", async (c) => {
    const actor = c.get("operator");
    requireAdmin(actor);
    const rows = await s.db
      .select()
      .from(operators)
      .where(eq(operators.organizationId, actor.organizationId))
      .orderBy(asc(operators.name), asc(operators.id));
    return c.json(rows.map(operatorSummary));
  });
  app.post("/operators", async (c) => {
    const actor = c.get("operator");
    requireAdmin(actor);
    const input = await body(c, CreateOperatorRequest);
    const password = temporaryPassword();
    const passwordHash = await hashPassword(password);
    const row = await administer(s, c, async (tx) => {
      const [created] = await tx
        .insert(operators)
        .values({
          ...input,
          id: crypto.randomUUID(),
          organizationId: actor.organizationId,
          passwordHash,
          mustChangePassword: true,
          createdAt: s.clock().toISOString(),
        })
        .onConflictDoNothing({ target: operators.email })
        .returning();
      if (!created)
        throw new ApiFailure(
          "conflict",
          409,
          "Questa email è già associata a un operatore. Usa un indirizzo diverso.",
        );
      await recordActivity(
        tx,
        actor.organizationId,
        actor.id,
        "operator.created",
        s.clock(),
        created.id,
      );
      return created;
    });
    return c.json({ operator: operatorSummary(row), temporaryPassword: password }, 201);
  });
  app.patch("/operators/:id", async (c) => {
    const actor = c.get("operator");
    requireAdmin(actor);
    const input = await body(c, UpdateOperatorRequest);
    const row = await administer(s, c, async (tx) => {
      const current = await tenantOperator(tx, c.req.param("id"), actor.organizationId);
      if (current.id === actor.id && (input.active === false || input.role === "operator"))
        throw new ApiFailure("conflict", 409, "Non puoi disattivare o declassare il tuo account.");
      const next = { ...current, ...input };
      if (!(next.active && next.role === "admin")) {
        const admins = await tx
          .select({ id: operators.id })
          .from(operators)
          .where(
            and(
              eq(operators.organizationId, actor.organizationId),
              eq(operators.active, true),
              eq(operators.role, "admin"),
            ),
          );
        if (!admins.some((admin) => admin.id !== current.id))
          throw new ApiFailure("conflict", 409, "Deve restare almeno un amministratore attivo.");
      }
      if (!Object.keys(input).length) return current;
      const [updated] = await tx
        .update(operators)
        .set(input)
        .where(eq(operators.id, current.id))
        .returning();
      if (!updated) throw notFound();
      if (input.active === false)
        await tx.delete(sessions).where(eq(sessions.operatorId, current.id));
      if (input.active !== undefined && input.active !== current.active)
        await recordActivity(
          tx,
          actor.organizationId,
          actor.id,
          input.active ? "operator.activated" : "operator.deactivated",
          s.clock(),
          current.id,
        );
      if (
        (input.role !== undefined && input.role !== current.role) ||
        (input.name !== undefined && input.name !== current.name)
      )
        await recordActivity(
          tx,
          actor.organizationId,
          actor.id,
          "operator.updated",
          s.clock(),
          current.id,
        );
      return updated;
    });
    return c.json(operatorSummary(row));
  });
  app.post("/operators/:id/reset-password", async (c) => {
    const actor = c.get("operator");
    requireAdmin(actor);
    const row = await administer(s, c, async (tx) => {
      const current = await tenantOperator(tx, c.req.param("id"), actor.organizationId);
      if (current.id === actor.id)
        throw new ApiFailure("conflict", 409, "Per il tuo account usa il cambio password.");
      const password = temporaryPassword();
      const [updated] = await tx
        .update(operators)
        .set({ passwordHash: await hashPassword(password), mustChangePassword: true })
        .where(eq(operators.id, current.id))
        .returning();
      if (!updated) throw notFound();
      await tx.delete(sessions).where(eq(sessions.operatorId, current.id));
      await recordActivity(
        tx,
        actor.organizationId,
        actor.id,
        "operator.password_reset",
        s.clock(),
        current.id,
      );
      return { operator: operatorSummary(updated), temporaryPassword: password };
    });
    return c.json(row);
  });
  app.post("/operators/:id/reset-mfa", async (c) => {
    const actor = c.get("operator");
    requireAdmin(actor);
    await body(c, MfaResetRequest);
    const id = parse(Id, c.req.param("id"));
    const row = await administer(s, c, async (tx) => {
      const [actorSession] = await tx
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.id, c.get("session").id),
            eq(sessions.operatorId, actor.id),
            eq(sessions.state, "authenticated"),
          ),
        );
      const [policy] = await tx
        .select()
        .from(settings)
        .where(eq(settings.organizationId, actor.organizationId));
      if (
        !actorSession ||
        Date.parse(actorSession.expiresAt) <= s.clock().getTime() ||
        (policy?.mfaRequired && !actor.mfaEnabledAt)
      )
        throw forbidden();
      const current = await tenantOperator(tx, id, actor.organizationId);
      if (current.id === actor.id)
        throw new ApiFailure(
          "conflict",
          409,
          "Non puoi azzerare la verifica in due passaggi del tuo account.",
        );
      const [updated] = await tx
        .update(operators)
        .set({ mfaSecret: null, mfaEnabledAt: null, mfaLastUsedStep: null, mfaRecoveryHashes: [] })
        .where(eq(operators.id, current.id))
        .returning();
      await tx.delete(sessions).where(eq(sessions.operatorId, current.id));
      await recordActivity(
        tx,
        actor.organizationId,
        actor.id,
        "operator.mfa_reset",
        s.clock(),
        current.id,
      );
      return updated!;
    });
    return c.json(operatorSummary(row));
  });
  app.post("/offices", async (c) => {
    const actor = c.get("operator");
    requireAdmin(actor);
    const input = await body(c, OfficeInput);
    const row = await administer(s, c, async (tx) => {
      await ensureOfficeNameAvailable(tx, actor.organizationId, input.name);
      const base = officeSlugBase(input.city, input.name);
      // The unique insert also handles simultaneous allocations by different organizations.
      for (let suffix = 1; suffix <= 1000; suffix++) {
        const [created] = await tx
          .insert(offices)
          .values({
            ...input,
            id: crypto.randomUUID(),
            organizationId: actor.organizationId,
            slug: suffix === 1 ? base : `${base}-${suffix}`,
          })
          .onConflictDoNothing({ target: offices.slug })
          .returning();
        if (created) {
          await recordActivity(tx, actor.organizationId, actor.id, "office.created", s.clock());
          return created;
        }
      }
      throw new ApiFailure(
        "conflict",
        409,
        "Troppi sportelli con questo nome. Scegli un altro nome.",
      );
    });
    return c.json(officeView(row), 201);
  });
  app.patch("/offices/:id", async (c) => {
    const actor = c.get("operator");
    requireAdmin(actor);
    const input = await body(c, UpdateOfficeRequest);
    const row = await administer(s, c, async (tx) => {
      const scope = and(
        eq(offices.id, c.req.param("id")),
        eq(offices.organizationId, actor.organizationId),
      );
      const [current] = await tx.select().from(offices).where(scope).for("update");
      if (!current) throw notFound();
      if (input.name !== undefined) {
        await ensureOfficeNameAvailable(tx, actor.organizationId, input.name, current.id);
      }
      if (!Object.keys(input).length) return current;
      const [updated] = await tx.update(offices).set(input).where(scope).returning();
      if (!updated) throw notFound();
      await recordActivity(tx, actor.organizationId, actor.id, "office.updated", s.clock());
      return updated;
    });
    return c.json(officeView(row));
  });
  app.delete("/cases/:id", async (c) => {
    const actor = c.get("operator");
    requireAdmin(actor);
    const input = await body(c, DeleteCaseRequest);
    const id = c.req.param("id");
    await administer(s, c, async (tx) => {
      const row = await caseById(tx, id, actor.organizationId, true);
      if (input.confirmReference.toLowerCase() !== row.reference.toLowerCase())
        throw new ApiFailure("bad_request", 400, "Il riferimento non corrisponde al fascicolo.");
      await eraseCase(tx, row, s.clock(), actor.id);
    });
    await retryStorageDeletions(s, undefined, id);
    return c.body(null, 204);
  });
}
