import { Notice } from "@/components/ui/notice";
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
    <Notice
      tone="danger"
      size="md"
      onDismiss={onDismiss}
      dismissLabel={m.common.close}
      className="animate-fade-in"
    >
      {error.serverMessage ?? errorMessage(m, error.code)}
    </Notice>
  );
}
