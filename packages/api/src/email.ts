import type { NotificationKind } from "@avanti/db";

export type Email = { from: string; to: string; subject: string; text: string };
export type Delivery = { id: string; kind: NotificationKind; email: Email };
export interface EmailAdapter {
  readonly mode: "console" | "resend";
  send(delivery: Delivery): Promise<void>;
}

export class DeliveryFailure extends Error {
  constructor(
    readonly code: "provider_rejected" | "provider_unavailable" | "delivery_unknown",
    readonly retryable: boolean,
  ) {
    super(code);
  }
}

export class ConsoleEmail implements EmailAdapter {
  readonly mode = "console";
  constructor(
    private readonly logger: (record: { kind: NotificationKind; id: string }) => void = (record) =>
      console.info(JSON.stringify(record)),
  ) {}
  async send({ kind, id }: Delivery) {
    this.logger({ kind, id });
  }
}

export class ResendEmail implements EmailAdapter {
  readonly mode = "resend";
  constructor(
    private readonly key: string,
    private readonly http: typeof fetch = fetch,
  ) {}
  async send({ id, email }: Delivery) {
    let response: Response;
    try {
      response = await this.http("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": id,
        },
        body: JSON.stringify({ ...email, to: [email.to] }),
        signal: AbortSignal.timeout(10_000),
        redirect: "error",
      });
    } catch {
      // Provider errors can contain recipient/body: keep only a fixed internal category.
      throw new DeliveryFailure("delivery_unknown", true);
    }
    if (!response.ok) {
      await response.body?.cancel();
      const retryable =
        response.status === 429 || response.status >= 500 || response.status === 409;
      throw new DeliveryFailure(
        response.status === 429
          ? "provider_unavailable"
          : retryable
            ? "delivery_unknown"
            : "provider_rejected",
        retryable,
      );
    }
    try {
      const result: unknown = await response.json();
      if (
        !result ||
        typeof result !== "object" ||
        !("id" in result) ||
        typeof result.id !== "string" ||
        !result.id
      )
        throw new Error();
    } catch {
      throw new DeliveryFailure("delivery_unknown", true);
    }
  }
}
