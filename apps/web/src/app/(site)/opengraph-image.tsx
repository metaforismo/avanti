import { ImageResponse } from "next/og";
import { CHEVRON_PATH, TICKET_PATH } from "@/components/brand/mark";

export const alt = "Avanti: il fascicolo arriva pronto";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The landing's hero as a card: paper, the title with its highlighter, the stamp-blue slip. */
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
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: "#2440b3" }}>
          Pilota ISEE da gennaio 2027
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ display: "flex", fontSize: 100, fontWeight: 800, lineHeight: 1 }}>
          Il fascicolo arriva&nbsp;
          <span
            style={{ display: "flex", position: "relative", padding: "0 8px", margin: "0 -8px" }}
          >
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 6,
                height: 40,
                background: "#ffe45c",
                borderRadius: 4,
              }}
            />
            <span style={{ position: "relative" }}>pronto.</span>
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
