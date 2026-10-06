import { sql } from "drizzle-orm";
import type { Services } from "./context";
import { ApiFailure } from "./security";

export function healthCheck(services: Services) {
  let pending: Promise<void> | undefined;
  let expires = 0;
  return async () => {
    if (!pending || performance.now() >= expires) {
      expires = performance.now() + 10000;
      pending = (async () => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          if (!services.storage.health) throw new Error("Storage probe unavailable");
          await Promise.race([
            Promise.all([services.db.execute(sql`select 1`), services.storage.health()]),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error("Probe timeout")), 3000);
            }),
          ]);
        } catch {
          throw new ApiFailure(
            "internal",
            503,
            "Servizio momentaneamente non disponibile. Riprova.",
          );
        } finally {
          clearTimeout(timer);
        }
      })();
    }
    await pending;
  };
}
