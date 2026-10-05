"use client";

// Replaces the root layout when it fails: no global CSS or fonts are available here.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="it">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#f7f8f6",
          color: "#141b2d",
        }}
      >
        <title>Avanti non è disponibile</title>
        <main
          style={{
            minHeight: "100dvh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: 32, margin: 0 }}>Avanti non è disponibile</h1>
            <p style={{ fontSize: 18, color: "#485067" }}>
              Riprova tra qualche minuto. I dati già inviati sono al sicuro.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 16,
                padding: "12px 20px",
                fontSize: 16,
                fontWeight: 600,
                color: "#fff",
                background: "#2440b3",
                border: 0,
                borderRadius: 8,
                cursor: "pointer",
              }}
            >
              Riprova
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
