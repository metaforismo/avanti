/**
 * An office request names the items it asks for in lines appended under the operator's message.
 * The console writes them, the citizen page turns them into links and the printed sheet drops
 * them: one format for all three, or a changed separator silently breaks the other two.
 */
type Labelled = { title: string; memberName: string | null };

/** «Documento d'identità · Maria». */
export function requestLabel(item: Labelled) {
  return item.memberName ? `${item.title} · ${item.memberName}` : item.title;
}

/** The message with one line per requested item under it. */
export function withRequestLabels(message: string, items: Labelled[]) {
  return [message, ...items.map(requestLabel)].filter(Boolean).join("\n");
}

/**
 * Splits the trailing item lines from a request. Each line takes an item not taken yet with that
 * label, `prefer`red ones first: two relatives with the same name each get their own card.
 * A line that names no free item ends the list, and everything above it stays text.
 */
export function splitRequestLabels<T extends Labelled>(
  text: string,
  candidates: readonly T[],
  prefer: (item: T) => boolean = () => false,
) {
  const lines = text.split("\n");
  const items: T[] = [];
  while (lines.length > 0) {
    const line = lines.at(-1)!.trim();
    const free = candidates.filter((item) => requestLabel(item) === line && !items.includes(item));
    const item = free.find(prefer) ?? free[0];
    if (!item) break;
    items.unshift(item);
    lines.pop();
  }
  return { body: lines.join("\n").trim(), items };
}
