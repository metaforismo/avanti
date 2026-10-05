import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#2440b3",
      }}
    >
      <svg width="96" height="96" viewBox="0 0 32 32">
        <path
          d="M12 8.5 19.5 16 12 23.5"
          fill="none"
          stroke="#ffe45c"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>,
    size,
  );
}
