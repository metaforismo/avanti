/*
 * Scroll reveals for the public site (transitions in app/(site)/site.css). Started after
 * hydration: attributes added to server HTML before React hydrates are a hydration mismatch.
 * What is already on screen at that point is marked revealed first, so it never blinks; only
 * what is below the fold gets the hidden starting state, from a <style> added at the same time.
 */
const HIDDEN = [
  "[data-reveal]:not([data-revealed]),[data-reveal=stagger]:not([data-revealed])>*{opacity:0;transform:translate3d(0,var(--reveal-distance),0)}",
  "[data-reveal=stagger]:not([data-revealed]){opacity:1;transform:none}",
  "[data-reveal]:not([data-revealed]) .draw-x{transform:scaleX(0)}",
].join("");

const STYLE_ID = "site-reveal";

/** Observes the page's reveal targets; returns a cleanup. No-op with reduced motion. */
export function startReveals(): () => void {
  if (
    typeof IntersectionObserver === "undefined" ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return () => {};
  }
  const targets = [...document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-revealed])")];
  for (const node of targets) {
    if (node.getBoundingClientRect().top < window.innerHeight)
      node.setAttribute("data-revealed", "");
  }
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = HIDDEN;
    document.head.appendChild(style);
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-revealed", "");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.1 },
  );
  targets.filter((node) => !node.hasAttribute("data-revealed")).forEach((n) => observer.observe(n));
  return () => observer.disconnect();
}
