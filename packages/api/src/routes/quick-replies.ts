import { and, asc, eq } from "drizzle-orm";
import { quickReplies, type Database } from "@avanti/db";
import {
  Id,
  QuickReplyInput,
  ReorderQuickRepliesRequest,
  UpdateQuickReplyRequest,
} from "@avanti/contracts";
import { body, parse, type App, type Services } from "../context";
import { ApiFailure, notFound } from "../security";
import { recordActivity } from "../audit-log";
import { administer } from "./administration";

type ReplyRow = typeof quickReplies.$inferSelect;
const view = ({ id, title, text, position }: ReplyRow) => ({ id, title, text, position });
const list = (db: Database, organizationId: string) =>
  db
    .select()
    .from(quickReplies)
    .where(eq(quickReplies.organizationId, organizationId))
    .orderBy(asc(quickReplies.position));

async function replaceOrder(db: Database, organizationId: string, rows: ReplyRow[]) {
  // Reinsert atomically to avoid transient collisions on the 50 unique tenant slots.
  await db.delete(quickReplies).where(eq(quickReplies.organizationId, organizationId));
  if (rows.length)
    await db.insert(quickReplies).values(rows.map((row, position) => ({ ...row, position })));
}

export function mountQuickReplyRoutes(app: App, s: Services) {
  app.get("/quick-replies", async (c) =>
    c.json((await list(s.db, c.get("operator").organizationId)).map(view)),
  );
  app.post("/quick-replies", async (c) => {
    const actor = c.get("operator");
    const input = await body(c, QuickReplyInput);
    const created = await administer(s, c, async (tx) => {
      const rows = await list(tx, actor.organizationId);
      if (rows.length >= 50)
        throw new ApiFailure("conflict", 409, "Puoi salvare al massimo 50 risposte rapide.");
      const [row] = await tx
        .insert(quickReplies)
        .values({
          ...input,
          id: crypto.randomUUID(),
          organizationId: actor.organizationId,
          position: rows.length,
        })
        .returning();
      await recordActivity(tx, actor.organizationId, actor.id, "quick_reply.created", s.clock());
      return row!;
    });
    return c.json(view(created), 201);
  });
  app.put("/quick-replies/reorder", async (c) => {
    const actor = c.get("operator");
    const input = await body(c, ReorderQuickRepliesRequest);
    const rows = await administer(s, c, async (tx) => {
      const current = await list(tx, actor.organizationId);
      if (
        input.ids.length !== current.length ||
        input.ids.some((id) => !current.some((row) => row.id === id))
      )
        throw new ApiFailure(
          "conflict",
          409,
          "L'elenco delle risposte è cambiato. Ricaricalo prima di riordinare.",
        );
      const ordered = input.ids.map((id, position) => ({
        ...current.find((row) => row.id === id)!,
        position,
      }));
      await replaceOrder(tx, actor.organizationId, ordered);
      await recordActivity(tx, actor.organizationId, actor.id, "quick_reply.reordered", s.clock());
      return ordered;
    });
    return c.json(rows.map(view));
  });
  app.patch("/quick-replies/:id", async (c) => {
    const actor = c.get("operator");
    const id = parse(Id, c.req.param("id"));
    const input = await body(c, UpdateQuickReplyRequest);
    const row = await administer(s, c, async (tx) => {
      const [updated] = await tx
        .update(quickReplies)
        .set(input)
        .where(and(eq(quickReplies.id, id), eq(quickReplies.organizationId, actor.organizationId)))
        .returning();
      if (!updated) throw notFound();
      await recordActivity(tx, actor.organizationId, actor.id, "quick_reply.updated", s.clock());
      return updated;
    });
    return c.json(view(row));
  });
  app.delete("/quick-replies/:id", async (c) => {
    const actor = c.get("operator");
    const id = parse(Id, c.req.param("id"));
    await administer(s, c, async (tx) => {
      const rows = await list(tx, actor.organizationId);
      if (!rows.some((row) => row.id === id)) throw notFound();
      await replaceOrder(
        tx,
        actor.organizationId,
        rows.filter((row) => row.id !== id),
      );
      await recordActivity(tx, actor.organizationId, actor.id, "quick_reply.deleted", s.clock());
    });
    return c.body(null, 204);
  });
}
