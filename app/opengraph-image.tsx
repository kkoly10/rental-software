import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "RentalOS — Inflatable Rental Software";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #1b2554 0%, #1e5dcf 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
          padding: "60px",
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            opacity: 0.7,
            marginBottom: 16,
          }}
        >
          RentalOS
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 900,
            lineHeight: 1.1,
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          Inflatable Rental Software
        </div>
        <div
          style={{
            fontSize: 26,
            fontWeight: 500,
            opacity: 0.8,
            textAlign: "center",
            maxWidth: 700,
          }}
        >
          Online booking, real-time availability, and automatic invoicing for party rental businesses
        </div>
      </div>
    ),
    { ...size }
  );
}
