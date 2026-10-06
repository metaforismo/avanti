import { randomInt } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { offices, operators, organizations, sessions, settings, type Database } from "@avanti/db";
import {
  CreateOperatorRequest,
  DeleteCaseRequest,
  OfficeInput,
  UpdateOfficeRequest,
  UpdateOperatorRequest,
  UpdateSettingsRequest,
  type OperatorSummary,
  type OrganizationSettings,
} from "@avanti/contracts";
import { body, type App, type Services } from "../context";
import { ApiFailure, hashPassword, notFound } from "../security";
import { iso, caseById } from "../dossier";
import { eraseCase } from "../case-erasure";
import { retryStorageDeletions } from "../storage-cleanup";
import { officeView } from "../views";

type OperatorRow = typeof operators.$inferSelect;
const forbidden = () =>
  new ApiFailure("forbidden", 403, "Operazione riservata agli amministratori.");
function requireAdmin(operator: OperatorRow) {
  if (operator.role !== "admin") throw forbidden();
}

// All admin mutations serialize per tenant and recheck the actor after acquiring the lock.
async function administer<T>(
  s: Services,
  actor: OperatorRow,
  action: (tx: Database) => Promise<T>,
) {
  requireAdmin(actor);
  return s.db.transaction(async (tx) => {
    await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, actor.organizationId))
      .for("update");
    const [current] = await tx
      .select()
      .from(operators)
      .where(and(eq(operators.id, actor.id), eq(operators.organizationId, actor.organizationId)))
      .for("update");
    if (!current?.active || current.mustChangePassword || current.role !== "admin")
      throw forbidden();
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
    lastLoginAt: row.lastLoginAt ? iso(row.lastLoginAt) : null,
    createdAt: iso(row.createdAt),
  };
}
function settingsView(row?: typeof settings.$inferSelect): OrganizationSettings {
  return {
    baselineMinutesPerCase: row?.baselineMinutesPerCase ?? null,
    linkDays: row?.linkDays ?? 60,
    retentionDays: row?.retentionDays ?? 180,
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
    const row = await administer(s, actor, async (tx) => {
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
    const row = await administer(s, actor, async (tx) => {
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
      return created;
    });
    return c.json({ operator: operatorSummary(row), temporaryPassword: password }, 201);
  });
  app.patch("/operators/:id", async (c) => {
    const actor = c.get("operator");
    requireAdmin(actor);
    const input = await body(c, UpdateOperatorRequest);
    const row = await administer(s, actor, async (tx) => {
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
      return updated;
    });
    return c.json(operatorSummary(row));
  });
  app.post("/operators/:id/reset-password", async (c) => {
    const actor = c.get("operator");
    requireAdmin(actor);
    const row = await administer(s, actor, async (tx) => {
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
      return { operator: operatorSummary(updated), temporaryPassword: password };
    });
    return c.json(row);
  });
  app.post("/offices", async (c) => {
    const actor = c.get("operator");
    requireAdmin(actor);
    const input = await body(c, OfficeInput);
    const row = await administer(s, actor, async (tx) => {
      const base = `${slugPart(input.city) || "citta"}-${slugPart(input.name) || "sportello"}`
        .slice(0, 75)
        .replace(/-$/, "");
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
        if (created) return created;
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
    const row = await administer(s, actor, async (tx) => {
      const scope = and(
        eq(offices.id, c.req.param("id")),
        eq(offices.organizationId, actor.organizationId),
      );
      const [current] = await tx.select().from(offices).where(scope).for("update");
      if (!current) throw notFound();
      if (!Object.keys(input).length) return current;
      const [updated] = await tx.update(offices).set(input).where(scope).returning();
      if (!updated) throw notFound();
      return updated;
    });
    return c.json(officeView(row));
  });
  app.delete("/cases/:id", async (c) => {
    const actor = c.get("operator");
    requireAdmin(actor);
    const input = await body(c, DeleteCaseRequest);
    const id = c.req.param("id");
    await administer(s, actor, async (tx) => {
      const row = await caseById(tx, id, actor.organizationId, true);
      if (input.confirmReference.toLowerCase() !== row.reference.toLowerCase())
        throw new ApiFailure("bad_request", 400, "Il riferimento non corrisponde al fascicolo.");
      await eraseCase(tx, row, s.clock(), actor.id);
    });
    await retryStorageDeletions(s, undefined, id);
    return c.body(null, 204);
  });
}
