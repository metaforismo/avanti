import type { ChecklistItem } from "@avanti/contracts";
import { ownerSuffix } from "@avanti/core/request-labels";
import { Bidi } from "./bidi";

/**
 * A checklist item in a sentence-like list: the title, then whose it is in parentheses, only when
 * the title does not name them already. Both isolated, for Italian terms inside Arabic titles.
 */
export function ItemLabel({ item }: { item: Pick<ChecklistItem, "title" | "memberName"> }) {
  const owner = ownerSuffix(item);
  return (
    <span className="min-w-0 break-words">
      <Bidi text={item.title} />
      {owner && (
        <span className="text-ink-2">
          {" "}
          (<bdi>{owner}</bdi>)
        </span>
      )}
    </span>
  );
}
