import { renderSVG } from "uqr";

/** QR rendered to inline SVG at build/render time: no network, no canvas. */
export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const svg = renderSVG(value, {
    border: 1,
    ecc: "M",
    blackColor: "#141b2d",
    whiteColor: "#ffffff",
  });
  return (
    <div
      role="img"
      aria-label={label}
      className={className}
      // uqr output is generated locally from our own string, not user HTML.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
