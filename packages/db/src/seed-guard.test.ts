import { expect, it } from "vitest";
import { demoSeedAllowed } from "./seed-guard";

it("only opts in disposable loopback PostgreSQL databases outside deployment", () => {
  const local = {
    DATABASE_URL: "postgres://avanti@127.0.0.1:5544/avanti_test",
    AVANTI_LOCAL_PG_SEED: "1",
  };
  expect(demoSeedAllowed(local)).toBe(true);
  expect(demoSeedAllowed({ DATABASE_URL: "" })).toBe(true);
  for (const change of [
    { AVANTI_LOCAL_PG_SEED: "" },
    { NODE_ENV: "production" },
    { VERCEL: "1" },
    { VERCEL_ENV: "preview" },
    { DATABASE_URL: "postgres://avanti@db.example/avanti_test" },
    { DATABASE_URL: "postgres://avanti@127.0.0.1/avanti" },
    { DATABASE_URL: "postgres://avanti@127.0.0.1/avanti_test?host=db.example" },
    { DATABASE_URL: "postgres://avanti@127.0.0.1/avanti_test?host=/tmp" },
    { DATABASE_URL: "postgres://avanti@127.0.0.1/avanti_test#anything" },
    { DATABASE_URL: "http://127.0.0.1/avanti_test" },
    { DATABASE_URL: "not a URL" },
  ])
    expect(demoSeedAllowed({ ...local, ...change })).toBe(false);
});
