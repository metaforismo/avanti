import type { ReactNode } from "react";

/**
 * Opening of the secondary site pages, the same on all of them: the title on the left at the
 * page size, the lead at the far end of the same baseline, anything else (a notice) under it.
 */
export function PageHero({
  title,
  lead,
  children,
}: {
  title: string;
  lead: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="frame grid gap-x-6 pt-16 pb-20 lg:grid-cols-12 lg:pt-28 lg:pb-28">
      <h1 className="hero-in t-head lg:col-span-7">{title}</h1>
      <div className="mt-6 lg:col-span-4 lg:col-start-9 lg:mt-0 lg:self-end">
        <p className="hero-in max-w-[40ch] text-[clamp(1.125rem,1rem+0.45vw,1.375rem)] leading-[1.45] text-pretty text-ink [--d:80ms]">
          {lead}
        </p>
        {children && <div className="hero-in mt-6 [--d:140ms]">{children}</div>}
      </div>
    </header>
  );
}

/** Closing band of the secondary pages: one way forward, on the stamp field cut like the ticket. */
export function PageCta({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      data-header="stamp"
      className="ticket bg-stamp text-on-stamp [--notch-y:50%] [--notch:2.5rem] max-sm:[--notch:1.25rem]"
    >
      <div
        data-reveal="stagger"
        className="frame grid gap-x-6 gap-y-6 py-24 lg:grid-cols-12 lg:py-32"
      >
        <h2 className="t-head lg:col-span-7">{title}</h2>
        <div className="max-w-[40ch] text-[clamp(1.125rem,1rem+0.45vw,1.375rem)] leading-[1.45] lg:col-span-4 lg:col-start-9 lg:self-end [&_a]:font-semibold [&_a]:text-marker [&_a]:underline [&_a]:decoration-[0.07em] [&_a]:underline-offset-[0.2em] [&_a:focus-visible]:outline-marker">
          {children}
        </div>
      </div>
    </section>
  );
}
