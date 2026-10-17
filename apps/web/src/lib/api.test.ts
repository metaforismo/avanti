import { afterEach, describe, expect, it, vi } from "vitest";
import {
  apiDownload,
  apiFetch,
  ApiRequestError,
  fileNameFrom,
  onAuthFailure,
  type AuthFailure,
} from "./api";

function respond(
  status: number,
  body: unknown = {
    error: { code: "unauthorized", message: "Sessione scaduta. Accedi di nuovo." },
  },
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

describe("apiFetch auth failures", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports a session that ended during a write, and still throws its message", async () => {
    const heard: AuthFailure[] = [];
    const stop = onAuthFailure((failure) => heard.push(failure));
    respond(401);
    await expect(
      apiFetch("/api/cases/c1/checklist/i1/review", { method: "POST", body: {} }),
    ).rejects.toMatchObject({ status: 401, message: "Sessione scaduta. Accedi di nuovo." });
    expect(heard).toEqual([{ status: 401, path: "/api/cases/c1/checklist/i1/review" }]);
    stop();
  });

  it("reports a permission lost mid-session (403) and the profile endpoint", async () => {
    const heard: AuthFailure[] = [];
    const stop = onAuthFailure((failure) => heard.push(failure));
    respond(403, {
      error: { code: "forbidden", message: "Operazione riservata agli amministratori." },
    });
    await expect(apiFetch("/api/settings")).rejects.toBeInstanceOf(ApiRequestError);
    respond(401);
    await expect(apiFetch("/api/auth/me")).rejects.toBeInstanceOf(ApiRequestError);
    expect(heard.map((h) => h.status)).toEqual([403, 401]);
    stop();
  });

  it("does not treat a wrong password or MFA code as an ended session", async () => {
    const listener = vi.fn();
    const stop = onAuthFailure(listener);
    respond(401, { error: { code: "unauthorized", message: "Password attuale non corretta." } });
    await expect(apiFetch("/api/auth/password", { method: "POST", body: {} })).rejects.toThrow();
    await expect(apiFetch("/api/auth/login", { method: "POST", body: {} })).rejects.toThrow();
    await expect(apiFetch("/api/auth/mfa/verify", { method: "POST", body: {} })).rejects.toThrow();
    respond(404, { error: { code: "not_found", message: "Elemento non trovato." } });
    await expect(apiFetch("/api/cases/x")).rejects.toThrow();
    expect(listener).not.toHaveBeenCalled();
    stop();
  });

  it("stops reporting after unsubscribing, without dropping a newer listener", async () => {
    const old = vi.fn();
    const stopOld = onAuthFailure(old);
    const current = vi.fn();
    const stopCurrent = onAuthFailure(current);
    stopOld();
    respond(401);
    await expect(apiFetch("/api/cases")).rejects.toThrow();
    expect(old).not.toHaveBeenCalled();
    expect(current).toHaveBeenCalledOnce();
    stopCurrent();
    await expect(apiFetch("/api/cases")).rejects.toThrow();
    expect(current).toHaveBeenCalledOnce();
  });
});

describe("apiDownload", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("turns a refused export into the API's message instead of a broken file", async () => {
    const heard: AuthFailure[] = [];
    const stop = onAuthFailure((failure) => heard.push(failure));
    respond(401);
    await expect(apiDownload("/api/cases/c1/export?format=pdf")).rejects.toMatchObject({
      status: 401,
      message: "Sessione scaduta. Accedi di nuovo.",
    });
    respond(429, {
      error: { code: "rate_limited", message: "Troppe richieste. Riprova tra 30 secondi." },
    });
    await expect(apiDownload("/api/audit/export.csv")).rejects.toMatchObject({
      message: "Troppe richieste. Riprova tra 30 secondi.",
    });
    expect(heard).toEqual([{ status: 401, path: "/api/cases/c1/export?format=pdf" }]);
    stop();
  });

  it("returns the file with the server's name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("%PDF", {
            status: 200,
            headers: { "Content-Disposition": 'attachment; filename="AV-2026-000001.pdf"' },
          }),
      ),
    );
    const file = await apiDownload("/api/cases/c1/export?format=pdf");
    expect(file.fileName).toBe("AV-2026-000001.pdf");
    expect(await file.blob.text()).toBe("%PDF");
  });

  it("reports an unreachable server in Italian", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))),
    );
    await expect(apiDownload("/api/cases/c1/export")).rejects.toMatchObject({
      status: 0,
      message: "Connessione non riuscita. Controlla la rete e riprova.",
    });
  });
});

describe("fileNameFrom", () => {
  it("prefers the UTF-8 name and survives malformed headers", () => {
    expect(
      fileNameFrom(
        `attachment; filename="carta.pdf"; filename*=UTF-8''%D8%A8%D8%B7%D8%A7%D9%82%D8%A9.pdf`,
      ),
    ).toBe("بطاقة.pdf");
    expect(fileNameFrom(`attachment; filename="carta.pdf"; filename*=UTF-8''%E0%A4.pdf`)).toBe(
      "carta.pdf",
    );
    expect(fileNameFrom("attachment")).toBeNull();
    expect(fileNameFrom(null)).toBeNull();
  });
});
