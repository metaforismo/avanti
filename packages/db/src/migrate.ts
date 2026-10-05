import { createDatabase } from "./client";

const database = await createDatabase({ migrate: true });
await database.close();
console.info("Database migrations applied.");
