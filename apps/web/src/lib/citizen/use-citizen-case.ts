"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CitizenCase,
  ErrorCode,
  IntakeTurn,
  IntakeTurnResponse,
  PracticeId,
  Language,
  SubmitCaseRequest,
} from "@avanti/contracts";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { createLimiter } from "./limiter";
import { prepareUpload } from "./prepare-upload";

export type LoadState =
  | { kind: "loading" }
  | { kind: "error"; code: ErrorCode | "network" }
  | { kind: "ready"; data: CitizenCase };

/** Server messages are only shown for validation errors, which the API localizes. */
export type ActionError = { code: ErrorCode | "network"; serverMessage: string | null };

export type PendingUpload = {
  id: string;
  fileName: string;
  checklistItemId: string | null;
  progress: number;
  error: ErrorCode | "network" | "compress" | null;
};

function errorCode(error: unknown): ErrorCode | "network" {
  if (error instanceof ApiRequestError) return error.status === 0 ? "network" : error.code;
  return "internal";
}

/** Upload with progress events, which fetch() still cannot report for request bodies. */
function uploadWithProgress(
  url: string,
  body: FormData,
  onProgress: (fraction: number) => void,
): Promise<CitizenCase> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "json";
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onerror = () => reject(new ApiRequestError(0, "internal", "network"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(xhr.response as CitizenCase);
      const payload = xhr.response as { error?: { code?: ErrorCode; message?: string } } | null;
      reject(
        new ApiRequestError(
          xhr.status,
          payload?.error?.code ?? (xhr.status === 413 ? "file_too_large" : "internal"),
          payload?.error?.message ?? "",
        ),
      );
    };
    xhr.send(body);
  });
}

const ANALYSIS_POLL_MS = 2500;
const PARALLEL_UPLOADS = 2;

export function useCitizenCase(token: string) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  // Assistant replies only answer free text; after a tapped answer they would be stale.
  const [lastTurn, setLastTurn] = useState<IntakeTurn["type"] | null>(null);
  // The story pointed to a practice Avanti can't prepare yet: the need step offers the list.
  const [unavailablePractice, setUnavailablePractice] = useState<PracticeId | null>(null);
  const base = `/api/c/${encodeURIComponent(token)}`;
  const inFlight = useRef(0);
  const uploadSlots = useRef(createLimiter(PARALLEL_UPLOADS));

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<CitizenCase>(base);
      setState({ kind: "ready", data });
    } catch (error) {
      setState((current) =>
        // A failed background refresh must not wipe a case the citizen is looking at.
        current.kind === "ready" && errorCode(error) === "network"
          ? current
          : { kind: "error", code: errorCode(error) },
      );
    }
  }, [base]);

  useEffect(() => {
    // Initial fetch: setState happens after the await, not synchronously in the effect.
    void load();
  }, [load]);

  // Operators may change the case (requests, verification): refresh when the citizen returns.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && inFlight.current === 0) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  // Documents are analysed in the background after upload: check back until they're done.
  const analysing =
    state.kind === "ready" && state.data.documents.some((doc) => doc.status === "processing");
  useEffect(() => {
    if (!analysing) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible" && inFlight.current === 0) void load();
    }, ANALYSIS_POLL_MS);
    return () => window.clearInterval(id);
  }, [analysing, load]);

  const run = useCallback(
    async <T>(key: string, action: () => Promise<T>): Promise<T | undefined> => {
      inFlight.current += 1;
      setPending(key);
      setActionError(null);
      try {
        return await action();
      } catch (error) {
        const code = errorCode(error);
        if (code === "link_expired" || code === "not_found") setState({ kind: "error", code });
        else
          setActionError({
            code,
            serverMessage:
              code === "bad_request" && error instanceof ApiRequestError ? error.message : null,
          });
        return undefined;
      } finally {
        inFlight.current -= 1;
        setPending((current) => (current === key ? null : current));
      }
    },
    [],
  );

  const apply = useCallback((data: CitizenCase | undefined) => {
    if (data) setState({ kind: "ready", data });
    return data;
  }, []);

  const turn = useCallback(
    (input: IntakeTurn, key: string = input.type) =>
      run(key, () =>
        apiFetch<IntakeTurnResponse>(`${base}/turn`, { method: "POST", body: input }),
      ).then((data) => {
        if (data) {
          setLastTurn(input.type);
          setUnavailablePractice(data.unavailablePractice ?? null);
        }
        return apply(data);
      }),
    [apply, base, run],
  );

  const setLanguage = useCallback(
    (language: Language) =>
      run("language", () =>
        apiFetch<CitizenCase>(`${base}/language`, { method: "PUT", body: { language } }),
      ).then(apply),
    [apply, base, run],
  );

  const reassign = useCallback(
    (documentId: string, checklistItemId: string | null) =>
      run(`reassign:${documentId}`, () =>
        apiFetch<CitizenCase>(`${base}/documents/${documentId}`, {
          method: "PATCH",
          body: { checklistItemId },
        }),
      ).then(apply),
    [apply, base, run],
  );

  const removeDocument = useCallback(
    (documentId: string) =>
      run(`remove:${documentId}`, () =>
        apiFetch<CitizenCase>(`${base}/documents/${documentId}`, { method: "DELETE" }),
      ).then(apply),
    [apply, base, run],
  );

  const submit = useCallback(
    (input: SubmitCaseRequest) =>
      run("submit", () =>
        apiFetch<CitizenCase>(`${base}/submit`, { method: "POST", body: input }),
      ).then(apply),
    [apply, base, run],
  );

  const upload = useCallback(
    async (file: File, checklistItemId: string | null) => {
      const id = crypto.randomUUID();
      const patch = (update: Partial<PendingUpload>) =>
        setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...update } : u)));
      setUploads((list) => [
        ...list,
        { id, fileName: file.name, checklistItemId, progress: 0, error: null },
      ]);

      // Several photos at once wait in line: resizing them all together strains older phones,
      // and the server accepts a few uploads per case at a time.
      await uploadSlots.current(async () => {
        const prepared = await prepareUpload(file);
        if (!prepared.ok) {
          patch({ error: prepared.reason });
          return;
        }
        const body = new FormData();
        body.append("file", prepared.file);
        if (checklistItemId) body.append("checklistItemId", checklistItemId);
        inFlight.current += 1;
        try {
          const data = await uploadWithProgress(`${base}/documents`, body, (p) =>
            patch({ progress: p }),
          );
          setUploads((list) => list.filter((u) => u.id !== id));
          apply(data);
        } catch (error) {
          const code = errorCode(error);
          if (code === "link_expired") setState({ kind: "error", code });
          patch({ error: code });
        } finally {
          inFlight.current -= 1;
        }
      });
    },
    [apply, base],
  );

  const dismissUpload = useCallback(
    (id: string) => setUploads((list) => list.filter((u) => u.id !== id)),
    [],
  );

  return {
    state,
    pending,
    actionError,
    clearActionError: () => setActionError(null),
    uploads,
    lastTurn,
    unavailablePractice,
    reload: load,
    turn,
    setLanguage,
    reassign,
    removeDocument,
    submit,
    upload,
    dismissUpload,
  };
}

export type CitizenCaseApi = ReturnType<typeof useCitizenCase>;
