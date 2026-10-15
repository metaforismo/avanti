import { createDatabase } from "./client";
import { assertDemoSeedAllowed } from "./seed-guard";
import { seedVolume, volumeCasesArgument } from "./volume";

assertDemoSeedAllowed();
const count = volumeCasesArgument(process.argv.slice(2));
const database = await createDatabase({ migrate: true });
try {
  console.info(
    JSON.stringify({ event: "demo.volume_seeded", ...(await seedVolume(database.db, count)) }),
  );
} finally {
  await database.close();
}
