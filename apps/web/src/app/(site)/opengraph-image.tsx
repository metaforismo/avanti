import { ImageResponse } from "next/og";
import { CHEVRON_PATH, TICKET_PATH } from "@/components/brand/mark";

export const alt = "Avanti: il fascicolo arriva pronto";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The landing's hero as a card: ruled paper, the title with its highlighter, the ticket. */
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 80px",
        background: "#f7f8f6",
        backgroundImage:
          "repeating-linear-gradient(to bottom, transparent 0 47px, rgba(20,27,45,0.06) 47px 48px)",
        color: "#141b2d",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 40, fontWeight: 700 }}
        >
          <svg width="56" height="56" viewBox="0 0 32 32">
            <path d={TICKET_PATH} fill="#2440b3" />
            <path
              d={CHEVRON_PATH}
              fill="none"
              stroke="#ffe45c"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Avanti
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            fontWeight: 700,
            color: "#2440b3",
            background: "#e9edfb",
            padding: "8px 18px",
            borderRadius: 999,
          }}
        >
          Pilota ISEE · gennaio 2027
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", fontSize: 100, fontWeight: 800, lineHeight: 1 }}>
          Il fascicolo arriva&nbsp;
          <span
            style={{
              backgroundImage: "linear-gradient(transparent 58%, #ffe45c 58%)",
              padding: "0 8px",
              margin: "0 -8px",
            }}
          >
            pronto.
          </span>
        </div>
        <div style={{ fontSize: 32, color: "#485067", maxWidth: 920, lineHeight: 1.35 }}>
          Per CAF e patronati: il cittadino prepara l’ISEE dal telefono, nella sua lingua;
          l’operatore trova documenti in ordine e quello che manca già segnalato.
        </div>
      </div>
    </div>,
    size,
  );
}
