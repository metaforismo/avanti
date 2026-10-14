import { ImageResponse } from "next/og";

export const alt = "Avanti: il fascicolo arriva pronto";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "#f7f8f6",
        color: "#141b2d",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 40, fontWeight: 700 }}
      >
        <svg width="56" height="56" viewBox="0 0 32 32">
          <path
            d="M6 5h20a3 3 0 0 1 3 3v5.2a2.8 2.8 0 0 0 0 5.6V24a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-5.2a2.8 2.8 0 0 0 0-5.6V8a3 3 0 0 1 3-3Z"
            fill="#2440b3"
          />
          <path
            d="M13.5 11.5 18 16l-4.5 4.5"
            fill="none"
            stroke="#ffe45c"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Avanti
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            display: "flex",
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: -3,
            lineHeight: 1,
          }}
        >
          <span
            style={{
              backgroundImage: "linear-gradient(transparent 55%, #ffe45c 55%)",
              padding: "0 8px",
              margin: "0 -8px",
            }}
          >
            Il fascicolo arriva pronto.
          </span>
        </div>
        <div style={{ fontSize: 34, color: "#485067", maxWidth: 900, lineHeight: 1.35 }}>
          Il front office AI per CAF e patronati: ascolta il cittadino nella sua lingua, prepara la
          checklist e ordina i documenti per l&apos;operatore.
        </div>
      </div>
    </div>,
    size,
  );
}
