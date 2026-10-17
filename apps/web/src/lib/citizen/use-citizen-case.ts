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
import {
  createRetryKeys,
  IDEMPOTENCY_HEADER,
  newIdempotencyKey,
  withRetryKey,
} from "@/lib/idempotency";
import { casePath } from "./case-path";
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

// A waiting-room Wi-Fi can stay connected while nothing goes through: the browser then waits
// for minutes. No progress for this long means the upload is lost and can be retried.
export const UPLOAD_STALL_MS = 45_000;
// After the last byte the server checks the file (and may analyse it), so it gets longer.
export const UPLOAD_RESPONSE_MS = 120_000;

/** Upload with progress events, which fetch() still cannot report for request bodies. */
function uploadWithProgress(
  url: string,
  body: FormData,
  key: string,
  onProgress: (fraction: number) => void,
): Promise<CitizenCase> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let watchdog = 0;
    const wait = (ms: number) => {
      window.clearTimeout(watchdog);
      watchdog = window.setTimeout(() => xhr.abort(), ms);
    };
    const lost = () => {
      window.clearTimeout(watchdog);
      reject(new ApiRequestError(0, "internal", "network"));
    };
    xhr.open("POST", url);
    xhr.responseType = "json";
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader(IDEMPOTENCY_HEADER, key);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
      wait(UPLOAD_STALL_MS);
    };
    xhr.upload.onload = () => wait(UPLOAD_RESPONSE_MS);
    xhr.onerror = lost;
    xhr.onabort = lost;
    xhr.ontimeout = lost;
    xhr.onload = () => {
      window.clearTimeout(watchdog);
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
    wait(UPLOAD_STALL_MS);
    xhr.send(body);
  });
}

const ANALYSIS_POLL_MS = 2500;
// Switching apps back and forth must not refetch the case every time.
const VISIBLE_REFRESH_MS = 15_000;
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
  const base = casePath(token);
  const inFlight = useRef(0);
  const uploadSlots = useRef(createLimiter(PARALLEL_UPLOADS));
  // The original files, so a failed upload can be retried without picking the photo again. The
  // key travels with the file: a retry after a lost response must not store the document twice.
  const uploadFiles = useRef(
    new Map<string, { file: File; checklistItemId: string | null; key: string }>(),
  );
  const keys = useRef(createRetryKeys());

  const loadedAt = useRef(0);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<CitizenCase>(base);
      loadedAt.current = Date.now();
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

  // From the error screen: show that something is happening, and the result of this attempt.
  const retryLoad = useCallback(() => {
    setState({ kind: "loading" });
    return load();
  }, [load]);

  useEffect(() => {
    // Initial fetch: setState happens after the await, not synchronously in the effect.
    void load();
  }, [load]);

  // Operators may change the case (requests, verification): refresh when the citizen returns.
  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        inFlight.current === 0 &&
        Date.now() - loadedAt.current > VISIBLE_REFRESH_MS
      )
        void load();
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
        else {
          // The case changed elsewhere (another phone, a sent case, the desk): retrying the same
          // action would fail forever, so show the case as it is now.
          if (code === "conflict") void load();
          setActionError({
            code,
            serverMessage:
              code === "bad_request" && error instanceof ApiRequestError ? error.message : null,
          });
        }
        return undefined;
      } finally {
        inFlight.current -= 1;
        setPending((current) => (current === key ? null : current));
      }
    },
    [load],
  );

  const apply = useCallback((data: CitizenCase | undefined) => {
    if (data) setState({ kind: "ready", data });
    return data;
  }, []);

  const turn = useCallback(
    (input: IntakeTurn, key: string = input.type) =>
      run(key, () =>
        withRetryKey(keys.current, "turn", input, (headers) =>
          apiFetch<IntakeTurnResponse>(`${base}/turn`, { method: "POST", body: input, headers }),
        ),
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
        withRetryKey(keys.current, "remove", documentId, (headers) =>
          apiFetch<CitizenCase>(`${base}/documents/${documentId}`, { method: "DELETE", headers }),
        ),
      ).then(apply),
    [apply, base, run],
  );

  // The citizen says a flagged document is right anyway; the operator still checks it.
  const keepDocument = useCallback(
    (documentId: string) =>
      run(`keep:${documentId}`, () =>
        apiFetch<CitizenCase>(`${base}/documents/${documentId}/keep`, { method: "POST" }),
      ).then(apply),
    [apply, base, run],
  );

  const submit = useCallback(
    (input: SubmitCaseRequest) =>
      run("submit", () =>
        withRetryKey(keys.current, "submit", input, (headers) =>
          apiFetch<CitizenCase>(`${base}/submit`, { method: "POST", body: input, headers }),
        ),
      ).then(apply),
    [apply, base, run],
  );

  const upload = useCallback(
    async (file: File, checklistItemId: string | null, key = newIdempotencyKey()) => {
      const id = crypto.randomUUID();
      uploadFiles.current.set(id, { file, checklistItemId, key });
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
          const data = await uploadWithProgress(`${base}/documents`, body, key, (p) =>
            patch({ progress: p }),
          );
          setUploads((list) => list.filter((u) => u.id !== id));
          uploadFiles.current.delete(id);
          apply(data);
        } catch (error) {
          const code = errorCode(error);
          if (code === "link_expired" || code === "not_found") setState({ kind: "error", code });
          if (code === "conflict") void load();
          patch({ error: code });
        } finally {
          inFlight.current -= 1;
        }
      });
    },
    [apply, base, load],
  );

  const dismissUpload = useCallback((id: string) => {
    uploadFiles.current.delete(id);
    setUploads((list) => list.filter((u) => u.id !== id));
  }, []);

  const retryUpload = useCallback(
    (id: string) => {
      const original = uploadFiles.current.get(id);
      dismissUpload(id);
      if (original) void upload(original.file, original.checklistItemId, original.key);
    },
    [dismissUpload, upload],
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
    retryLoad,
    turn,
    setLanguage,
    reassign,
    removeDocument,
    keepDocument,
    submit,
    upload,
    retryUpload,
    dismissUpload,
  };
}

export type CitizenCaseApi = ReturnType<typeof useCitizenCase>;
