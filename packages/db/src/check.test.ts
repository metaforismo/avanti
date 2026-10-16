import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createDatabase, type Database } from "./client";
import { checkDatabase } from "./check";
import { cases, commercialUsage, offices, organizations, rateLimits } from "./schema";
import { consumeRateLimit } from "./rate-limit";

const postgresUrl = process.env.AVANTI_TEST_DATABASE_URL;
if (postgresUrl && !new URL(postgresUrl).pathname.endsWith("_test"))
  throw new Error(
    "Parity tests require a disposable Postgres database with a name ending in _test",
  );

for (const engine of ["pglite", "postgres"] as const) {
  describe.skipIf(engine === "postgres" && !postgresUrl)(
    `${engine}: staging checks and parity`,
    () => {
      let db: Database;
      let close: () => Promise<void>;
      const id = `parity-${crypto.randomUUID()}`;
      beforeAll(async () => {
        ({ db, close } = await createDatabase(
          engine === "pglite" ? { memory: true } : { url: postgresUrl, migrate: true },
        ));
        await db.insert(organizations).values({ id, name: "0", kind: "caf" });
        await db.insert(offices).values({
          id,
          organizationId: id,
          slug: id,
          name: "Prova",
          address: "Esempio",
          city: "Roma",
        });
      });
      afterAll(async () => {
        if (db) {
          await db.delete(organizations).where(eq(organizations.id, id));
          await db.delete(rateLimits).where(eq(rateLimits.key, id));
        }
        await close?.();
      });
      it("accepts every migration hash and index definition, including pg_trgm", async () => {
        expect(await checkDatabase(db)).toEqual({ migrations: 26, indexes: 45 });
        const [result] = await db
          .select({ similarity: sql<number>`similarity('Avanti', 'Avanti')` })
          .from(sql`(select 1) as trgm_check`);
        expect(result?.similarity).toBe(1);
      });
      it("pg_trgm indexes support the same reference and JSON contact substring searches", async () => {
        await db.insert(cases).values({
          id,
          organizationId: id,
          officeId: id,
          tokenHash: id,
          reference: "AV-2027-123456",
          language: "it",
          contact: { firstName: "Persona", lastName: "Esempio" },
          createdAt: "2027-01-01T00:00:00Z",
          updatedAt: "2027-01-01T00:00:00Z",
          expiresAt: "2027-03-01T00:00:00Z",
        });
        const byReference = await db
          .select({ id: cases.id })
          .from(cases)
          .where(sql`${cases.organizationId} = ${id} and ${cases.reference} ilike '%1234%'`);
        const byContact = await db
          .select({ id: cases.id })
          .from(cases)
          .where(
            sql`${cases.organizationId} = ${id} and (coalesce(${cases.contact}->>'firstName','') || ' ' || coalesce(${cases.contact}->>'lastName','')) ilike '%sona Esem%'`,
          );
        expect(byReference).toEqual([{ id }]);
        expect(byContact).toEqual([{ id }]);
      });
      it("commercial counters serialize two deliveries and duplicate concurrent updates, surviving deletion", async () => {
        const caseIds = [0, 1].map((n) => `${id}-meter-${n}`);
        for (const caseId of caseIds)
          await db.insert(cases).values({
            id: caseId,
            organizationId: id,
            officeId: id,
            tokenHash: caseId,
            reference: caseId,
            language: "it",
            createdAt: "2027-06-30T21:59:59Z",
            updatedAt: "2027-06-30T21:59:59Z",
            expiresAt: "2027-12-01T00:00:00Z",
          });
        await Promise.all(
          [caseIds[0]!, caseIds[0]!, caseIds[1]!].map((caseId) =>
            db.transaction(async (tx) => {
              await tx
                .update(cases)
                .set({ submittedAt: "2027-06-30T22:00:00Z" })
                .where(eq(cases.id, caseId));
            }),
          ),
        );
        const totals = () =>
          db
            .select()
            .from(commercialUsage)
            .where(
              sql`${commercialUsage.organizationId} = ${id} and ${commercialUsage.officeId} = '' and ${commercialUsage.month} = '2027-07'`,
            );
        expect((await totals())[0]?.delivered).toBe(2);
        for (const caseId of caseIds) await db.delete(cases).where(eq(cases.id, caseId));
        expect((await totals())[0]?.delivered).toBe(2);
      });
      it("rolls back errors without retaining partially updated state", async () => {
        await expect(
          db.transaction(async (tx) => {
            await tx.update(organizations).set({ name: "changed" }).where(eq(organizations.id, id));
            throw new Error("synthetic rollback");
          }),
        ).rejects.toThrow("synthetic rollback");
        const [row] = await db.select().from(organizations).where(eq(organizations.id, id));
        expect(row?.name).toBe("0");
      });
      it("FOR UPDATE serializes concurrent read-modify-write transactions", async () => {
        await Promise.all(
          Array.from({ length: 20 }, () =>
            db.transaction(async (tx) => {
              const [row] = await tx
                .select()
                .from(organizations)
                .where(eq(organizations.id, id))
                .for("update");
              if (!row) throw new Error("Missing synthetic row");
              await tx
                .update(organizations)
                .set({ name: String(Number(row.name) + 1) })
                .where(eq(organizations.id, id));
            }),
          ),
        );
        const [row] = await db.select().from(organizations).where(eq(organizations.id, id));
        expect(row?.name).toBe("20");
      });
      it("atomically charges shared buckets on concurrent connections and resets hourly", async () => {
        const now = new Date("2027-01-01T00:00:00Z");
        const results = await Promise.all(
          Array.from({ length: 30 }, () => consumeRateLimit(db, id, now, 20, 3600)),
        );
        expect(results.filter((r) => r.allowed)).toHaveLength(20);
        expect(results.filter((r) => r.firstRejection)).toHaveLength(1);
        expect(results.filter((r) => !r.allowed).every((r) => r.retryAfterSeconds === 3600)).toBe(
          true,
        );
        expect(await consumeRateLimit(db, id, new Date(now.getTime() + 3600000), 20, 3600)).toEqual(
          { allowed: true, retryAfterSeconds: 0, firstRejection: false },
        );
      });

      it.skipIf(engine !== "postgres")(
        "cancels statements and lock waits within configured budgets and recovers the pool",
        async () => {
          const bounded = await createDatabase({
            url: postgresUrl,
            migrate: false,
            poolMax: 1,
            statementTimeoutMs: 150,
            lockTimeoutMs: 50,
          });
          try {
            await expect(bounded.db.execute(sql`select pg_sleep(1)`)).rejects.toMatchObject({
              cause: { code: "57014" },
            });
            expect(((await bounded.db.execute(sql`select 1`)) as unknown[]).length).toBe(1);
            await db.transaction(async (tx) => {
              await tx.select().from(organizations).where(eq(organizations.id, id)).for("update");
              await expect(
                bounded.db
                  .update(organizations)
                  .set({ name: "forbidden" })
                  .where(eq(organizations.id, id)),
              ).rejects.toMatchObject({ cause: { code: "55P03" } });
            });
            const [row] = await db.select().from(organizations).where(eq(organizations.id, id));
            expect(row?.name).toBe("20");
            expect(((await bounded.db.execute(sql`select 1`)) as unknown[]).length).toBe(1);
          } finally {
            await bounded.close();
          }
        },
      );
    },
  );
}

