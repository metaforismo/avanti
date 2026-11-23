export type Rule = { title: string; summary: string; body: string };

/**
 * The one content pattern of the secondary pages (DESIGN.md, «Righe con titolo»): each rule is a
 * row, its title in the left half and the whole detail to the right on the same top line (the
 * page is for the DPO too: nothing is folded away). The summary stays in the data for shorter
 * uses. Rows are told apart by space, on the surface field; order is the list's.
 */
export function RuleList({ items, label }: { items: readonly Rule[]; label: string }) {
  return (
    <div className="bg-surface py-20 lg:py-28">
      <ol aria-label={label} className="frame grid gap-y-14 lg:gap-y-20">
        {items.map((item) => (
          <li
            key={item.title}
            data-reveal="stagger"
            className="grid gap-x-6 gap-y-3 lg:grid-cols-12"
          >
            <h2 className="font-display text-[clamp(1.5rem,1.1rem+1.4vw,2.25rem)] leading-[1.1] font-semibold tracking-[-0.008em] text-balance lg:col-span-5">
              {item.title}
            </h2>
            <p className="t-body text-ink lg:col-span-6 lg:col-start-7">{item.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
