import type { ReactNode } from "react";

/** Opening of the secondary site pages: the landing's ruled paper, label, title and lead. */
export function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="relative">
      <div aria-hidden className="ruled pointer-events-none absolute inset-x-0 top-0 h-[30rem]" />
      <div className="relative mx-auto max-w-6xl px-4 pt-12 pb-14 sm:px-6 lg:pt-20 lg:pb-20">
        <p className="hero-in mb-5 flex items-center gap-2.5 type-eyebrow text-stamp">
          <span aria-hidden className="h-px w-6 bg-current opacity-60" />
          {eyebrow}
        </p>
        <h1 className="hero-in max-w-3xl font-display type-page [--d:60ms]">{title}</h1>
        <p className="hero-in mt-6 max-w-2xl type-lead text-ink-2 [--d:120ms]">{lead}</p>
        {children && <div className="hero-in mt-8 [--d:180ms]">{children}</div>}
      </div>
    </header>
  );
}

/** Closing band of the secondary pages: one way forward, the same as the landing's. */
export function PageCta({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:pb-28">
      <div
        data-reveal
        className="grain grain-dark relative overflow-hidden rounded-[1.75rem] bg-contrast px-6 py-10 text-on-contrast sm:px-10 lg:px-14 lg:py-12"
      >
        <h2 className="max-w-2xl font-display type-subsection">{title}</h2>
        <div className="mt-4 max-w-2xl type-lead text-on-contrast/80 [&_a]:font-semibold [&_a]:text-marker [&_a]:underline [&_a]:underline-offset-4 [&_a:focus-visible]:outline-marker">
          {children}
        </div>
      </div>
    </section>
  );
}
