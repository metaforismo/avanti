import { createHmac, randomBytes } from "node:crypto";

// Development without configuration still shares one secret across local app instances.
const localSecret = randomBytes(32).toString("hex");

export function rateLimitSecret(configured: string | undefined): string {
  return configured ?? localSecret;
}

export function rateKey(secret: string, category: string, value: string): string {
  return createHmac("sha256", secret).update(`${category}:${value}`).digest("hex");
}
