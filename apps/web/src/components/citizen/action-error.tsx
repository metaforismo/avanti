import { AlertCircle, X } from "lucide-react";
import { errorMessage, type CitizenMessages, type Widen } from "@/lib/citizen/messages";
import type { ActionError } from "@/lib/citizen/use-citizen-case";

export function ActionErrorNotice({
  error,
  m,
  onDismiss,
}: {
  error: ActionError | null;
  m: Widen<CitizenMessages>;
  onDismiss: () => void;
}) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="flex animate-fade-in items-start gap-3 rounded-md bg-danger-wash px-4 py-3 text-danger"
    >
      <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p className="flex-1">{error.serverMessage ?? errorMessage(m, error.code)}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="-m-1 rounded-sm p-1 hover:bg-danger/10"
        aria-label={m.common.close}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
