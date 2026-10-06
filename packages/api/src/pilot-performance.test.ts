import { writeFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { createDatabase, organizations, offices, operators, sessions, settings } from "@avanti/db";
import { createApp } from "./app";
import { hashToken, newToken } from "./security";
import { MemoryStorage } from "./storage";

it("pilot: 2,000 cases / 20,000 documents have bounded request query counts and stable cursors", async () => {
  let queries: string[] = [];
  const { db, close } = await createDatabase({
    memory: true,
    logger: { logQuery: (query) => queries.push(query) },
  });
  try {
    const at = "2027-01-05T10:00:00.000Z";
    await db.insert(organizations).values({ id: "bench", name: "CAF sintetico", kind: "caf" });
    await db.insert(offices).values({
      id: "office",
      organizationId: "bench",
      slug: "bench",
      name: "Sede",
      address: "Esempio",
      city: "Roma",
    });
    await db.insert(operators).values({
      id: "operator",
      organizationId: "bench",
      name: "Operatore sintetico",
      email: "bench@example.invalid",
      passwordHash: "unused",
      role: "admin",
    });
    await db.insert(settings).values({ organizationId: "bench", baselineMinutesPerCase: 30 });
    const token = newToken();
    await db.insert(sessions).values({
      id: "session",
      operatorId: "operator",
      tokenHash: hashToken(token),
      createdAt: at,
      expiresAt: "2027-01-05T18:00:00Z",
    });
    await db.execute(sql`insert into cases (id, organization_id, office_id, assignee_id, token_hash, reference, language, practice_id, status, answers, created_at, updated_at, submitted_at, expires_at)
      select 'case-' || lpad(i::text, 4, '0'), 'bench', 'office', 'operator', 'hash-' || i, 'AV-2027-' || lpad(i::text, 6, '0'), 'it', 'isee_ordinario', 'submitted', '{"household_count":1,"members":[{"id":"member","firstName":"Persona","lastName":"Esempio","role":"richiedente"}]}'::jsonb,
      case when i <= 1800 then '2025-01-01'::timestamptz else '2027-01-01'::timestamptz end, '2027-01-05'::timestamptz,
      case when i <= 1800 then '2025-01-02'::timestamptz else '2027-01-02'::timestamptz end, '2027-03-01'::timestamptz from generate_series(1,2000) i`);
    await db.execute(sql`insert into documents (id, case_id, file_name, mime_type, size_bytes, storage_key, sha256, uploaded_at, status, analysis)
      select 'doc-' || i || '-' || j, 'case-' || lpad(i::text,4,'0'), 'ESEMPIO.pdf', 'application/pdf', 1024, 'synthetic/' || i || '/' || j, 'hash-' || j, '2027-01-01', 'analyzed', '{"engine":"heuristic","detectedRequirementId":null,"detectedLabel":null,"confidence":0.1,"ownerName":null,"referenceYear":null,"expiresOn":null,"legible":false,"pagesComplete":null,"findings":[]}'::jsonb from generate_series(1,2000) i cross join generate_series(1,10) j`);
    await db.execute(sql`insert into events (id, case_id, organization_id, actor, type, at, metadata)
      select 'event-' || i || '-' || j, 'case-' || lpad(i::text,4,'0'), 'bench', 'operator',
      case j when 1 then 'case.created' when 2 then 'document.downloaded' when 3 then 'case.requested' else 'review.completed' end,
      case when i <= 1800 then '2025-01-03'::timestamptz else '2027-01-03'::timestamptz end, '{"durationMinutes":5}'::jsonb from generate_series(1,2000) i cross join generate_series(1,4) j`);
    await db.execute(sql`analyze`);
    const app = createApp({ db, storage: new MemoryStorage(), clock: () => new Date(at) });
    const headers = { Cookie: `avanti_session=${token}` };
    const measurements: Record<string, { queries: number; medianMs: number }> = {};
    for (const [name, path] of Object.entries({
      queue: "/api/cases?limit=50",
      dossier: "/api/cases/case-2000",
      metrics: "/api/metrics?from=2027-01-01&to=2027-01-31",
      json: "/api/cases/case-2000/export?format=json",
      pdf: "/api/cases/case-2000/export?format=pdf",
    })) {
      const times: number[] = [];
      const counts: number[] = [];
      for (let sample = 0; sample < 6; sample++) {
        queries = [];
        const start = performance.now();
        const response = await app.request(path, { headers });
        expect(response.status, path).toBe(200);
        await response.arrayBuffer();
        if (sample) {
          times.push(performance.now() - start);
          counts.push(queries.length);
        }
      }
      expect(new Set(counts).size).toBe(1);
      expect(counts[0]).toBeLessThanOrEqual(15);
      measurements[name] = {
        queries: counts[0]!,
        medianMs: Number(times.sort((a, b) => a - b)[2]!.toFixed(2)),
      };
    }
    // Equal timestamps need an ID tie breaker: every case appears once across all pages.
    const ids = new Set<string>();
    let cursor: string | null = null;
    do {
      const response = await app.request(
        `/api/cases?limit=100${cursor ? `&cursor=${cursor}` : ""}`,
        { headers },
      );
      expect(response.status).toBe(200);
      const page = (await response.json()) as {
        items: { id: string }[];
        nextCursor: string | null;
      };
      for (const item of page.items) {
        expect(ids.has(item.id)).toBe(false);
        ids.add(item.id);
      }
      cursor = page.nextCursor;
    } while (cursor);
    expect(ids.size).toBe(2000);
    const metrics = await (
      await app.request("/api/metrics?from=2027-01-01&to=2027-01-31", { headers })
    ).json();
    expect(metrics).toMatchObject({
      casesStarted: 200,
      casesSubmitted: 200,
      casesReady: 200,
      avgReviewMinutes: 5,
      needsCitizenRate: 1,
    });
    for (const limit of [1, 100]) {
      queries = [];
      expect((await app.request(`/api/cases?limit=${limit}`, { headers })).status).toBe(200);
      expect(queries.length).toBe(measurements.queue!.queries);
    }
    // Force only for index viability on a homogeneous synthetic tenant, not a claim about production plans.
    await db.execute(sql`set enable_seqscan = off`);
    const plans: Record<string, string> = {};
    for (const [name, query] of Object.entries({
      queue: sql`explain (format json) select id from cases where organization_id='bench' order by updated_at desc,id desc limit 50`,
      status: sql`explain (format json) select id from cases where organization_id='bench' and status='submitted' order by updated_at desc,id desc limit 50`,
      office: sql`explain (format json) select id from cases where organization_id='bench' and office_id='office' order by updated_at desc,id desc limit 50`,
      practice: sql`explain (format json) select id from cases where organization_id='bench' and practice_id='isee_ordinario' order by updated_at desc,id desc limit 50`,
      assignee: sql`explain (format json) select id from cases where organization_id='bench' and assignee_id='operator' order by updated_at desc,id desc limit 50`,
      search: sql`explain (format json) select id from cases where reference ilike '%002000%'`,
      contact: sql`explain (format json) select id from cases where (coalesce(contact->>'firstName','') || ' ' || coalesce(contact->>'lastName','')) ilike '%Esempio%'`,
      submitted: sql`explain (format json) select id from cases where organization_id='bench' and submitted_at >= '2027-01-01'`,
      events: sql`explain (format json) select id from events where case_id='case-2000' and type='review.completed' and at >= '2027-01-01'`,
    })) {
      plans[name] = JSON.stringify(await db.execute(query));
      expect(plans[name]).toContain("Index");
    }
    expect(plans.search).toContain("cases_reference_search_idx");
    expect(plans.contact).toContain("cases_contact_search_idx");
    await db.execute(sql`set enable_seqscan = on`);
    console.info("PILOT_BENCHMARK", JSON.stringify(measurements));
    if (process.env.PILOT_BENCHMARK_OUTPUT)
      await writeFile(
        process.env.PILOT_BENCHMARK_OUTPUT,
        JSON.stringify({ measurements, plans }, null, 2) + "\n",
      );
  } finally {
    await close();
  }
}, 120_000);
