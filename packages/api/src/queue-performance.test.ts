import { expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { CaseListItem, CaseListResponse as ResponseSchema } from "@avanti/contracts";
import { createDatabase, cases, documents, sessions, organizations, offices } from "@avanti/db";
import { seedVolume, volumeId, VOLUME_NOW } from "@avanti/db/volume";
import { createApp } from "./app";
import { hashToken } from "./security";
import { MemoryStorage } from "./storage";

const CaseListResponse = ResponseSchema.extend({ items: CaseListItem.strict().array() });

it("keeps list evaluation equal to dossiers, orders timestamp ties, searches literal text and scopes every page", async () => {
  let queryCount = 0;
  const { db, close } = await createDatabase({
    memory: true,
    logger: {
      logQuery() {
        queryCount++;
      },
    },
  });
  try {
    await seedVolume(db, 240);
    const at = "2027-01-15T11:00:00.000Z";
    await db.update(cases).set({ updatedAt: at });
    const token = "s".repeat(43);
    await db.insert(sessions).values({
      id: "queue-test-session",
      tokenHash: hashToken(token),
      operatorId: "demo-admin",
      createdAt: VOLUME_NOW,
      expiresAt: "2027-01-15T18:00:00Z",
    });
    await db.insert(organizations).values({ id: "other", name: "Other", kind: "caf" });
    await db.insert(offices).values({
      id: "other-office",
      organizationId: "other",
      slug: "other",
      name: "Other",
      address: "Esempio",
      city: "Roma",
    });
    await db.insert(cases).values({
      id: "other-case",
      organizationId: "other",
      officeId: "other-office",
      tokenHash: "other-hash",
      reference: "VOL-2027-0000001",
      status: "submitted",
      language: "it",
      createdAt: at,
      updatedAt: at,
      expiresAt: "2027-04-01",
    });
    // Exercise warning/blocker and review paths, including documents not belonging to current checklist.
    await db
      .update(documents)
      .set({ status: "failed" })
      .where(eq(documents.id, `${volumeId(1)}-doc-0`));
    await db
      .update(cases)
      .set({ practiceId: null })
      .where(eq(cases.id, volumeId(7)));
    await db
      .update(cases)
      .set({ contact: { firstName: "Percento% Sotto_ Barra\\", lastName: "ESEMPIO" } })
      .where(eq(cases.id, volumeId(2)));
    const app = createApp({ db, storage: new MemoryStorage(), clock: () => new Date(VOLUME_NOW) });
    const get = async (path: string) => {
      const response = await app.request(path, { headers: { Cookie: `avanti_session=${token}` } });
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      return response.json();
    };
    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const result = CaseListResponse.parse(
        await get(`/api/cases?limit=17${cursor ? `&cursor=${cursor}` : ""}`),
      );
      expect(result.counts).toEqual({
        intake: 40,
        submitted: 40,
        in_review: 40,
        needs_citizen: 40,
        ready: 40,
        closed: 40,
      });
      ids.push(...result.items.map((r) => r.id));
      cursor = result.nextCursor;
    } while (cursor);
    expect(ids).toEqual(Array.from({ length: 240 }, (_, i) => volumeId(240 - i)));
    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
      const page = CaseListResponse.parse(
        await get(`/api/cases?q=${encodeURIComponent(`VOL-2027-${String(n).padStart(7, "0")}`)}`),
      );
      expect(page.items).toHaveLength(1);
      const dossier = (await get(`/api/cases/${volumeId(n)}`)) as Record<string, unknown>;
      for (const [key, value] of Object.entries(page.items[0]!))
        expect(dossier[key], key).toEqual(value);
      expect(Object.keys(page.items[0]!)).not.toContain("documents");
      expect(Object.keys(page.items[0]!)).not.toContain("answers");
    }
    for (const q of ["Percento%", "Sotto_", "Barra\\", "percento% sotto_"]) {
      const result = CaseListResponse.parse(await get(`/api/cases?q=${encodeURIComponent(q)}`));
      expect(result.items.map((r) => r.id)).toEqual([volumeId(2)]);
    }
    const filtered = CaseListResponse.parse(
      await get(
        "/api/cases?status=in_review&officeId=demo-office-centro&assignee=demo-operator&practiceId=isee_ordinario",
      ),
    );
    expect(filtered.items).toHaveLength(40);
    expect(
      filtered.items.every(
        (r) => r.status === "in_review" && r.office?.id === "demo-office-centro",
      ),
    ).toBe(true);
    // This captures N+1 regressions without tying the assertion to today's exact count.
    queryCount = 0;
    await get("/api/cases?limit=1");
    const one = queryCount;
    queryCount = 0;
    await get("/api/cases?limit=100");
    expect(queryCount).toBe(one);
    expect(queryCount).toBeLessThanOrEqual(11);
    const invalid = await app.request("/api/cases?cursor=invalid", {
      headers: { Cookie: `avanti_session=${token}` },
    });
    expect(invalid.status).toBe(400);
  } finally {
    await close();
  }
}, 30000);
