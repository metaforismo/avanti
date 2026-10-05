import { resolve } from "node:path";
import { buildChecklist, buildHousehold } from "@avanti/core";
import { createDatabase, repoRoot } from "./client";
import { seedDemo } from "./demo";

if (process.env.NODE_ENV === "production") throw new Error("Demo seed is disabled in production");
const database = await createDatabase({ migrate: true });
try {
  const now = new Date();
  const { created } = await seedDemo(database.db, {
    now,
    uploadsDir: resolve(repoRoot, ".data/uploads"),
    buildHousehold,
    buildChecklist: (answers, household) =>
      buildChecklist("isee_ordinario", answers, household, "it"),
  });
  console.info(JSON.stringify({ event: "demo.seeded", created }));
} finally {
  await database.close();
}
