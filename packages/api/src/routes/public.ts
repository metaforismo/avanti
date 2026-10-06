import { eq } from "drizzle-orm";
import { leads, offices, organizations } from "@avanti/db";
import { Language, PilotLeadRequest } from "@avanti/contracts";
import { listPractices } from "@avanti/core";
import { body, parse, type App, type Services } from "../context";
import { notFound } from "../security";
import { officeView, organizationView } from "../views";

export function mountPublicRoutes(app: App, services: Services) {
  app.get("/health", (context) =>
    context.json({ status: "ok", fallbackCount: services.ai.fallbackCount ?? 0 }),
  );
  app.get("/practices", (context) =>
    context.json(listPractices(parse(Language, context.req.query("lang") ?? "it"))),
  );
  app.get("/offices/:slug", async (context) => {
    const [office] = await services.db
      .select()
      .from(offices)
      .where(eq(offices.slug, context.req.param("slug")))
      .limit(1);
    if (!office) throw notFound();
    const [organization] = await services.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, office.organizationId))
      .limit(1);
    if (!organization) throw notFound();
    return context.json({
      office: officeView(office),
      organization: organizationView(organization),
    });
  });
  app.post("/leads", async (context) => {
    const input = await body(context, PilotLeadRequest);
    const now = services.clock().toISOString();
    await services.db.insert(leads).values({
      id: crypto.randomUUID(),
      name: input.name,
      organization: input.organization,
      role: input.role ?? null,
      email: input.email,
      phone: input.phone ?? null,
      offices: input.offices ?? null,
      message: input.message ?? null,
      privacyAcceptedAt: now,
      createdAt: now,
    });
    return context.json({ ok: true }, 201);
  });
}
