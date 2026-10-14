import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { ConsoleEmail, ResendEmail, type EmailAdapter } from "./email";

export interface NotificationOptions {
  key: Buffer;
  adapter: EmailAdapter;
  from?: string;
  leadsEmail?: string;
}
export const Envelope = z.object({
  from: z.string().nullable(),
  to: z.email().nullable(),
  subject: z.string().max(200),
  text: z.string().max(30_000),
});
export type Envelope = z.infer<typeof Envelope>;
const localTestKey = randomBytes(32);
export function defaultNotifications(): NotificationOptions {
  return { key: localTestKey, adapter: new ConsoleEmail() };
}

export function seal(options: NotificationOptions, aad: string, envelope: Envelope): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", options.key, iv);
  cipher.setAAD(Buffer.from(aad));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(Envelope.parse(envelope))),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function unseal(options: NotificationOptions, aad: string, value: string): Envelope {
  const data = Buffer.from(value, "base64");
  const decipher = createDecipheriv("aes-256-gcm", options.key, data.subarray(0, 12));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(data.subarray(12, 28));
  return Envelope.parse(
    JSON.parse(
      Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8"),
    ),
  );
}

export async function loadNotifications(
  env: Readonly<Record<string, string | undefined>>,
  dataDir: string,
): Promise<NotificationOptions> {
  const mode = env.NOTIFY_PROVIDER?.trim() || "console";
  if (mode !== "console" && mode !== "resend")
    throw new Error("NOTIFY_PROVIDER must be console or resend");
  if (mode === "resend" && (!env.RESEND_API_KEY?.trim() || !env.NOTIFY_FROM?.trim()))
    throw new Error("Resend requires RESEND_API_KEY and NOTIFY_FROM");
  const from = env.NOTIFY_FROM?.trim();
  if (from && !z.email().safeParse(from).success)
    throw new Error("NOTIFY_FROM must be an email address");
  const leadsEmail = env.LEADS_NOTIFY_EMAIL?.trim();
  if (leadsEmail && !z.email().safeParse(leadsEmail).success)
    throw new Error("LEADS_NOTIFY_EMAIL must be an email address");
  let value = env.NOTIFY_ENCRYPTION_KEY;
  if (!value) {
    if (env.NODE_ENV === "production" || env.VERCEL)
      throw new Error("NOTIFY_ENCRYPTION_KEY required in production");
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    const path = join(dataDir, "notify.key");
    try {
      await writeFile(path, randomBytes(32).toString("hex"), { flag: "wx", mode: 0o600 });
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    }
    value = await readFile(path, "utf8");
  }
  if (!/^[a-f\d]{64}$/i.test(value))
    throw new Error("NOTIFY_ENCRYPTION_KEY must contain 64 hex characters");
  return {
    key: Buffer.from(value, "hex"),
    adapter: mode === "resend" ? new ResendEmail(env.RESEND_API_KEY!.trim()) : new ConsoleEmail(),
    from,
    leadsEmail,
  };
}