describe("PGlite: check rejects migration and index drift without repairing it", () => {
  let db: Database;
  let close: () => Promise<void>;
  beforeAll(async () => ({ db, close } = await createDatabase({ memory: true })));
  afterAll(async () => close?.());
  it("rejects a changed migration hash", async () => {
    await db.execute(sql`update drizzle.__drizzle_migrations set hash = 'drift' where id = 1`);
    await expect(checkDatabase(db)).rejects.toThrow("Migrazioni mancanti o diverse");
  });
  it("rejects a missing journal", async () => {
    await db.execute(sql`drop table drizzle.__drizzle_migrations`);
    await expect(checkDatabase(db)).rejects.toThrow("Registro migrazioni assente");
  });
  it("rejects a missing index and an index with the same name but wrong columns", async () => {
    const resource = await createDatabase({ memory: true });
    try {
      await resource.db.execute(sql`drop index cases_org_updated_idx`);
      await expect(checkDatabase(resource.db)).rejects.toThrow("cases_org_updated_idx");
      await resource.db.execute(
        sql`create index cases_org_updated_idx on cases using btree (id, updated_at, organization_id)`,
      );
      await expect(checkDatabase(resource.db)).rejects.toThrow("cases_org_updated_idx");
    } finally {
      await resource.close();
    }
  });
});
