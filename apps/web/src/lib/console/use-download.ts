"use client";

import { useCallback, useState } from "react";
import { apiDownload, ApiRequestError } from "@/lib/api";

/**
 * Saves an API file under its server name. Resolves to null when the save started, or to the
 * reason it could not, for the page to show where the operator is looking.
 */
export function useDownload() {
  const [pending, setPending] = useState<string | null>(null);

  /** `check` looks at the file before it is saved and returns why it must not be. */
  const download = useCallback(
    async (path: string, fallbackName: string, check?: (blob: Blob) => Promise<string | null>) => {
      setPending(path);
      try {
        const { blob, fileName } = await apiDownload(path);
        const problem = await check?.(blob);
        if (problem) return problem;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName ?? fallbackName;
        document.body.append(link);
        link.click();
        link.remove();
        // Revoked once the browser has surely started the save.
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return null;
      } catch (err) {
        return err instanceof ApiRequestError
          ? err.message
          : "Download non riuscito. Riprova tra poco.";
      } finally {
        setPending(null);
      }
    },
    [],
  );

  return { download, pending };
}
