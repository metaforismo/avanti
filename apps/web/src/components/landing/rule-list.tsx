import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

export type Rule = { title: string; summary: string; body: string };

/**
 * The numbered list with hairlines (DESIGN.md): number in mono `stamp`, a rule above, a title, a
 * line, and the full detail one tap away. The one pattern of the secondary pages, so security
 * and accessibility read as the same document.
 */
export function RuleList({ items, columns = 3 }: { items: readonly Rule[]; columns?: 2 | 3 }) {
  return (
    <div className="border-y border-line bg-surface">
      <div
        data-reveal="stagger"
        className={cn(
          "mx-auto grid max-w-6xl gap-x-12 px-4 py-16 sm:px-6 md:grid-cols-2 lg:py-24",
          columns === 3 && "lg:grid-cols-3",
        )}
      >
        {items.map((item, i) => (
          <section key={item.title} className="border-t border-line py-7">
            <span aria-hidden className="tabular font-mono text-sm text-stamp">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h2 className="mt-3 font-display text-xl font-semibold">{item.title}</h2>
            <p className="mt-2 text-ink-2">{item.summary}</p>
            {/* The full detail stays one tap away: the page is for the DPO too. */}
            <details className="group mt-3">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-sm text-sm font-semibold text-stamp [&::-webkit-details-marker]:hidden">
                Nel dettaglio
                <ArrowRight
                  aria-hidden
                  className="rtl-flip size-3.5 transition-transform duration-200 ease-(--ease-out) group-open:rotate-90 group-hover:translate-x-0.5 group-open:group-hover:translate-x-0"
                />
              </summary>
              <p className="animate-rise pb-1 text-body-sm leading-relaxed text-ink-2">
                {item.body}
              </p>
            </details>
          </section>
        ))}
      </div>
    </div>
  );
}
