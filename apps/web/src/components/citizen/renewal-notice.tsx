import { RefreshCw } from "lucide-react";
import type { CitizenCase } from "@avanti/contracts";
import { Notice } from "@/components/ui/notice";

/** A renewal starts from last year's file: say so until the household is confirmed again. */
export function RenewalNotice({ data }: { data: CitizenCase }) {
  if (!data.renewal?.householdConfirmationRequired) return null;
  return (
    <Notice tone="info" icon={RefreshCw}>
      <span dir="auto">{data.renewal.notice}</span>
    </Notice>
  );
}
