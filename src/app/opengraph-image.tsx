import { ImageResponse } from "next/og";
import { APP } from "@/lib/config";

export const runtime = "nodejs";
export const alt = `${APP.name} — unlimited digital waivers for a flat monthly price`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social share card (og:image / twitter:image), matching the brand lockup. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#101014",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="76" height="76" viewBox="0 0 24 24" fill="none">
            <path
              d="M7 2.9h10c1.2 0 2.1.9 2.1 2.1v6.3c0 4.9-2.9 8.2-6.6 10.2-.3.2-.7.2-1 0-3.7-2-6.6-5.3-6.6-10.2V5c0-1.2.9-2.1 2.1-2.1Z"
              fill="#6366F1"
            />
            <path
              d="m8.4 11.9 2.4 2.4 4.8-5"
              stroke="#fff"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700 }}>
            <span>Flat</span>
            <span style={{ color: "#818CF8" }}>Waiver</span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 52,
            fontSize: 52,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
          }}
        >
          Unlimited digital waivers. ${APP.priceMonthlyUsd}/month, flat.
        </div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 30, color: "#9CA3AF" }}>
          Court-ready records · No per-signature fees, ever
        </div>
      </div>
    ),
    size
  );
}
