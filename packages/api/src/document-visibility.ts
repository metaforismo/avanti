import { buildHousehold, sameMemberIdentity } from "@avanti/core";
import type { documents } from "@avanti/db";
import type { CaseRow } from "./dossier";

export function visibleToCitizen(document: typeof documents.$inferSelect, row: CaseRow): boolean {
  if (!document.citizenVisible) return false;
  if (!document.reusedMember) return true;
  const member = buildHousehold(row.answers).find((m) => m.id === document.memberId);
  return Boolean(member && sameMemberIdentity(document.reusedMember, member));
}
